create table public.login_attempts (
  id bigserial primary key,
  identifier text not null,
  ip text not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index login_attempts_identifier_idx on public.login_attempts (identifier, created_at);
create index login_attempts_ip_idx on public.login_attempts (ip, created_at);

alter table public.login_attempts enable row level security;
-- Sin políticas: ni anon ni authenticated pueden leer/escribir esta tabla.
-- Solo el cliente service-role (que ignora RLS) accede, desde el Server
-- Action de login — igual que admin.ts ya hace para otros usos privilegiados.
