-- conversation_attention_events (0012) nunca se agregó a la publicación de
-- Realtime, así que el suscriptor de Thread (postgres_changes sobre esta
-- tabla) nunca disparaba en producción: el contador agregado en
-- conversations (needs_human/open_attention_count) sí llega en vivo, pero
-- el marcador por mensaje y "Ir al pendiente" se quedaban desactualizados
-- hasta el resync por cambio de pestaña.

alter publication supabase_realtime add table public.conversation_attention_events;
