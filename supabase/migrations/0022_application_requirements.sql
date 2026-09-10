-- Requisitos obligatorios para avanzar una solicitud, centralizados en SQL
-- para que la misma fuente de verdad sirva para (a) bloquear la transición
-- docs_pending → under_review en changeApplicationStatus, (b) validar antes
-- de desembolsar en disburseLoan, y (c) disparar la notificación de
-- "documentación completa" cuando el cliente termina de subir sus archivos.

-- Contrato firmado: nuevo tipo de documento, distinto de los que sube el
-- cliente durante la solicitud — se sube ya con la solicitud aprobada.
alter table public.documents drop constraint documents_doc_type_check;
alter table public.documents add constraint documents_doc_type_check
  check (doc_type in (
    'credit_application', 'bureau_authorization', 'ine', 'proof_of_address',
    'proof_of_income', 'bank_statement', 'collateral', 'aval_ine',
    'signed_contract', 'other'));

-- Datos bancarios para el desembolso — texto libre por ahora (el negocio
-- aún no define un formato único de captura; se puede normalizar después
-- sin romper nada, ya que sigue siendo un solo campo de texto).
alter table public.loan_applications
  add column bank_account_details text;

-- Documentos requeridos según el tipo de solicitud — solo lo que el cliente
-- controla desde el portal de subida, sin tocar campos que llena la Asesora.
--
-- Nota: los "append" usan array_append(...) en vez de `v_missing || 'x'`
-- a propósito — con un texto plano del lado derecho, el operador `||` es
-- ambiguo entre "concatenar arreglos" y "agregar elemento", y Postgres
-- intenta parsear el string como literal de arreglo (error en runtime).
create or replace function public.application_missing_documents(p_application_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_app record;
  v_missing text[] := '{}';
  v_has_doc boolean;
begin
  select collateral_type, has_aval into v_app
  from public.loan_applications where id = p_application_id;

  if not found then
    return array['application_not_found'];
  end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id and doc_type = 'ine'
  ) into v_has_doc;
  if not v_has_doc then v_missing := array_append(v_missing, 'ine'); end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id and doc_type = 'proof_of_address'
  ) into v_has_doc;
  if not v_has_doc then v_missing := array_append(v_missing, 'proof_of_address'); end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id
      and doc_type in ('proof_of_income', 'bank_statement')
  ) into v_has_doc;
  if not v_has_doc then v_missing := array_append(v_missing, 'proof_of_income_or_bank_statement'); end if;

  if v_app.collateral_type is not null then
    select exists(
      select 1 from public.documents
      where application_id = p_application_id and doc_type = 'collateral'
    ) into v_has_doc;
    if not v_has_doc then v_missing := array_append(v_missing, 'collateral'); end if;
  end if;

  if v_app.has_aval then
    select exists(
      select 1 from public.documents
      where application_id = p_application_id and doc_type = 'aval_ine'
    ) into v_has_doc;
    if not v_has_doc then v_missing := array_append(v_missing, 'aval_ine'); end if;
  end if;

  return v_missing;
end;
$$;

-- Igual que el anterior, pero exige review_status = 'approved' en vez de
-- solo "subido" — para el gate de desembolso, más estricto.
create or replace function public.application_missing_approved_documents(p_application_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_app record;
  v_missing text[] := '{}';
  v_ok boolean;
begin
  select collateral_type, has_aval into v_app
  from public.loan_applications where id = p_application_id;

  if not found then
    return array['application_not_found'];
  end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id and doc_type = 'ine' and review_status = 'approved'
  ) into v_ok;
  if not v_ok then v_missing := array_append(v_missing, 'ine'); end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id and doc_type = 'proof_of_address' and review_status = 'approved'
  ) into v_ok;
  if not v_ok then v_missing := array_append(v_missing, 'proof_of_address'); end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id
      and doc_type in ('proof_of_income', 'bank_statement') and review_status = 'approved'
  ) into v_ok;
  if not v_ok then v_missing := array_append(v_missing, 'proof_of_income_or_bank_statement'); end if;

  if v_app.collateral_type is not null then
    select exists(
      select 1 from public.documents
      where application_id = p_application_id and doc_type = 'collateral' and review_status = 'approved'
    ) into v_ok;
    if not v_ok then v_missing := array_append(v_missing, 'collateral'); end if;
  end if;

  if v_app.has_aval then
    select exists(
      select 1 from public.documents
      where application_id = p_application_id and doc_type = 'aval_ine' and review_status = 'approved'
    ) into v_ok;
    if not v_ok then v_missing := array_append(v_missing, 'aval_ine'); end if;
  end if;

  select exists(
    select 1 from public.documents
    where application_id = p_application_id and doc_type = 'signed_contract' and review_status = 'approved'
  ) into v_ok;
  if not v_ok then v_missing := array_append(v_missing, 'signed_contract'); end if;

  return v_missing;
