-- Mensajes de sistema dentro del chat compradora-vendedora — inspirado en
-- cómo Vinted mete el historial de la orden (comprado, preparando, plazo de
-- envío, despachado) directo en la conversación en vez de vivir aparte en
-- "mis compras". Se insertan con el cliente service-role (createAdminClient)
-- en los mismos puntos donde ya cambia el estado de la orden — ver
-- src/lib/orderNotifications.ts (sendSystemMessage) y sus llamadas en
-- finalizeOrderPaid, ship/route.ts y orders/[id]/confirm/route.ts.
alter table public.messages add column is_system boolean not null default false;
