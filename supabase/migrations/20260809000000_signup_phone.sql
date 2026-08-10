-- El teléfono de perfil (profiles.phone) ya existía como columna opcional,
-- pero el trigger de registro nunca lo copiaba desde auth.users — el form de
-- registro ahora lo pide y lo manda en el metadata de signUp(), así que acá
-- se actualiza el trigger para guardarlo. No se agrega un check "not null":
-- hay cuentas viejas sin teléfono (ej. vendedoras migradas) que deben seguir
-- pudiendo operar sin romper — la obligatoriedad es solo del lado del form,
-- para cuentas nuevas.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$ language plpgsql security definer;
