# Deploy: Homologação e Produção

```
feat/* → PR para release → CI + Preview (Vercel)
release → Esteira: CI → HML
PR release → main → CI (só verifica; nada é publicado)
main → Esteira: CI → HML → issue de aprovação → todos comentam "aprovado" → PRD
```

## Etapas da Esteira (`.github/workflows/esteira.yml`)

| Etapa | Quando | O que faz |
| --- | --- | --- |
| Verificar | push em `release` ou `main` | typecheck, testes e build |
| HML | depois de Verificar | publica o commit no projeto `nacall-hml` (Vercel) |
| Aprovação para PRD | só na `main`, depois de HML | abre a issue `deploy-producao` |
| PRD (`producao.yml`) | quando todos os aprovadores comentam `aprovado` | publica o commit da issue no projeto de produção |

A produção só pode ser pedida depois que aquele mesmo commit foi publicado em homologação com sucesso. Se Verificar ou HML falhar, nenhuma issue de aprovação é aberta.

## Por que a produção só roda depois do merge

O PR para `main` apenas verifica (typecheck, testes e build). Publicar ao abrir o PR colocaria no ar código que ainda não foi aprovado. A produção sai de um commit que já está na `main`, que passou por HML e que os dois aprovadores confirmaram.

## Ambientes

| Ambiente | Branch | Quem publica | Projeto Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- | --- |
| Feature (preview) | `feat/*` | Vercel (integração Git) | `nacall-hml`, deploy Preview | HML | HML |
| Homologação | `release` e `main` | Esteira (Actions) | `nacall-hml` | HML | HML |
| Produção | `main`, após aprovação | `producao.yml` (Actions) | projeto de produção (hoje na conta do on3ver) | PRD | PRD |

`vercel.json` desliga o deploy automático da Vercel para `release` e `main`, para a Esteira ser a única a publicar nelas. Os Preview das branches `feat/*` continuam automáticos e usam o backend de homologação. Nunca use credenciais de produção em Preview.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Esteira verifica e publica em https://nacall-hml.vercel.app. Testem lá.
3. Abram PR `release` → `main`. A CI verifica. Nada é publicado.
4. Após o merge em `main`, a Esteira verifica, publica em HML e abre a issue `deploy-producao` com o commit e o link da homologação. Pedidos anteriores abertos são fechados como substituídos.
5. Cada aprovador comenta `aprovado` ou `negado` na issue. A primeira palavra do comentário é o voto, e o último voto de cada pessoa vale.
6. Um `negado` cancela e fecha a issue. Quando todos tiverem `aprovado`, `producao.yml` publica exatamente o commit da issue com `--prod`, comenta o resultado e fecha a issue. Se o deploy falhar, a issue fica aberta e um novo `aprovado` tenta outra vez.
7. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

A espera pela aprovação não consome minutos do GitHub Actions.

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
| Variable (opcional) | `APROVADORES` | Logins separados por vírgula. Padrão: `gustapmartins,on3ver` |
| Variable (opcional) | `URL_HOMOLOGACAO` | Padrão: `https://nacall-hml.vercel.app` |

Os deploys usam as variáveis de ambiente Production do próprio projeto na Vercel; não há segredos no repositório. Sem os secrets de uma etapa, ela falha com uma mensagem clara e nada é publicado.

Quando os projetos de produção forem transferidos para a conta da empresa, atualize os três secrets de produção. Se conectarem o Git da Vercel ao projeto de produção, ajuste o `vercel.json` (ele desliga o deploy automático de `main`) e o `producao.yml` passa a ser só o portão de aprovação.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch. A regra "só vai para produção com os dois aprovando" é garantida pelos workflows, mas um administrador consegue publicar pela Vercel CLI, mesclar sem revisão ou alterar os workflows. Combinem que mudanças em `.github/workflows` e o PR `release` → `main` sempre passam pelo outro aprovador. O GitHub Team (US$ 4 por usuário por mês) permitiria exigir revisão aprovada no PR e proteger a `main`.

`issue_comment` só dispara workflows que existem na branch padrão: a aprovação passa a funcionar depois que estes arquivos chegarem à `main`.
