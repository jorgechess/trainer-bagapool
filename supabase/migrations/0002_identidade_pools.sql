-- Identidade das pools: cor e logo. Cadastra as pools atuais do Baga.
-- Rode no SQL Editor do Supabase (uma vez), depois da 0001.

alter table public.pools add column if not exists color text not null default '#a1a1aa'
  check (color ~ '^#[0-9a-fA-F]{6}$');
alter table public.pools add column if not exists logo text;

insert into public.pools (name, color, logo) values
  ('Baga Main', '#e63946', 'baga-main'),
  ('Baga Mid', '#2563eb', 'baga-mid'),
  ('Baga Low', '#22c55e', 'baga-low'),
  ('Baga Micro', '#facc15', 'baga-micro'),
  ('5 High', '#f5f5f4', '5high'),
  ('EBM', '#94a3b8', null),
  ('No Deal', '#c1121f', 'no-deal'),
  ('UnderDogz', '#f97316', null),
  ('Almirantes', '#d4a72c', 'almirantes')
on conflict (name) do update set color = excluded.color, logo = excluded.logo;
