-- W Capital CRM — esquema inicial
-- Identificadores en inglés; etiquetas en español viven en la UI (src/lib/labels.ts)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Identidad del staff
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  role text not null default 'advisor' check (role in ('admin', 'advisor', 'analyst')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'advisor')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at genérico
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mensajería (WhatsApp + Messenger vía n8n)
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  phone text,
  wa_id text unique,
  messenger_psid text unique,
  email text,
  address text,
  notes text,
  source_channel text not null default 'whatsapp'
    check (source_channel in ('whatsapp', 'messenger', 'referral', 'walk_in', 'other')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  channel text not null check (channel in ('whatsapp', 'messenger')),
  external_thread_id text not null,
  status text not null default 'bot' check (status in ('bot', 'human', 'closed')),
  assigned_to uuid references public.profiles (id),
  bot_paused_until timestamptz,
  last_message_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_preview text not null default '',
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (channel, external_thread_id)
);

create index conversations_order_idx on public.conversations (last_message_at desc);
create index conversations_contact_idx on public.conversations (contact_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound')),
  sender_type text not null check (sender_type in ('client', 'bot', 'agent')),
  sender_profile_id uuid references public.profiles (id),
  message_type text not null default 'text'
    check (message_type in ('text', 'image', 'audio', 'video', 'document', 'location', 'template', 'sticker', 'other')),
  body text not null default '',
  media_url text,
  media_storage_path text,
  external_message_id text unique,
  status text not null default 'received'
    check (status in ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  error_detail text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_thread_idx on public.messages (conversation_id, created_at);

-- Rollups de la conversación al insertar mensaje
create or replace function public.handle_new_message()
returns trigger language plpgsql as $$
begin
  update public.conversations
  set
    last_message_at = coalesce(new.sent_at, new.created_at),
    last_preview = left(coalesce(nullif(new.body, ''), '[' || new.message_type || ']'), 120),
    last_inbound_at = case when new.direction = 'inbound'
      then coalesce(new.sent_at, new.created_at) else last_inbound_at end,
    unread_count = case when new.direction = 'inbound'
      then unread_count + 1 else unread_count end
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function public.handle_new_message();

-- ---------------------------------------------------------------------------
-- Pipeline de ventas
-- ---------------------------------------------------------------------------

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  stage text not null default 'new'
    check (stage in ('new', 'contacted', 'interested', 'applying', 'discarded')),
  interest_amount numeric(12, 2),
  assigned_to uuid references public.profiles (id),
  discard_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_stage_idx on public.leads (stage);
create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

create table public.loan_applications (
  id uuid primary key default gen_random_uuid(),
  folio int generated always as identity,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  lead_id uuid references public.leads (id),
  requested_amount numeric(12, 2),
  term_weeks int,
  purpose text,
  collateral_type text check (collateral_type in ('property', 'car')),
  collateral_description text,
  has_aval boolean not null default false,
  aval_name text,
  aval_phone text,
  status text not null default 'draft'
    check (status in ('draft', 'docs_pending', 'under_review', 'approved', 'rejected', 'disbursed', 'cancelled')),
  approved_amount numeric(12, 2),
  approved_term_weeks int,
  weekly_rate numeric(6, 4) not null default 0.0197,
  advisor_id uuid references public.profiles (id),
  analyst_id uuid references public.profiles (id),
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loan_applications_status_idx on public.loan_applications (status);
create index loan_applications_contact_idx on public.loan_applications (contact_id);
create trigger loan_applications_updated_at before update on public.loan_applications
  for each row execute function public.set_updated_at();

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index ash_application_idx on public.application_status_history (application_id, created_at);

create or replace function public.handle_application_status_change()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger loan_applications_status_history
  after insert or update on public.loan_applications
  for each row execute function public.handle_application_status_change();

-- ---------------------------------------------------------------------------
-- Documentos y portal de subida
-- ---------------------------------------------------------------------------

create table public.upload_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  application_id uuid not null references public.loan_applications (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  revoked_at timestamptz,
  created_by uuid references public.profiles (id),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.loan_applications (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  doc_type text not null check (doc_type in (
    'credit_application', 'bureau_authorization', 'ine', 'proof_of_address',
    'proof_of_income', 'bank_statement', 'collateral', 'aval_ine', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null default 0,
  uploaded_via text not null default 'staff' check (uploaded_via in ('portal', 'staff')),
  upload_token_id uuid references public.upload_tokens (id),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index documents_application_idx on public.documents (application_id);

-- ---------------------------------------------------------------------------
-- Servicing de préstamos
-- ---------------------------------------------------------------------------

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  folio int generated always as identity,
  application_id uuid not null unique references public.loan_applications (id),
  contact_id uuid not null references public.contacts (id),
  principal numeric(12, 2) not null,
  weekly_rate numeric(6, 4) not null,
  term_weeks int not null,
  weekly_payment numeric(12, 2) not null,
  disbursed_at date not null,
  first_payment_date date not null,
  status text not null default 'active'
    check (status in ('active', 'paid_off', 'overdue', 'written_off')),
  created_at timestamptz not null default now()
);

create index loans_status_idx on public.loans (status);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  number int not null,
  due_date date not null,
  principal_due numeric(12, 2) not null,
  interest_due numeric(12, 2) not null,
  total_due numeric(12, 2) not null,
  paid_amount numeric(12, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'paid', 'overdue')),
  paid_at date,
  unique (loan_id, number)
);

create index installments_due_idx on public.installments (due_date, status);
create index installments_loan_idx on public.installments (loan_id, number);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  paid_on date not null,
  method text not null default 'cash' check (method in ('cash', 'transfer', 'deposit')),
  reference text,
  received_by uuid references public.profiles (id),
  note text,
  created_at timestamptz not null default now()
);

create index payments_loan_idx on public.payments (loan_id, paid_on);

create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete cascade,
  installment_id uuid not null references public.installments (id) on delete cascade,
  interest_amount numeric(12, 2) not null default 0,
  principal_amount numeric(12, 2) not null default 0
);

create index payment_allocations_payment_idx on public.payment_allocations (payment_id);

-- ---------------------------------------------------------------------------
-- Soporte
-- ---------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null
);

insert into public.app_settings (key, value) values
  ('default_weekly_rate', '0.0197'),
  ('handoff_pause_hours', '4'),
  ('semaphore', '{"yellow_days": 1, "red_days": 8, "red_overdue_installments": 2}'),
  ('office_hours', '{"weekdays": "9:00-17:30", "saturday": "9:00-13:00"}');

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'n8n',
  external_id text,
  payload jsonb not null,
  processed boolean not null default false,
  error text,
  created_at timestamptz not null default now()
);

