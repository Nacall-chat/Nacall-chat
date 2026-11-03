# Deploy: Homologação e Produção

```
feat/* → PR para release → CI + Preview (Vercel, backend de HML)
merge em release → Esteira: Verificar → HML (nacall-hml.vercel.app)
PR release → main (merge commit) → CI (só verifica; nada é publicado)
merge em main → CI (nada é publicado)
Actions > Esteira > Run workflow (branch main) → Verificar → PRD (nacall.vercel.app)
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

## Esteira (`.github/workflows/esteira.yml`)

| Etapa | Quando | O que faz |
| --- | --- | --- |
| Verificar | push em `release` ou `main`; também antes de PRD | typecheck, testes e build |
| HML | push na `release`, depois de Verificar | publica o commit no projeto `nacall-hml` |
| PRD | **só manual** (Run workflow), depois de Verificar | envia a `main` para o `nacall-prd`, que constrói na Vercel com as variáveis de produção |

**Como publicar em produção:** GitHub → aba **Actions** → **Esteira** → **Run workflow** → em "Use workflow from" escolha **`main`** → **Run workflow**. O job PRD recusa qualquer outra branch e nunca roda sozinho. Depois, confira o deploy em https://nacall.vercel.app.

Se faltarem as credenciais de uma etapa, ela falha com uma mensagem clara e nada é publicado.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Esteira verifica e publica em https://nacall-hml.vercel.app. Testem lá, o quanto precisarem.
3. Abram PR `release` → `main` e mesclem com merge commit.
4. Quando quiserem publicar, apertem **Run workflow** na Esteira (branch `main`) e confirmem o site.
5. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

## Migrations de banco

A migration precisa estar aplicada no Supabase do ambiente **antes** de o código que a usa ser publicado nele. Migrations devem ser aditivas. Ordem: aplicar em HML → mesclar na `release` → testar → aplicar em PRD → mesclar na `main` → Run workflow.

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
