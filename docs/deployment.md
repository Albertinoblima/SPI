# Deployment de Produção - SPI

## Status Atual

| Recurso | Status | URL |
|---|---|---|
| GitHub | ✅ Concluído | <https://github.com/Albertinoblima/SPI> |
| Vercel Deploy | ✅ Concluído | <https://spi-sistema-pesquisa-inteligente.vercel.app> |
| Supabase | ⏳ Pendente credenciais | — |
| Domínio customizado | ⏳ Pendente DNS | spi.idialog.com.br |
| GitHub → Vercel auto-deploy | ⏳ Pendente secrets | Ver Passo 3 |

## Objetivo

Publicar o **SPI - Sistema de Pesquisa Inteligente** com atualização contínua via GitHub.

- Frontend: `spi.idialog.com.br` (Vercel)
- Backend: `api.spi.idialog.com.br` (proxy para Supabase Cloud)
- Repositório: <https://github.com/Albertinoblima/SPI>

## Passo 1 - Repositório GitHub ✅ (Concluído)

Repositório criado e código enviado:

```
https://github.com/Albertinoblima/SPI
branch: main (2 commits)
```

Fluxo de atualização:

```bash
git add .
git commit -m "feat: descricao"
git push
# → Vercel faz deploy automático após configurar secrets (Passo 3)
```

## Passo 2 - Supabase Cloud ⏳ (Pendente)

1. Acesse <https://app.supabase.com> e crie um projeto (ou use existente).
2. Guarde em Settings → API:
   - **Project URL**: `https://SEU_REF.supabase.co`
   - **anon public key**: `eyJ...`
   - **service_role key**: `eyJ...`
   - **Project Ref**: string de ~20 chars (ex: `abcdefghijklmnop`)

3. Publique banco e funções:

```bash
cd c:\DEV\Sistema_Pesquisa\political-research-platform
npx supabase login
npx supabase link --project-ref SEU_PROJECT_REF
npx supabase db push
npx supabase functions deploy sync-responses --no-verify-jwt
```

1. Crie bucket de mídia:
   - Storage → Create bucket → nome: `response-media` → Public: **false**

## Passo 3 - Frontend no Vercel ✅ Deploy manual feito / ⏳ Auto-deploy pendente

Deploy manual já realizado em:

- <https://spi-sistema-pesquisa-inteligente.vercel.app>
- Vercel Project: `albertinoblimas-projects/spi-sistema-pesquisa-inteligente`

**Para ativar auto-deploy via GitHub** (após obter credenciais Supabase):

1. Acesse <https://vercel.com/albertinoblimas-projects/spi-sistema-pesquisa-inteligente/settings/environment-variables>  
   Adicione:

   ```
   NEXT_PUBLIC_SUPABASE_URL   = https://SEU_REF.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...anon_key
   SUPABASE_SERVICE_ROLE_KEY  = eyJ...service_role_key
   ```

2. Configure GitHub Secrets em <https://github.com/Albertinoblima/SPI/settings/secrets/actions>  
   Adicione os 3 secrets abaixo (necessários para o workflow `.github/workflows/deploy-web.yml`):

   ```
   VERCEL_TOKEN      = (gere em: https://vercel.com/account/tokens)
   VERCEL_ORG_ID     = team_jdz2mDGh4C3wyQL9Je7lenU8
   VERCEL_PROJECT_ID = prj_9MRLSkIfwKOIgDvMWHvAKwyQSSZA
   ```

3. Conecte o repositório GitHub ao projeto Vercel:
   - Em Vercel > Project Settings > Git, clique em **Connect Git Repository**
   - Selecione `Albertinoblima/SPI`

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
