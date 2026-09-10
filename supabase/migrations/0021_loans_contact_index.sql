-- loans.contact_id se consulta directo (ficha de cliente, y ahora el panel
-- de contexto en vivo del inbox vía v_loan_balances) pero, a diferencia de
-- conversations/loan_applications/documents, nunca tuvo su índice — cada
-- consulta hacía sequential scan sobre toda la tabla.

create index if not exists loans_contact_idx on public.loans (contact_id);
