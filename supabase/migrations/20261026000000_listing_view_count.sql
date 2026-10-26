-- Etapa 2 del ranking de catálogo (ver plan): "popularidad" hoy solo tenía
-- favoritos como señal — esto agrega un contador de vistas real por prenda,
-- para que "Recomendados" y "Más populares" puedan usarlo. Incremento vía
-- RPC security definer (no vía RLS normal) porque cualquier visitante sin
-- sesión también tiene que poder sumar una vista, y la política de UPDATE de
-- listings solo deja editar a la propia vendedora.
alter table public.listings add column if not exists view_count integer not null default 0;

create or replace function public.increment_listing_view(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.listings set view_count = view_count + 1 where id = p_listing_id;
end;
$$;

grant execute on function public.increment_listing_view(uuid) to authenticated, anon;
