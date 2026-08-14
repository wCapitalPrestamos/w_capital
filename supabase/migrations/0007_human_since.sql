-- Marca desde cuándo una conversación pasó a status "human", para poder
-- mostrar "tomada hace X" y detectar conversaciones olvidadas en Atender.

alter table public.conversations
  add column human_since timestamptz;
