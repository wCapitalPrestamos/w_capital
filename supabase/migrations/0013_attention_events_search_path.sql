-- Fija search_path en las funciones nuevas del trigger de attention events
-- (buena práctica recomendada por el linter de Supabase para SECURITY DEFINER
-- / funciones de trigger; no se toca el resto de funciones legadas del
-- proyecto que ya tenían esta misma advertencia antes de esta migración).

alter function public.handle_attention_event_insert() set search_path = public;
alter function public.handle_attention_event_resolve() set search_path = public;
