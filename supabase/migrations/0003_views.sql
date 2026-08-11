-- W Capital CRM — vistas del dashboard
-- security_invoker: las vistas respetan RLS (solo staff autenticado)

-- Saldos por préstamo
create view public.v_loan_balances
with (security_invoker = true) as
select
  l.id as loan_id,
  l.folio,
  l.contact_id,
  l.status,
  l.principal,
  l.weekly_payment,
  l.disbursed_at,
  coalesce(pp.principal_paid, 0) as principal_paid,
  l.principal - coalesce(pp.principal_paid, 0) as outstanding_principal,
  ov.overdue_count,
  ov.overdue_amount,
  ov.oldest_overdue_date,
  case
    when ov.oldest_overdue_date is null then 0
    else (current_date - ov.oldest_overdue_date)
  end as days_late
from public.loans l
left join lateral (
  select coalesce(sum(pa.principal_amount), 0) as principal_paid
  from public.payments p
  join public.payment_allocations pa on pa.payment_id = p.id
  where p.loan_id = l.id
) pp on true
left join lateral (
  select
    count(*) filter (where i.status = 'overdue') as overdue_count,
    coalesce(sum(i.total_due - i.paid_amount) filter (where i.status = 'overdue'), 0) as overdue_amount,
    min(i.due_date) filter (where i.status = 'overdue') as oldest_overdue_date
  from public.installments i
  where i.loan_id = l.id
) ov on true;

-- Cartera activa y en riesgo (PAR)
create view public.v_active_portfolio
with (security_invoker = true) as
select
  count(*) filter (where status in ('active', 'overdue')) as active_loans,
  coalesce(sum(outstanding_principal) filter (where status in ('active', 'overdue')), 0) as total_outstanding,
  coalesce(sum(outstanding_principal) filter (where status = 'overdue'), 0) as overdue_outstanding,
  case
    when coalesce(sum(outstanding_principal) filter (where status in ('active', 'overdue')), 0) = 0 then 0
    else round(
      coalesce(sum(outstanding_principal) filter (where status = 'overdue'), 0)
      / sum(outstanding_principal) filter (where status in ('active', 'overdue')) * 100, 2)
  end as par_percent
from public.v_loan_balances;

-- Desembolsos por mes (últimos 12)
create view public.v_disbursed_monthly
with (security_invoker = true) as
select
  date_trunc('month', disbursed_at)::date as month,
  count(*) as loans_count,
  sum(principal) as total_disbursed
from public.loans
where disbursed_at >= date_trunc('month', current_date) - interval '11 months'
group by 1
order by 1;

-- Cobranza semanal: esperado vs cobrado (últimas 12 semanas)
create view public.v_weekly_collection
with (security_invoker = true) as
with weeks as (
  select generate_series(
    date_trunc('week', current_date) - interval '11 weeks',
    date_trunc('week', current_date),
    interval '1 week'
  )::date as week_start
)
select
  w.week_start,
  coalesce((
    select sum(i.total_due) from public.installments i
    where i.due_date >= w.week_start and i.due_date < w.week_start + 7
  ), 0) as expected,
  coalesce((
    select sum(p.amount) from public.payments p
    where p.paid_on >= w.week_start and p.paid_on < w.week_start + 7
  ), 0) as collected
from weeks w
order by w.week_start;

-- Funnel de conversión
create view public.v_funnel
with (security_invoker = true) as
select
  (select count(*) from public.contacts) as contacts,
  (select count(*) from public.leads where stage <> 'discarded') as leads,
  (select count(*) from public.loan_applications where status <> 'cancelled') as applications,
  (select count(*) from public.loan_applications where status in ('approved', 'disbursed')) as approved,
  (select count(*) from public.loans) as disbursed;

-- Contactos por canal de origen
create view public.v_channel_breakdown
with (security_invoker = true) as
select source_channel, count(*) as contacts
from public.contacts
group by source_channel
order by contacts desc;
