-- El panel de "Contexto del cliente" en el inbox (ContextRail) se renderizaba
-- una sola vez en el servidor y nunca se actualizaba en vivo: si llegaba un
-- documento nuevo, cambiaba el estatus de la solicitud, o se registraba un
-- pago mientras el asesor tenía la conversación abierta, el panel se quedaba
-- desactualizado hasta navegar a otra conversación y volver.
--
-- Se agregan loan_applications y documents (ambas tienen contact_id propio,
-- así que el cliente puede filtrar la suscripción por cliente) y loans, que
-- alimenta v_loan_balances — Realtime no puede suscribirse directamente a
-- una vista, así que el cliente escucha loans y vuelve a pedir la vista.
--
-- payments/installments/payment_allocations NO se agregan: no tienen
-- contact_id propio (no se pueden filtrar por cliente en el filtro de
-- Realtime), y record_payment/mark_overdue ya actualizan la fila de loans
-- afectada en todos los casos — loans es señal suficiente.

alter publication supabase_realtime add table public.loan_applications;
alter publication supabase_realtime add table public.documents;
alter publication supabase_realtime add table public.loans;
