-- Tipo de préstamo desconocido debe poder representarse como NULL
-- (hoy el default 'personal' oculta el caso "aún no lo sabemos").
alter table public.loan_applications
  alter column borrower_type drop not null,
  alter column borrower_type drop default;

-- Estado transitorio del flujo de botones interactivos (nodo Wait de n8n).
-- Vive en loan_applications porque sólo puede haber una solicitud abierta
-- por contacto a la vez (mismo invariante que usa upload-link hoy).
alter table public.loan_applications
  add column pending_resume_url text,
  add column pending_resume_expires_at timestamptz;

-- Resuelve/crea la solicitud abierta de un contacto de forma atómica
-- (reemplaza el bloque select+insert/update de upload-link/route.ts).
-- Condición A: sin solicitud abierta -> crea una.
-- Condición B: con solicitud abierta -> la reutiliza si tuvo actividad en
-- los últimos 30 días, o la cancela y crea una nueva si no.
create or replace function public.resolve_active_application(
  p_contact_id uuid,
  p_borrower_type text default null,
  p_requested_amount numeric default null,
  p_business_name text default null
) returns table (application public.loan_applications, is_new boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.loan_applications;
  v_stale_after interval := interval '30 days';
begin
  -- Serializa llamadas concurrentes para el mismo contacto (doble webhook,
  -- reintento de Meta): sin esto, dos llamadas simultáneas con "sin
  -- solicitud abierta" podrían insertar dos filas nuevas a la vez.
  perform pg_advisory_xact_lock(hashtext(p_contact_id::text));

  select * into v_app
  from public.loan_applications la
  where la.contact_id = p_contact_id
    and la.status in ('draft', 'docs_pending', 'under_review')
  order by la.created_at desc
  limit 1
  for update;

  if found then
    if v_app.updated_at >= now() - v_stale_after then
      -- Condición B (reutilizar): completa datos si faltaban.
      update public.loan_applications set
        requested_amount = coalesce(loan_applications.requested_amount, p_requested_amount),
        borrower_type = coalesce(p_borrower_type, loan_applications.borrower_type),
        business_name = case when p_borrower_type is not null
                          then p_business_name
                          else loan_applications.business_name end,
        updated_at = now()
      where id = v_app.id
      returning * into v_app;

      return query select v_app, false;
      return;
    end if;

    -- Condición B (expirada): cancela y cae al insert de abajo.
    update public.loan_applications
    set status = 'cancelled', updated_at = now()
    where id = v_app.id;

    insert into public.application_status_history (application_id, from_status, to_status, note)
    values (v_app.id, v_app.status, 'cancelled',
      format('Cancelada automáticamente: sin actividad por más de %s días. El cliente reinició la solicitud.',
        extract(day from v_stale_after)));
  end if;

  -- Condición A: no había solicitud abierta (o la que había quedó cancelada arriba).
  insert into public.loan_applications (contact_id, status, requested_amount, borrower_type, business_name)
  values (p_contact_id, 'docs_pending', p_requested_amount, p_borrower_type, p_business_name)
  returning * into v_app;

  return query select v_app, true;
end;
$$;

grant execute on function public.resolve_active_application(uuid, text, numeric, text) to service_role;
