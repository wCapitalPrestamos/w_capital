-- Mensajes de "relleno" (reacciones, ánimos, risas sueltas, emojis sueltos):
-- se siguen guardando en el historial, pero no deben disparar el badge de
-- no leídos ni mover la conversación al tope del inbox — el equipo no
-- necesita que se le llame la atención por un "👍" o un "jaja".

alter table public.messages add column is_filler boolean not null default false;

create or replace function public.handle_new_message()
returns trigger language plpgsql as $$
begin
  if new.is_filler then
    return new;
  end if;

  update public.conversations
  set
    last_message_at = coalesce(new.sent_at, new.created_at),
    last_preview = left(coalesce(nullif(new.body, ''), '[' || new.message_type || ']'), 120),
    last_inbound_at = case when new.direction = 'inbound'
      then coalesce(new.sent_at, new.created_at) else last_inbound_at end,
    unread_count = case when new.direction = 'inbound'
      then unread_count + 1 else unread_count end
  where id = new.conversation_id;
  return new;
end;
$$;

-- Aprovecha que se está tocando esta función para fijar su search_path,
-- misma buena práctica ya aplicada a las funciones de attention_events en
-- 0013_attention_events_search_path.sql.
alter function public.handle_new_message() set search_path = public;