create index webhook_events_created_idx on public.webhook_events (created_at desc);

-- ---------------------------------------------------------------------------
-- RPCs transaccionales (la app calcula; el RPC garantiza atomicidad)
-- ---------------------------------------------------------------------------

-- Desembolso: crea préstamo + calendario y marca la solicitud como desembolsada.
-- p_installments: [{number, due_date, principal_due, interest_due, total_due}, ...]
create or replace function public.create_loan_with_schedule(
  p_application_id uuid,
  p_principal numeric,
  p_weekly_rate numeric,
  p_term_weeks int,
  p_weekly_payment numeric,
  p_disbursed_at date,
  p_first_payment_date date,
  p_installments jsonb
) returns uuid
language plpgsql
as $$
declare
  v_contact_id uuid;
  v_loan_id uuid;
  v_status text;
begin
  select contact_id, status into v_contact_id, v_status
  from public.loan_applications where id = p_application_id for update;

  if v_contact_id is null then
    raise exception 'application not found';
  end if;
  if v_status <> 'approved' then
    raise exception 'application must be approved before disbursement (status: %)', v_status;
  end if;

  insert into public.loans (
    application_id, contact_id, principal, weekly_rate, term_weeks,
    weekly_payment, disbursed_at, first_payment_date
  ) values (
    p_application_id, v_contact_id, p_principal, p_weekly_rate, p_term_weeks,
    p_weekly_payment, p_disbursed_at, p_first_payment_date
  ) returning id into v_loan_id;

  insert into public.installments (loan_id, number, due_date, principal_due, interest_due, total_due)
  select
    v_loan_id,
    (i ->> 'number')::int,
    (i ->> 'due_date')::date,
    (i ->> 'principal_due')::numeric,
    (i ->> 'interest_due')::numeric,
    (i ->> 'total_due')::numeric
  from jsonb_array_elements(p_installments) as i;

  update public.loan_applications set status = 'disbursed' where id = p_application_id;

  return v_loan_id;
