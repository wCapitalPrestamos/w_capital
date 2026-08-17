-- Recordatorio de documentos pendientes: máximo 2 por solicitud, espaciados
-- (24h desde la solicitud, y 48h más desde el primer recordatorio), en vez
-- de un solo flag de "ya se mandó". `drop ... if exists` cubre el caso de
-- que 0008 ya se haya aplicado.

alter table public.loan_applications
  drop column if exists reminder_sent_at;

alter table public.loan_applications
  add column reminder_count int not null default 0,
  add column last_reminder_sent_at timestamptz;
