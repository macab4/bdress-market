-- ============================================================
-- Migración: agrega "Depop" como plataforma de origen válida para
-- productos internacionales (además de Vinted/Manual/Otra).
-- Pegar y correr en Supabase Dashboard → SQL Editor.
-- ============================================================
alter table public.listing_sourcing drop constraint if exists listing_sourcing_source_platform_check;
alter table public.listing_sourcing add constraint listing_sourcing_source_platform_check
  check (source_platform in ('vinted', 'depop', 'manual', 'other'));
