-- Más tipos de garantía: maquinaria/equipo y "otra" (se especifica en la descripción)

alter table public.loan_applications
  drop constraint loan_applications_collateral_type_check;

alter table public.loan_applications
  add constraint loan_applications_collateral_type_check
  check (collateral_type in ('property', 'car', 'machinery', 'other'));
