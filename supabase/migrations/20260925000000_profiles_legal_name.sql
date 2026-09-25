-- Separa el "nombre visible" (apodo libre, lo que ven otras usuarias) del
-- "nombre y apellido" real que necesita el courier para retirar el paquete
-- en la etiqueta de envío — hasta ahora era el mismo campo `name`, y como
-- el registro dejaba (a propósito) usar cualquier apodo de una palabra,
-- ese mismo apodo terminaba apareciendo como "Retiro (vendedora)" en el
-- panel de admin, sin servir para identificar a la persona en el retiro.
alter table public.profiles add column if not exists legal_name text;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, legal_name, phone, city, comuna)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'legal_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'comuna', '')
  );
  return new;
end;
$$ language plpgsql security definer;
