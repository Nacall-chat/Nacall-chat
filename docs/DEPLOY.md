# Deploy: Homologação e Produção

```
branch feat/*  → PR para release → CI → merge
release        → Vercel publica em Homologação (nacall-hml)
PR release → main → CI (só verifica; nada é publicado)
merge em main  → CI → issue "Aprovar produção" → todos comentam "aprovado" → Produção
```

## Por que a produção só roda depois do merge

O PR para `main` apenas verifica (typecheck, testes e build). Publicar ao abrir o PR colocaria no ar código que ainda não foi aprovado. A produção sai de um commit que já está na `main` e que os dois aprovadores confirmaram.

## Ambientes

| Ambiente | Branch | Quem publica | Projeto Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- | --- |
| Feature (preview) | `feat/*` | Vercel (integração Git) | `nacall-hml`, deploy Preview | HML | HML |
| Homologação | `release` | Vercel (integração Git) | `nacall-hml` | HML | HML |
| Produção | `main` | GitHub Actions, após aprovação | projeto de produção (hoje na conta do on3ver) | PRD | PRD |

Os Preview das branches `feat/*` usam o backend de homologação. Nunca use credenciais de produção em Preview.

## Fluxo

1. Crie uma branch `feat/...` ou `hotfix/...` a partir de `release` e abra PR para `release`. A CI verifica e a Vercel publica um Preview.
2. Após o merge em `release`, a Vercel publica a Homologação. Testem em https://nacall-hml.vercel.app.
3. Abram PR `release` → `main`. A CI verifica. Nada é publicado.
4. Após o merge em `main`, `Solicitar Produção` verifica de novo e abre uma issue `deploy-producao` com o commit e o link da homologação. Pedidos anteriores abertos são fechados como substituídos.
5. Cada aprovador comenta `aprovado` ou `negado` na issue. A primeira palavra do comentário é o voto, e o último voto de cada pessoa vale.
6. Um `negado` cancela e fecha a issue. Quando todos tiverem `aprovado`, `Deploy Produção` publica exatamente o commit da issue com `--prod`, comenta o resultado e fecha a issue. Se o deploy falhar, a issue fica aberta e um novo `aprovado` tenta outra vez.
7. Hotfix urgente: mesmo caminho, com branch `hotfix/...` direto para `release`, sem pular a homologação.

A espera pela aprovação não consome minutos do GitHub Actions.

## Configuração da produção (uma vez, pelo dono do projeto Vercel de produção)

Em Settings → Secrets and variables → Actions do repositório:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | Token criado em vercel.com/account/tokens na conta dona do projeto de produção |
| Secret | `VERCEL_ORG_ID` | `orgId` de `.vercel/project.json` do projeto de produção (após `vercel link`) |
| Secret | `VERCEL_PROJECT_ID` | `projectId` do mesmo arquivo |
| Variable (opcional) | `APROVADORES` | Logins separados por vírgula. Padrão: `gustapmartins,on3ver` |
| Variable (opcional) | `URL_HOMOLOGACAO` | Padrão: `https://nacall-hml.vercel.app` |

O deploy usa as variáveis de ambiente Production do próprio projeto Vercel de produção; não há segredos no repositório. Sem os três secrets, o workflow falha com uma mensagem clara e nada é publicado.

Quando os projetos de produção forem transferidos para a conta da empresa, atualize os três secrets e, se quiser, troque este deploy pela integração Git da Vercel apontada para `main`.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch. A regra "só vai para produção com os dois aprovando" é garantida pelo workflow de produção, mas um administrador consegue publicar pela Vercel CLI, mesclar sem revisão ou alterar os workflows. Combinem que mudanças em `.github/workflows` e o PR `release` → `main` sempre passam pelo outro aprovador. O GitHub Team (US$ 4 por usuário por mês) permitiria exigir revisão aprovada no PR e proteger a `main`.

`issue_comment` só dispara workflows que existem na branch padrão: a aprovação passa a funcionar depois que estes arquivos chegam à `main`.
