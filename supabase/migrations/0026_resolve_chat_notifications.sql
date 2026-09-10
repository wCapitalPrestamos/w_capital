-- Al resolver la atención de una conversación (resolveNeedsHuman), también
-- limpia las notificaciones de chat asociadas para que no se queden "sin
-- leer" indefinidamente en la campana ni bloqueen el aviso anti-duplicado en
-- /api/n8n/handoff (que solo re-notifica si no hay una fila unread para esa
-- conversación).
create or replace function public.resolve_chat_notifications(p_conversation_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.notifications
  set read_at = now()
  where entity_type = 'conversation'
    and entity_id = p_conversation_id
    and type in ('chat_human_requested', 'chat_stale', 'chat_unassigned_new_message')
    and read_at is null;
$$;