end;
$$;

-- Campos de la solicitud/contacto que la Asesora debe capturar (no son
-- documentos) antes de mandarla a revisión.
create or replace function public.application_missing_fields(p_application_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_app record;
  v_contact record;
  v_missing text[] := '{}';
begin
  select * into v_app from public.loan_applications where id = p_application_id;
  if not found then
    return array['application_not_found'];
  end if;
  select * into v_contact from public.contacts where id = v_app.contact_id;

  if v_contact.full_name is null or btrim(v_contact.full_name) = '' then
    v_missing := array_append(v_missing, 'contact_full_name');
  end if;
  if v_contact.phone is null or btrim(v_contact.phone) = '' then
    v_missing := array_append(v_missing, 'contact_phone');
  end if;
  if v_app.borrower_type is null then
    v_missing := array_append(v_missing, 'borrower_type');
  end if;
  if v_app.borrower_type = 'business' and (v_app.business_name is null or btrim(v_app.business_name) = '') then
    v_missing := array_append(v_missing, 'business_name');
  end if;
  if v_app.requested_amount is null or v_app.requested_amount <= 0 then
    v_missing := array_append(v_missing, 'requested_amount');
  end if;
  if v_app.collateral_type is null then
    v_missing := array_append(v_missing, 'collateral_type');
  end if;
  if v_app.collateral_type is not null and (v_app.collateral_description is null or btrim(v_app.collateral_description) = '') then
    v_missing := array_append(v_missing, 'collateral_description');
  end if;
  if v_app.has_aval and (v_app.aval_name is null or btrim(v_app.aval_name) = '') then
    v_missing := array_append(v_missing, 'aval_name');
  end if;
  if v_app.has_aval and (v_app.aval_phone is null or btrim(v_app.aval_phone) = '') then
    v_missing := array_append(v_missing, 'aval_phone');
  end if;
  if v_app.credit_authorization_accepted_at is null then
    v_missing := array_append(v_missing, 'credit_authorization');
  end if;
  if v_app.bureau_authorization_accepted_at is null then
    v_missing := array_append(v_missing, 'bureau_authorization');
  end if;

  return v_missing;
end;
$$;

-- Gate completo para docs_pending → under_review: campos + documentos subidos.
create or replace function public.application_missing_requirements(p_application_id uuid)
returns text[]
language sql
security definer
set search_path = public
stable
as $$
  select public.application_missing_fields(p_application_id)
    || public.application_missing_documents(p_application_id);
$$;

-- Gate completo para el desembolso: todo lo anterior + cuenta bancaria +
-- documentos con review_status = 'approved' (incluye el contrato firmado).
create or replace function public.application_missing_disbursement_requirements(p_application_id uuid)
returns text[]
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_missing text[];
  v_bank text;
begin
  v_missing := public.application_missing_fields(p_application_id)
    || public.application_missing_approved_documents(p_application_id);

  select bank_account_details into v_bank
  from public.loan_applications where id = p_application_id;
  if v_bank is null or btrim(v_bank) = '' then
    v_missing := array_append(v_missing, 'bank_account_details');
  end if;

  return v_missing;
end;
$$;
