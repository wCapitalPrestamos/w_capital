alter table public.messages
  add column reply_to_message_id uuid references public.messages (id) on delete set null;
