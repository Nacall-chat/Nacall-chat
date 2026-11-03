# Deploy: Homologação e Produção

```
feat/* → PR para release → CI + Preview (Vercel, backend de HML)
merge em release → Esteira: Verificar → HML (nacall-hml.vercel.app)
PR release → main (merge commit) → CI (só verifica; nada é publicado)
merge em main → Vercel publica em Produção (nacall.vercel.app)
```

## Aprovação

A aprovação é a **revisão do PR `release` → `main`**. Depois do merge, a Vercel publica em produção sozinha, sem etapa extra. Por isso:

- O PR `release` → `main` só deve ser mesclado depois de testado em homologação e com o "ok" de quem revisa.
- Use **"Create a merge commit"** (nunca squash), para `release` e `main` não divergirem e gerarem conflitos.
- O que for mesclado na `main` vai para produção. Migrations de banco precisam estar aplicadas em produção **antes** do merge.

## Ambientes

| Ambiente | Branch | Quem publica | Projeto Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- | --- |
| Feature (preview) | `feat/*` | Vercel (integração Git) | `nacall-hml`, deploy Preview | HML | HML |
| Homologação | `release` | Esteira (GitHub Actions, via CLI) | `nacall-hml` | `nacall-hml` | `nacall-hml` |
| Produção | `main` | Vercel (integração Git) | `nacall-prd` | `nacall-prd` | `nacall-prd` |

As regras de "Ignored Build Step" de cada projeto decidem quem constrói o quê:
- `nacall-prd` só constrói `main`.
- `nacall-hml` ignora `release` e `main` (a Esteira publica a `release`) e constrói as demais branches como Preview.

As variáveis de ambiente de produção existem **somente** no ambiente Production do `nacall-prd`. Nunca cadastre credenciais de produção em Preview nem em `nacall-hml`.

## Esteira (`.github/workflows/esteira.yml`)

| Etapa | Quando | O que faz |
| --- | --- | --- |
| Verificar | push em `release` ou `main` | typecheck, testes e build |
| HML | só na `release`, depois de Verificar | publica o commit no projeto `nacall-hml` |

Se faltarem as credenciais de HML, a etapa falha com uma mensagem clara e nada é publicado.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Esteira verifica e publica em https://nacall-hml.vercel.app. Testem lá.
3. Abram PR `release` → `main` e mesclem com merge commit.
4. Após o merge em `main`, a Vercel constrói e publica em https://nacall.vercel.app. Confirme o deploy e teste.
5. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

## Migrations de banco

A migration precisa estar aplicada no Supabase do ambiente **antes** de o código que a usa ser publicado nele. Migrations devem ser aditivas. Ordem: aplicar em HML → mesclar na `release` → testar → aplicar em PRD → mesclar na `main`.

## Configuração

Secrets do GitHub (Settings → Secrets and variables → Actions), usados só pela etapa HML:

| Nome | Valor |
| --- | --- |
| `HML_VERCEL_TOKEN` | Token da conta da empresa (vercel.com/account/tokens) |
| `HML_VERCEL_ORG_ID` | `orgId` de `.vercel/project.json` do projeto `nacall-hml` |
| `HML_VERCEL_PROJECT_ID` | `projectId` do mesmo arquivo |

Variáveis de cada projeto na Vercel: as seis de `.env.example`. No Supabase de produção, em Authentication, mantenha Email ligado, "Confirm email" desligado e o Site URL em `https://nacall.vercel.app`.

## Rollback

Na Vercel, abra o projeto `nacall-prd` → Deployments e use **Instant Rollback** no deploy anterior. Para voltar o código, reverta o merge na `main` (`git revert -m 1 <merge>`) por PR.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch. Quem tem acesso de administrador consegue mesclar sem revisão ou alterar os workflows. Combinem que mudanças em `.github/workflows` e o PR `release` → `main` sempre passam pela revisão do outro. O GitHub Team (US$ 4 por usuário por mês) permitiria exigir revisão aprovada no PR e proteger a `main`.
