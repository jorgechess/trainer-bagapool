# Como colocar o Trainer Baga Pool no ar

Leva uns 15 minutos e é feito uma vez só. Você vai precisar de uma conta no [Supabase](https://supabase.com) e uma no [Vercel](https://vercel.com). As duas têm plano grátis.

## 1. Criar o projeto no Supabase

1. Entre em [supabase.com/dashboard](https://supabase.com/dashboard) e clique em **New project**.
2. Dê o nome `trainer-bagapool`, crie uma senha forte para o banco (guarde-a) e escolha a região **South America (São Paulo)**.
3. Espere o projeto ficar pronto (1 a 2 minutos).

## 2. Criar as tabelas

1. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
2. Copie todo o conteúdo do arquivo [`supabase/migrations/0001_inicial.sql`](supabase/migrations/0001_inicial.sql), cole e clique em **Run**.
3. Deve aparecer "Success. No rows returned".
4. Repita com cada arquivo seguinte da pasta [`supabase/migrations`](supabase/migrations), em ordem (`0002_...`, `0003_...`). Quando sair uma atualização com arquivo novo nessa pasta, rode só o arquivo novo.

## 3. Bloquear cadastros abertos

Só o admin cadastra jogadores, então ninguém pode criar conta sozinho:

1. Abra **Authentication → Sign In / Providers** (em alguns painéis: **Authentication → Settings**).
2. Desligue **Allow new users to sign up**.
3. Deixe o provedor **Email** ligado.

## 4. Criar o primeiro admin (você)

1. Abra **Authentication → Users → Add user → Create new user**.
2. Coloque seu e-mail e uma senha, marque **Auto Confirm User** e crie.
3. Volte ao **SQL Editor** e rode, trocando pelo seu e-mail:

   ```sql
   update public.profiles
   set role = 'admin', name = 'Jorge'
   where lower(email) = lower('seu-email@exemplo.com')
   returning email, name, role;
   ```

   O resultado precisa mostrar uma linha com `role = admin`. Se vier vazio, o e-mail não bate com o cadastrado: confira com `select email, role from public.profiles;`.

Depois disso, todos os outros jogadores são cadastrados pelo próprio site, na tela **Jogadores**.

## 5. Pegar as chaves

Em **Project Settings → API** (ou **Project Settings → API Keys**), copie:

| No Supabase | Nome da variável no Vercel |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key (clique em *Reveal*) | `SUPABASE_SERVICE_ROLE_KEY` |

A `service_role` dá acesso total ao banco: nunca coloque ela no código nem mande para ninguém. Ela fica só no Vercel.

## 6. Publicar no Vercel

1. Entre em [vercel.com/new](https://vercel.com/new) com sua conta do GitHub.
2. Importe o repositório **jorgechess/trainer-bagapool**. O Vercel reconhece o Next.js sozinho.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e adicione as três variáveis da tabela acima.
4. Clique em **Deploy**. Em 1 a 2 minutos o site fica no ar num endereço tipo `trainer-bagapool.vercel.app`.

Daqui para frente, cada mudança enviada para a branch `main` é publicada automaticamente.

## 7. Configurar o endereço no Supabase

1. No Supabase, abra **Authentication → URL Configuration**.
2. Em **Site URL**, coloque o endereço do Vercel (ex.: `https://trainer-bagapool.vercel.app`).

## 8. Primeiros passos no site

1. Entre com o e-mail e a senha do passo 4.
2. **Legenda**: confira as cores de cada ação (já vem um padrão: RFI laranja, shove roxo, fold azul, limp verde).
3. **Jogadores**: crie as pools e cadastre o time. O site gera uma senha inicial para cada pessoa.
4. Os ranges das pastas `cargas/` entram sozinhos no banco a cada deploy; **Estratégias** permite ajustes.
5. **Drills**: monte os exercícios a partir das estratégias.
6. **Standards**: cadastre as faixas ideais dos stats do popup e ligue cada stat aos drills que treinam ele.

## Domínio próprio (opcional)

No Vercel, abra o projeto → **Settings → Domains** e adicione o domínio (ex.: `trainer.bagapool.com.br`). O Vercel mostra o registro DNS para criar. Depois, atualize a **Site URL** do passo 7.

## Problemas comuns

- **"Configure NEXT_PUBLIC_SUPABASE_URL"**: faltou alguma variável no Vercel. Adicione e faça um novo deploy em **Deployments → Redeploy**.
- **Entro e volto para o login com "acesso não está ativo"**: o usuário existe no Supabase, mas está desativado na tela Jogadores.
- **Erro ao cadastrar jogador**: confira a variável `SUPABASE_SERVICE_ROLE_KEY`.