end;
$$;

-- Registro de pago: pago + asignaciones + actualización de cuotas y del préstamo.
-- p_allocations: [{installment_id, interest_amount, principal_amount}, ...]
create or replace function public.record_payment(
  p_loan_id uuid,
  p_amount numeric,
  p_paid_on date,
  p_method text,
  p_reference text,
  p_note text,
  p_allocations jsonb
) returns uuid
language plpgsql
as $$
declare
  v_payment_id uuid;
  v_alloc jsonb;
  v_installment_id uuid;
  v_applied numeric;
  v_total_allocated numeric := 0;
  v_remaining int;
begin
  perform 1 from public.loans where id = p_loan_id for update;
  if not found then
    raise exception 'loan not found';
  end if;

  insert into public.payments (loan_id, amount, paid_on, method, reference, received_by, note)
  values (p_loan_id, p_amount, p_paid_on, p_method, p_reference, auth.uid(), p_note)
  returning id into v_payment_id;

  for v_alloc in select * from jsonb_array_elements(p_allocations) loop
    v_installment_id := (v_alloc ->> 'installment_id')::uuid;
    v_applied := coalesce((v_alloc ->> 'interest_amount')::numeric, 0)
               + coalesce((v_alloc ->> 'principal_amount')::numeric, 0);
    v_total_allocated := v_total_allocated + v_applied;

    insert into public.payment_allocations (payment_id, installment_id, interest_amount, principal_amount)
    values (
      v_payment_id, v_installment_id,
      coalesce((v_alloc ->> 'interest_amount')::numeric, 0),
      coalesce((v_alloc ->> 'principal_amount')::numeric, 0)
    );

    update public.installments
    set
      paid_amount = paid_amount + v_applied,
      status = case
        when paid_amount + v_applied >= total_due then 'paid'
        when due_date < p_paid_on then 'overdue'
        else 'partial'
      end,
      paid_at = case when paid_amount + v_applied >= total_due then p_paid_on else paid_at end
    where id = v_installment_id and loan_id = p_loan_id;

    if not found then
      raise exception 'installment % does not belong to loan', v_installment_id;
    end if;
  end loop;

  if round(v_total_allocated, 2) <> round(p_amount, 2) then
    raise exception 'allocations (%) do not match payment amount (%)', v_total_allocated, p_amount;
  end if;

  -- Estado del préstamo: liquidado si ya no hay cuotas pendientes
  select count(*) into v_remaining
  from public.installments
  where loan_id = p_loan_id and status <> 'paid';

  update public.loans
  set status = case
    when v_remaining = 0 then 'paid_off'
    when exists (
      select 1 from public.installments
      where loan_id = p_loan_id and status = 'overdue'
    ) then 'overdue'
    else 'active'
  end
  where id = p_loan_id;

  return v_payment_id;
end;
$$;

-- Cron diario de mora (lo invoca /api/cron/overdue con service role)
create or replace function public.mark_overdue(p_today date)
returns int
language plpgsql
as $$
declare
  v_count int;
begin
  update public.installments
  set status = 'overdue'
  where due_date < p_today and status in ('pending', 'partial');
  get diagnostics v_count = row_count;

  update public.loans l
  set status = 'overdue'
  where l.status = 'active'
    and exists (select 1 from public.installments i where i.loan_id = l.id and i.status = 'overdue');

  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage: bucket privado de documentos
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Realtime para el inbox
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.conversations;
