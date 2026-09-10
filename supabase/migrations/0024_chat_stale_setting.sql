-- Umbral (en minutos) para el aviso de "chat sin respuesta" (Evento B del
-- sistema de notificaciones) — mismo mecanismo que handoff_pause_hours,
-- ajustable sin desplegar código.

insert into public.app_settings (key, value) values
  ('chat_stale_minutes', '30');
