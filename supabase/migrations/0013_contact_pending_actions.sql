-- Mecanismo de "pendiente" para flujos de botones interactivos que no
-- dependen de una solicitud (ej. menú de "Info") — separado del que ya
-- existe en loan_applications para el flujo de tipo de préstamo, para no
-- tocar ese flujo ya probado en producción.
alter table public.contacts
  add column pending_resume_url text,
  add column pending_resume_expires_at timestamptz,
  add column pending_resume_kind text check (pending_resume_kind in ('info_menu'));
