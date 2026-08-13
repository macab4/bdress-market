-- Las notificaciones de ofertas se insertan directamente desde las rutas de
-- API (a diferencia de "nueva prenda de alguien que sigues", que usa un
-- trigger), así que necesitan una política de insert: cualquiera puede crear
-- una notificación en nombre de sí misma como actor_id (quien hizo la acción),
-- para otra usuaria (user_id, quien la recibe).
create policy "Usuaria crea notificación como actor" on public.notifications
  for insert with check (auth.uid() = actor_id);
