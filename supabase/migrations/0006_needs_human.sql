-- Bandera independiente del status bot/humano: marca conversaciones que el
-- bot no pudo responder, sin pausarlo (sigue contestando lo demás normal).

alter table public.conversations
  add column needs_human boolean not null default false;
