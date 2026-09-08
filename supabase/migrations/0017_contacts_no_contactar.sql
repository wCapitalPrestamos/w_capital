-- Bandera de "no contactar": cuando alguien pide explícitamente que dejen de
-- escribirle, el personal la activa aquí y se respeta en cualquier envío
-- proactivo (recordatorios automáticos, y cualquier futuro envío masivo) —
-- requisito tanto de la LFPDPPP (revocación de consentimiento) como de las
-- políticas de WhatsApp/Messenger sobre solicitudes de no contacto.
alter table public.contacts
  add column no_contactar boolean not null default false;
