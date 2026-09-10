-- El linter de Supabase marca auth.uid() suelto en una policy como
-- re-evaluado por cada fila; (select auth.uid()) lo evalúa una sola vez.
drop policy "own notifications" on public.notifications;
create policy "own notifications" on public.notifications
  for all using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
