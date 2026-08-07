-- ============================================================
-- Migración: modelo de marca canónica (brand_id) — reemplaza depender
-- solo del texto libre `listings.brand` para identidad de marca.
--
-- 100% aditiva y compatible hacia atrás: `listings.brand` NO se toca ni se
-- borra. `listings.brand_id` queda nullable — el resto del código sigue
-- funcionando exactamente igual hasta que se migre cada lectura una por
-- una (ver commits siguientes). El backfill real (crear brands/aliases y
-- asignar brand_id a los listings existentes) se hace con un script
-- aparte (scripts puntuales en supabase/, no en esta migración) porque
-- necesita la lógica de agrupación de src/lib/brands.ts, no solo SQL.
--
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================

create table public.brands (
  id               uuid default gen_random_uuid() primary key,
  display_name     text not null,
  slug             text not null unique,
  -- Clave de identidad: minúsculas, sin espacios/guiones/guion bajo, SIN
  -- normalizar acentos — dos marcas que solo difieren en acentos (ej. Maje
  -- vs Majé) deben quedar con normalized_name distinto adrede, para que
  -- nunca se fusionen automáticamente solo por eso (ver src/lib/brands.ts).
  normalized_name  text not null unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index brands_normalized_name_idx on public.brands (normalized_name);

alter table public.brands enable row level security;
create policy "Marcas visibles para todas" on public.brands
  for select using (true);
-- Sin policies de insert/update/delete: toda escritura de brands pasa por
-- /api/brands/** (resolver-o-crear) y /api/admin/brands/** (renombrar,
-- alias, fusionar) con el cliente service-role — así se puede validar
-- duplicados antes de escribir y no cualquiera puede editar el catálogo
-- de marcas directo desde el cliente.

create table public.brand_aliases (
  id                uuid default gen_random_uuid() primary key,
  brand_id          uuid references public.brands(id) on delete cascade not null,
  -- El texto exacto tal como quedó escrito en algún listing — único a
  -- nivel global: la misma grafía nunca puede apuntar a dos marcas
  -- distintas a la vez (eso sería un conflicto real de identidad).
  alias             text not null unique,
  -- Igual que brands.normalized_name — sirve para detectar candidatos al
  -- buscar/autocompletar, no define identidad por sí sola.
  normalized_alias  text not null,
  created_at        timestamptz not null default now()
);
create index brand_aliases_brand_id_idx on public.brand_aliases (brand_id);
create index brand_aliases_normalized_alias_idx on public.brand_aliases (normalized_alias);

alter table public.brand_aliases enable row level security;
create policy "Alias de marca visibles para todas" on public.brand_aliases
  for select using (true);

-- listings.brand_id — nullable a propósito. `brand` (texto) se mantiene
-- intacto para compatibilidad mientras se completa la migración gradual
-- de lectura (cards, ficha, filtros, /marcas, búsqueda, autocomplete).
alter table public.listings add column brand_id uuid references public.brands(id) on delete set null;
create index listings_brand_id_idx on public.listings (brand_id);
