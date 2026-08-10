-- Corrige un descuido de la migración anterior (20260809000000_signup_phone.sql):
-- quedó afuera "city", que el form de registro también manda en el metadata
-- pero el trigger nunca guardaba.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name, phone, city)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    nullif(new.raw_user_meta_data->>'city', '')
  );
  return new;
end;
$$ language plpgsql security definer;
