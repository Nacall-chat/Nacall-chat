# Deploy: Homologação e Produção

```
feat/* → PR para release → CI + Preview (Vercel, backend de HML)
merge em release → Esteira: Verificar → HML (nacall-hml.vercel.app)
PR release → main (merge commit) → CI (só verifica; nada é publicado)
merge em main → CI (nada é publicado)
Actions > Site · Esteira (HML e PRD) > Run workflow (branch main) → Verificar → PRD (nacall.vercel.app)
```

## Aprovação

Há dois momentos separados:

1. **Revisão do PR `release` → `main`:** só mescle depois de testado em homologação e com o "ok" de quem revisa. Use **"Create a merge commit"** (nunca squash), para `release` e `main` não divergirem e gerarem conflitos. Mesclar **não publica** em produção.
2. **Publicação:** alguém aperta o botão **Run workflow** da Esteira (veja abaixo). Só então a produção muda.

Migrations de banco precisam estar aplicadas em produção **antes** de apertar o botão.

## Ambientes

| Ambiente | Branch | Quem publica | Projeto Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- | --- |
| Feature (preview) | `feat/*` | Vercel (integração Git) | `nacall-hml`, deploy Preview | HML | HML |
| Homologação | `release` | Esteira (GitHub Actions) | `nacall-hml` | `nacall-hml` | `nacall-hml` |
| Produção | `main` | Esteira (GitHub Actions), só pelo botão **Run workflow** | `nacall-prd` | `nacall-prd` | `nacall-prd` |

As regras de "Ignored Build Step" de cada projeto decidem quem constrói o quê:
- `nacall-prd` ignora todos os builds do Git: só a Esteira publica nele.
- `nacall-hml` ignora `release` e `main` (a Esteira publica a `release`) e constrói as demais branches como Preview.

As variáveis de ambiente de produção existem **somente** no ambiente Production do `nacall-prd`. Nunca cadastre credenciais de produção em Preview nem em `nacall-hml`.

## Workflows do repositório

Há três, e o nome começa com a área para ficar claro o que cada um faz na aba Actions:

| Nome na aba Actions | Arquivo | Quando roda | Para que serve |
| --- | --- | --- | --- |
| **PR · Verificar (typecheck, testes e build)** | `ci.yml` | A cada PR, e chamado pela Esteira | Typecheck, testes e build. É o "check" verde/vermelho dos PRs |
| **Site · Esteira (HML e PRD)** | `esteira.yml` | Push em `release` ou `main`, e o botão **Run workflow** | Verifica e publica o **site**: `release` vai para HML (por push ou pelo botão); produção só pelo botão, com a branch `main` |
| **Desktop · Build Windows** | `windows-desktop.yml` | Mudanças em `desktop/**`, ou manualmente | Gera o instalador do app de Windows. Não mexe no site |

Só o segundo publica o site. Os comandos usam o nome do arquivo (por exemplo `gh run list --workflow esteira.yml`), que não muda.

## Esteira (`.github/workflows/esteira.yml`)

| Etapa | Quando | O que faz |
| --- | --- | --- |
| Verificar | push em `release` ou `main`; também antes de PRD | typecheck, testes e build |
| HML | push na `release` **ou** Run workflow com a branch `release`, depois de Verificar | publica o commit no projeto `nacall-hml` |
| PRD | **só manual** (Run workflow com a branch `main`), depois de Verificar | envia a `main` para o `nacall-prd`, que constrói na Vercel com as variáveis de produção |

**Como publicar em produção:** GitHub → aba **Actions** → **Site · Esteira (HML e PRD)** → **Run workflow** → em "Use workflow from" escolha **`main`** → **Run workflow**. O job PRD só começa com a branch `main` (em qualquer outra ele é pulado, e a conferência dentro dele é uma segunda trava) e nunca roda sozinho. Depois, confira o deploy em https://nacall.vercel.app.

**Como subir o HML à mão** (por exemplo depois de uma falha por limite da Vercel): na mesma tela, em "Use workflow from" escolha **`release`** → **Run workflow**. Só o job HML roda. Outra opção é reexecutar o run do último push (`gh run rerun <id> --failed`).

