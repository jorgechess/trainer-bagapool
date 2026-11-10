-- Pools atuais do Baga (nov/2026): Main, Mid, Low, Micro, 5 High, EBM, Nameless, No Deal, Underdogz e Almirantes.
-- Underdogz ganha o logo do pitbull; Nameless entra (sem logo, como a EBM).
-- Rode no SQL Editor do Supabase (uma vez), depois da 0005.

update public.pools set name = 'Underdogz', color = '#8b5cf6', logo = 'underdogz'
where name in ('UnderDogz', 'Underdogz');

insert into public.pools (name, color, logo) values
  ('Underdogz', '#8b5cf6', 'underdogz'),
  ('Nameless', '#0ea5e9', null)
on conflict (name) do nothing;
