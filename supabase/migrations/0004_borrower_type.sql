-- Tipo de acreditado: préstamo personal o para la empresa/negocio del contacto

alter table public.loan_applications
  add column borrower_type text not null default 'personal'
    check (borrower_type in ('personal', 'business')),
  add column business_name text;