Se faltarem as credenciais de uma etapa, ela falha com uma mensagem clara e nada é publicado.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Esteira verifica e publica em https://nacall-hml.vercel.app. Testem lá, o quanto precisarem.
3. Abram PR `release` → `main` e mesclem com merge commit.
4. Quando quiserem publicar, apertem **Run workflow** na Esteira (branch `main`) e confirmem o site.
5. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

## Migrations de banco

A migration precisa estar aplicada no Supabase do ambiente **antes** de o código que a usa ser publicado nele. Migrations devem ser aditivas. Ordem: aplicar em HML → mesclar na `release` → testar → aplicar em PRD → mesclar na `main` → Run workflow.

Cuidado com migrations que apagam dados: `202611030002_auth_seguranca.sql` apaga contas com email `@accounts.nacall.invalid`. Em produção, onde essas contas são de pessoas reais, **aplique antes `202611170001_preservar_contas_antigas.sql`**, que as converte para o email real em vez de apagá-las (detalhes em `docs/AUTH.md`). Em produção: **antes do deploy**, `202611180001` (nick livre; o código consulta `username_key`) e `202611180003` (`email_status`, usada pelo cadastro e pelo "esqueci a senha"); ambas aditivas. **Depois do deploy**, para as contas antigas: `202611170001` (converte para o email real) → `202611180002` (marca `email_pending`, enquanto `account_emails` ainda existe) → restante de `202611030002` (remove as tabelas antigas). Antes de aplicar qualquer migration em PRD, olhe o que ela apaga ou altera no banco de produção e confirme com quem decide.

## Configuração

Secrets do GitHub (Settings → Secrets and variables → Actions), usados pelas etapas HML e PRD:

| Nome | Valor |
| --- | --- |
| `HML_VERCEL_TOKEN` | Token da conta da empresa (vercel.com/account/tokens), escopo do time |
| `HML_VERCEL_ORG_ID` | `orgId` do time da Vercel |
| `HML_VERCEL_PROJECT_ID` | `projectId` do projeto `nacall-hml` |
| `PRD_VERCEL_ORG_ID` | `orgId` do time da Vercel (o mesmo do HML) |
| `PRD_VERCEL_PROJECT_ID` | `projectId` do projeto `nacall-prd` |
| `PRD_VERCEL_TOKEN` (opcional) | Token só da produção; se ausente, a etapa PRD usa `HML_VERCEL_TOKEN` (o escopo é o time inteiro) |

Variáveis de cada projeto na Vercel: as seis de `.env.example`. No Supabase de produção, em Authentication, mantenha Email ligado, "Confirm email" desligado e o Site URL em `https://nacall.vercel.app`.

## Rollback

Na Vercel, abra o projeto `nacall-prd` → Deployments e use **Instant Rollback** no deploy anterior (é imediato). Para voltar o código, reverta o merge na `main` por PR e aperte **Run workflow** de novo.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch nem aprovação obrigatória de ambientes. O botão evita publicação por engano, mas quem tem acesso de administrador ainda consegue apertá-lo, alterar os workflows ou publicar pela Vercel CLI. Combinem que mudanças em `.github/workflows` e o PR `release` → `main` passam pela revisão do outro. O GitHub Team (US$ 4 por usuário por mês) permitiria exigir revisão aprovada no PR e aprovação obrigatória antes do PRD.

## APK do app Android na landing

O botão "Download Android" da landing baixa `/downloads/nacall-android.apk`. O arquivo **não fica no Git**: antes do deploy (HML e PRD), a Esteira baixa o APK da **pré-release mais recente** cujo nome de tag começa com `mobile-teste-` (gerada pelo workflow "Mobile · APK de teste (Android)") e o copia para `public/downloads/`. Se não houver pré-release, o passo só avisa e o deploy segue normalmente (o botão fica sem arquivo).

- Para atualizar o APK do site: rode o workflow "Mobile · APK de teste" e publique de novo a Esteira (HML por merge na `release`; PRD pelo "Run workflow" na `main`).
- É um APK de **teste**: aponta para a homologação e é assinado com a chave de depuração. Uma versão assinada para as lojas substitui este fluxo depois.
