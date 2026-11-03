-- Login pelo nick do jogador (sem e-mail) e troca obrigatória da senha inicial.
-- Rode no SQL Editor do Supabase (uma vez), depois da 0002.
-- As senhas continuam guardadas pelo Supabase Auth só como hash bcrypt: ninguém consegue lê-las,
-- nem os admins; quem esquecer recebe uma senha nova do mentor/admin.

alter table public.profiles add column if not exists nick text;
alter table public.profiles add column if not exists must_change_password boolean not null default false;

do $$ begin
  alter table public.profiles add constraint profiles_nick_formato
    check (nick is null or nick ~ '^[A-Za-z0-9_.-]{3,30}$');
exception when duplicate_object then null; end $$;

create unique index if not exists profiles_nick_unico on public.profiles (lower(nick)) where nick is not null;
