-- Marca si ya se mandó el recordatorio de "te faltan documentos" para una
-- solicitud, para no mandarlo más de una vez.

alter table public.loan_applications
  add column reminder_sent_at timestamptz;
