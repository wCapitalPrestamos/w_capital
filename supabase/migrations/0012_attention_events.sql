-- Bitácora de "requiere atención": antes needs_human era un solo booleano
-- que se sobreescribía en cada llamada de /api/n8n/handoff y se apagaba
-- entero al resolver, perdiendo el rastro de cuántos mensajes distintos lo
-- habían disparado. Esta tabla guarda un evento por cada vez que el bot no
-- supo responder; needs_human y open_attention_count en conversations se
-- mantienen en sync vía trigger.
--
-- El trigger hace la suma/resta con `col = col + 1` / `col - 1`, que Postgres
-- serializa por fila (row lock en el UPDATE), así que un evento nuevo
-- insertado justo mientras se resuelve otro no se pierde: cada INSERT/UPDATE
-- sobre conversation_attention_events dispara su propio ajuste atómico sobre
-- conversations, en vez de un solo UPDATE ciego que pisa el estado anterior.

create table public.conversation_attention_events (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid references public.messages (id) on delete set null,
  reason text not null check (reason in ('out_of_scope', 'client_requested', 'other', 'legacy')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);

create index conversation_attention_events_open_idx
  on public.conversation_attention_events (conversation_id)
  where resolved_at is null;

alter table public.conversations
  add column open_attention_count int not null default 0;

create or replace function public.handle_attention_event_insert()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set open_attention_count = open_attention_count + 1,
      needs_human = true
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversation_attention_events_after_insert
  after insert on public.conversation_attention_events
  for each row execute function public.handle_attention_event_insert();

create or replace function public.handle_attention_event_resolve()
returns trigger language plpgsql as $$
begin
  if new.resolved_at is not null and old.resolved_at is null then
    update public.conversations
    set open_attention_count = greatest(open_attention_count - 1, 0),
        needs_human = (open_attention_count - 1) > 0
    where id = new.conversation_id;
  end if;
  return new;
end;
$$;

create trigger conversation_attention_events_after_resolve
  after update on public.conversation_attention_events
  for each row execute function public.handle_attention_event_resolve();

alter table public.conversation_attention_events enable row level security;
create policy "staff full access" on public.conversation_attention_events
  for all using (public.is_staff()) with check (public.is_staff());

-- Backfill: conversaciones que ya tenían needs_human=true con el esquema
-- anterior quedan con un evento "legacy" para no perder el aviso existente.
insert into public.conversation_attention_events (conversation_id, reason)
select id, 'legacy' from public.conversations where needs_human;
