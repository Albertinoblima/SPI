# Deployment de Produção - SPI

## Objetivo

Publicar o **SPI - Sistema de Pesquisa Inteligente** com atualização contínua via GitHub.

- Frontend: `spi.idialog.com.br` (Vercel)
- Backend: `api.spi.idialog.com.br` (proxy para Supabase Cloud)
- Repositório: GitHub (`Albertinoblima`)

## Pré-requisitos

```bash
npm install -g vercel
```

Opcional para automação de banco/funções:

```bash
npm install -g supabase
```

## Passo 1 - Repositório GitHub (base para atualizações)

1. Crie um repositório no GitHub, por exemplo: `spi-sistema-pesquisa-inteligente`.
2. Na raiz do projeto local, execute:

```bash
git init
git add .
git commit -m "chore: inicializa SPI"
git branch -M main
git remote add origin https://github.com/Albertinoblima/spi-sistema-pesquisa-inteligente.git
git push -u origin main
```

1. Fluxo de atualização recomendado:
   - branch de feature
   - pull request
   - merge em `main`
   - deploy automático no Vercel

## Passo 2 - Supabase Cloud (backend)

1. Crie o projeto no Supabase.
2. Guarde os valores:
   - `Project URL`
   - `anon key`
   - `service_role key`
   - `project ref`

3. Publique banco e funções:

```bash
supabase login
supabase link --project-ref <project-ref>
supabase db push
supabase functions deploy sync-responses --no-verify-jwt
```

1. Crie bucket de mídia:
   - Storage > Create bucket > `response-media`

## Passo 3 - Frontend no Vercel

Conta Vercel: `vercel.com/albertinoblima`

1. Import Project no Vercel usando o repositório GitHub.
2. Configure:
   - Framework: Next.js
   - Root Directory: `apps/web`
3. Configure variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
   - `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>` (apenas se necessário em server-side)
4. Faça deploy da branch `main`.

## Passo 4 - Subdomínio web (`spi.idialog.com.br`)

1. Em Vercel > Domains, adicione `spi.idialog.com.br`.
2. No Registro.br, crie o registro DNS indicado pela Vercel (normalmente CNAME para `cname.vercel-dns.com`).
3. Aguarde propagação e confirme HTTPS ativo.

## Passo 5 - Subdomínio de API (`api.spi.idialog.com.br`)

O Supabase não permite custom domain para API em todos os planos. Existem 2 cenários:

1. **Sem custom domain nativo**:
   - mantenha `NEXT_PUBLIC_SUPABASE_URL` apontando para `https://<project-ref>.supabase.co`.
   - use `api.spi.idialog.com.br` apenas como proxy reverso (Cloudflare/Nginx), se realmente necessário.

2. **Com custom domain habilitado no plano**:
   - configure no painel Supabase e aponte `api.spi.idialog.com.br` conforme instruções do provedor.

## Passo 6 - Auth e redirects no Supabase

No painel Supabase > Authentication:

- Site URL: `https://spi.idialog.com.br`
- Redirect URLs:
  - `https://spi.idialog.com.br`
  - `https://spi.idialog.com.br/auth/callback`

## Passo 7 - Testes de produção

Checklist mínimo:

- [ ] Login funcionando em `https://spi.idialog.com.br/login`
- [ ] Criação e edição de pesquisa
- [ ] Dashboard carregando dados
- [ ] Upload de mídia no bucket `response-media`
- [ ] RLS bloqueando acesso entre tenants

## Passo 8 - Publicação mobile (sem loja paga)

Sem pagar lojas, use distribuição direta Android:

```bash
cd apps/mobile
npx eas-cli login
eas build:configure
eas build --platform android --profile preview
```

Distribuição:

- APK/AAB por link privado (GitHub Releases, Drive, etc.)

## Operação contínua

Sempre que concluir uma tarefa:

```bash
git add .
git commit -m "feat: descricao objetiva"
git push
```

Com isso, o Vercel atualiza automaticamente o frontend do SPI.
