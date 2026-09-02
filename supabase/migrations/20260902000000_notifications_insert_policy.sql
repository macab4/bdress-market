-- Bug real encontrado en auditoría: la tabla notifications tiene RLS
-- activado pero nunca tuvo policy de INSERT (solo select/update) — los
-- inserts hechos con el cliente normal (offer_received, offer_countered,
-- offer_accepted, offer_rejected, withdrawal_requested, label_requested en
-- src/app/api/offers/[id]/respond/route.ts, listings/[id]/offers/route.ts,
-- wallet/withdrawals/route.ts, orders/[id]/generate-label/route.ts) venían
-- fallando en silencio desde siempre (ningún insert revisa el error).
-- Los que usan el cliente admin (sale_paid, referral_bonus) y el trigger
-- new_listing sí funcionaban porque bypasean RLS.
--
-- actor_id siempre es quien ejecuta la acción (auth.uid()) en todos los
-- puntos de inserción existentes, así que ese es el check correcto —
-- misma vendedora/compradora nunca puede insertar una notificación
-- "de parte de" otra persona.
create policy "Usuaria crea notificaciones donde es la actora" on public.notifications
  for insert with check (auth.uid() = actor_id);
