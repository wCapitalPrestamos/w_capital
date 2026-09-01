-- La "solicitud de crédito" y la "autorización de consulta en Buró de
-- Crédito" no son documentos que el cliente suba — son autorizaciones que
-- acepta con un check. Se registran por separado (cada una con su propia
-- marca de tiempo como evidencia) en vez de como filas en `documents`.
alter table public.loan_applications
  add column credit_authorization_accepted_at timestamptz,
  add column bureau_authorization_accepted_at timestamptz;
