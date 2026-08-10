-- El registro ahora pide comuna (obligatoria para cuentas nuevas) porque sin
-- ella el checkout no puede cotizar el envío y queda bloqueado con "La
-- vendedora todavía no configuró su dirección de despacho" — encontramos que
-- esto tenía bloqueadas 81 de 102 prendas activas (33 perfiles sin comuna,
-- ya rellenados a mano con 'SANTIAGO' como valor de respaldo). Esto evita
-- que vuelva a pasar con cuentas nuevas.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, phone, city, comuna)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'city', ''),
    nullif(new.raw_user_meta_data->>'comuna', '')
  );
  return new;
end;
$$ language plpgsql security definer;
