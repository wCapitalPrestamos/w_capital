-- W Capital CRM — Row Level Security
-- Modelo v1: todo el staff activo lee/escribe las tablas de negocio.
-- Acciones sensibles por rol se refuerzan en server actions + 2 políticas duras aquí.
-- n8n y el portal público NUNCA tocan la base directamente: pasan por rutas API
-- del CRM que usan el service role (que ignora RLS).

-- Helper: ¿el usuario autenticado es staff activo?
create or replace function public.is_staff()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and active
  );
$$;

-- Helper: rol del usuario autenticado
create or replace function public.current_role_name()
returns text
language sql
security definer set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and active;
$$;

-- ---------------------------------------------------------------------------
-- profiles: cada quien ve a todo el staff; solo admin modifica
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "staff can read profiles" on public.profiles
  for select using (public.is_staff());

create policy "admin can insert profiles" on public.profiles
  for insert with check (public.current_role_name() = 'admin');

create policy "admin can update profiles" on public.profiles
  for update using (public.current_role_name() = 'admin');

-- ---------------------------------------------------------------------------
-- Tablas de negocio: acceso amplio para staff activo (sin DELETE)
-- ---------------------------------------------------------------------------

alter table public.contacts enable row level security;
create policy "staff full access" on public.contacts
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.conversations enable row level security;
create policy "staff full access" on public.conversations
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.messages enable row level security;
create policy "staff full access" on public.messages
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.leads enable row level security;
create policy "staff full access" on public.leads
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.loan_applications enable row level security;
create policy "staff read" on public.loan_applications
  for select using (public.is_staff());
create policy "staff insert" on public.loan_applications
  for insert with check (public.is_staff());
-- Política dura: aprobar/rechazar solo admin o analista
create policy "staff update" on public.loan_applications
  for update using (public.is_staff())
  with check (
    status not in ('approved', 'rejected')
    or public.current_role_name() in ('admin', 'analyst')
  );

alter table public.application_status_history enable row level security;
create policy "staff read" on public.application_status_history
  for select using (public.is_staff());
create policy "staff insert" on public.application_status_history
  for insert with check (public.is_staff());

alter table public.upload_tokens enable row level security;
create policy "staff full access" on public.upload_tokens
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.documents enable row level security;
create policy "staff full access" on public.documents
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.loans enable row level security;
create policy "staff full access" on public.loans
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.installments enable row level security;
create policy "staff full access" on public.installments
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.payments enable row level security;
create policy "staff full access" on public.payments
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.payment_allocations enable row level security;
create policy "staff full access" on public.payment_allocations
  for all using (public.is_staff()) with check (public.is_staff());

alter table public.app_settings enable row level security;
create policy "staff read" on public.app_settings
  for select using (public.is_staff());
create policy "admin write" on public.app_settings
  for all using (public.current_role_name() = 'admin')
  with check (public.current_role_name() = 'admin');

alter table public.webhook_events enable row level security;
create policy "staff read" on public.webhook_events
  for select using (public.is_staff());

-- Storage: sin políticas para anon/authenticated. Toda subida/descarga usa
-- URLs firmadas emitidas por el servidor (service role), que no requieren RLS.

-- ---------------------------------------------------------------------------
-- Privilegios de esquema (RLS sigue aplicando encima de estos GRANTs)
-- ---------------------------------------------------------------------------

grant usage on schema public to authenticated, service_role;

-- service_role: acceso total (ignora RLS por diseño; solo vive en el servidor)
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- authenticated (staff): sin DELETE — los estados se manejan con columnas
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public
  grant select, insert, update on tables to authenticated;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;
