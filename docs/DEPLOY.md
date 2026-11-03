# Deploy: Homologação e Produção

```
feat/* → PR para release → CI + Preview (Vercel)
release → Esteira: Verificar → HML
PR release → main → CI (só verifica; nada é publicado)
merge em main → Esteira: Verificar → HML → PRD
```

## Aprovação

A aprovação é a **revisão do PR `release` → `main`**. Depois do merge, a Esteira publica em produção sozinha, sem etapa extra. Por isso:

- O PR `release` → `main` só deve ser mesclado depois de testado em homologação e com o "ok" de quem revisa.
- Use **"Create a merge commit"** (nunca squash), para `release` e `main` não divergirem e gerarem conflitos.
- O que for mesclado na `main` vai para produção. Migrations de banco precisam estar aplicadas **antes** do merge (veja abaixo).

## Etapas da Esteira (`.github/workflows/esteira.yml`)

| Etapa | Quando | O que faz |
| --- | --- | --- |
| Verificar | push em `release` ou `main` | typecheck, testes e build |
| HML | depois de Verificar | publica o commit no projeto `nacall-hml` (Vercel) |
| PRD | só na `main`, depois de HML | publica o mesmo commit no projeto de produção (Vercel) |

PRD só roda se Verificar e HML tiverem passado. Se faltarem as credenciais de uma etapa, ela falha com uma mensagem clara e nada é publicado.

## Ambientes

| Ambiente | Branch | Quem publica | Projeto Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- | --- |
| Feature (preview) | `feat/*` | Vercel (integração Git) | `nacall-hml`, deploy Preview | HML | HML |
| Homologação | `release` e `main` | Esteira (Actions) | `nacall-hml` | HML | HML |
| Produção | `main` | Esteira (Actions) | projeto de produção (hoje na conta do on3ver) | PRD | PRD |

`vercel.json` desliga o deploy automático da Vercel para `release` e `main`, para a Esteira ser a única a publicar nelas. Os Preview das branches `feat/*` continuam automáticos e usam o backend de homologação. Nunca use credenciais de produção em Preview.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Esteira verifica e publica em https://nacall-hml.vercel.app. Testem lá.
3. Abram PR `release` → `main` e mesclem com merge commit. A CI verifica no PR.
4. Após o merge em `main`, a Esteira verifica, publica em HML e depois em produção.
5. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

## Migrations de banco

A migration precisa estar aplicada no Supabase do ambiente **antes** de o código que a usa ser publicado nele. Migrations devem ser aditivas. Ordem: aplicar em HML → mesclar na `release` → testar → aplicar em PRD → mesclar na `main`.

## Configuração (uma vez)

Em Settings → Secrets and variables → Actions do repositório:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `HML_VERCEL_TOKEN` | Token da conta da empresa (vercel.com/account/tokens) |
| Secret | `HML_VERCEL_ORG_ID` | `orgId` de `.vercel/project.json` do projeto `nacall-hml` |
| Secret | `HML_VERCEL_PROJECT_ID` | `projectId` do mesmo arquivo |
| Secret | `VERCEL_TOKEN` | Token da conta dona do projeto de produção |
| Secret | `VERCEL_ORG_ID` | `orgId` de `.vercel/project.json` do projeto de produção (após `vercel link`) |
| Secret | `VERCEL_PROJECT_ID` | `projectId` do mesmo arquivo |

Os deploys usam as variáveis de ambiente Production do próprio projeto na Vercel; não há segredos no repositório.

Quando os projetos de produção forem transferidos para a conta da empresa, atualize os três secrets de produção. Se conectarem o Git da Vercel ao projeto de produção, ajuste o `vercel.json` (ele desliga o deploy automático de `main`) e remova o job PRD da Esteira.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch. Quem tem acesso de administrador consegue mesclar sem revisão, publicar pela Vercel CLI ou alterar os workflows. Combinem que mudanças em `.github/workflows` e o PR `release` → `main` sempre passam pela revisão do outro. O GitHub Team (US$ 4 por usuário por mês) permitiria exigir revisão aprovada no PR e proteger a `main`.
