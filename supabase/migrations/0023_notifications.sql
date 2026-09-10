-- Centro de notificaciones del CRM. Mismo patrón que
-- conversation_attention_events: tabla append-only, una fila por
-- destinatario (fan-out en el insert, no "broadcast" implícito) para que la
-- RLS sea trivial — cada quien ve solo lo suyo.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'application_ready_for_review',
    'application_status_changed',
    'application_cancelled',
    'document_rejected',
    'loan_disbursed',
    'chat_stale',
    'chat_unassigned_new_message',
    'chat_human_requested',
    'chat_reassigned',
    'application_reassigned'
  )),
  title text not null,
  body text not null,
  entity_type text not null check (entity_type in ('conversation', 'application', 'lead', 'loan')),
  entity_id uuid not null,
  link_path text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
-- (select auth.uid()) en vez de auth.uid() a secas: evita que Postgres lo
-- re-evalúe por cada fila (mismo fix que pide el linter de RLS de Supabase).
create policy "own notifications" on public.notifications
  for all using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));

alter publication supabase_realtime add table public.notifications;

-- Helper: una fila por cada perfil activo del rol dado (fan-out por rol).
create or replace function public.notify_role(
  p_role text, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_link_path text
) returns void
language sql security definer set search_path = public
as $$
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, link_path)
  select id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link_path
  from public.profiles where role = p_role and active;
$$;

-- Helper: una fila para un perfil puntual (no-op si p_recipient_id es null,
-- para poder usarlo directo con advisor_id/analyst_id/assigned_to sin un
-- "if" en cada llamada).
create or replace function public.notify_profile(
  p_recipient_id uuid, p_type text, p_title text, p_body text,
  p_entity_type text, p_entity_id uuid, p_link_path text
) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_recipient_id is null then return; end if;
  insert into public.notifications (recipient_id, type, title, body, entity_type, entity_id, link_path)
  values (p_recipient_id, p_type, p_title, p_body, p_entity_type, p_entity_id, p_link_path);
end;
$$;

-- Extiende el trigger existente de application_status_history (mismo punto
-- de enganche, ya se dispara en cada insert/cambio de status) para además
-- notificar al asesor asignado según a dónde se movió la solicitud.
create or replace function public.handle_application_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_folio text;
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());

    v_folio := 'SOL-' || lpad(new.folio::text, 6, '0');

    if new.status = 'approved' then
      perform public.notify_profile(new.advisor_id, 'application_status_changed',
        'Solicitud aprobada', v_folio || ' fue aprobada.',
        'application', new.id, '/solicitudes/' || new.id);
    elsif new.status = 'rejected' then
      perform public.notify_profile(new.advisor_id, 'application_status_changed',
        'Solicitud rechazada', v_folio || ' fue rechazada.',
        'application', new.id, '/solicitudes/' || new.id);
    elsif new.status = 'cancelled' then
      perform public.notify_profile(new.advisor_id, 'application_cancelled',
        'Solicitud cancelada', v_folio || ' fue cancelada.',
        'application', new.id, '/solicitudes/' || new.id);
    elsif new.status = 'disbursed' then
      perform public.notify_profile(new.advisor_id, 'loan_disbursed',
        'Préstamo desembolsado', v_folio || ' ya fue desembolsada.',
        'application', new.id, '/solicitudes/' || new.id);
    elsif new.status = 'under_review' and old.status = 'rejected' then
      perform public.notify_profile(new.advisor_id, 'application_status_changed',
        'Solicitud reabierta', v_folio || ' se reabrió para análisis.',
        'application', new.id, '/solicitudes/' || new.id);
    end if;
  end if;
  return new;
end;
$$;

-- Documento rechazado → avisa al asesor de la solicitud dueña.
create or replace function public.notify_document_rejected()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_advisor uuid;
  v_folio text;
begin
  if new.review_status = 'rejected' and old.review_status is distinct from 'rejected' then
    select advisor_id, 'SOL-' || lpad(folio::text, 6, '0')
    into v_advisor, v_folio
    from public.loan_applications where id = new.application_id;

    perform public.notify_profile(v_advisor, 'document_rejected',
      'Documento rechazado',
      'Un documento de ' || coalesce(v_folio, 'una solicitud') || ' fue rechazado' ||
        case when new.review_note is not null then ': ' || new.review_note else '.' end,
      'application', new.application_id, '/solicitudes/' || new.application_id);
  end if;
  return new;
end;
$$;

create trigger documents_after_review
  after update on public.documents
  for each row execute function public.notify_document_rejected();

-- "Documentación completa": se dispara cuando, tras subir/actualizar un
-- documento, application_missing_documents() pasa a estar vacío. Se avisa
-- una sola vez por solicitud (guardado contra duplicar el aviso si se sigue
-- tocando la solicitud después).
create or replace function public.notify_documents_complete()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_app_id uuid := coalesce(new.application_id, old.application_id);
  v_advisor uuid;
  v_folio text;
  v_already_notified boolean;
begin
  if array_length(public.application_missing_documents(v_app_id), 1) is not null then
    return coalesce(new, old);
  end if;

  select exists(
    select 1 from public.notifications
    where entity_type = 'application' and entity_id = v_app_id
      and type = 'application_ready_for_review'
  ) into v_already_notified;
  if v_already_notified then
    return coalesce(new, old);
  end if;

  select advisor_id, 'SOL-' || lpad(folio::text, 6, '0')
  into v_advisor, v_folio
  from public.loan_applications where id = v_app_id;

  perform public.notify_profile(v_advisor, 'application_ready_for_review',
    'Documentación completa', v_folio || ' ya tiene todos sus documentos.',
    'application', v_app_id, '/solicitudes/' || v_app_id);
  perform public.notify_role('analyst', 'application_ready_for_review',
    'Documentación completa', v_folio || ' ya tiene todos sus documentos.',
    'application', v_app_id, '/solicitudes/' || v_app_id);

  return coalesce(new, old);
end;
$$;

create trigger documents_after_change_notify_complete
  after insert or update on public.documents
  for each row execute function public.notify_documents_complete();
