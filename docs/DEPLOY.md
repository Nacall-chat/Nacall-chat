# Deploy: Homologação e Produção

```
PR → Verificar NACALL → merge em main
   → Deploy Homologação (automático)
   → issue "Aprovar produção" aguarda os aprovadores
   → Deploy Produção (quando todos comentarem "aprovado")
```

## Fluxo

1. Todo pull request roda `Verificar NACALL` (typecheck, testes e build).
2. Cada push em `main` roda `Deploy Homologação`: verifica de novo, publica um deploy Preview na Vercel e aponta o domínio de homologação para ele.
3. O mesmo workflow abre uma issue com o rótulo `deploy-producao`, os links da versão e o commit. Pedidos anteriores ainda abertos são fechados como substituídos.
4. Cada aprovador testa a homologação e comenta `aprovado` ou `negado` na issue. A primeira palavra do comentário é o voto; o último voto de cada pessoa vale.
5. Um `negado` cancela e fecha a issue. Quando todos os aprovadores tiverem `aprovado`, `Deploy Produção` publica exatamente o commit da issue com `--prod`, comenta o resultado e fecha a issue. Se o deploy falhar, a issue fica aberta e um novo `aprovado` tenta outra vez.

A espera pela aprovação não consome minutos do GitHub Actions: o deploy de produção só roda quando alguém comenta.

## Configuração (uma vez)

Em Settings → Secrets and variables → Actions:

| Tipo | Nome | Valor |
| --- | --- | --- |
| Secret | `VERCEL_TOKEN` | Token criado em vercel.com/account/tokens com acesso ao time ON3VER |
| Secret | `VERCEL_ORG_ID` | `orgId` de `.vercel/project.json` (após `vercel link`) |
| Secret | `VERCEL_PROJECT_ID` | `projectId` de `.vercel/project.json` |
| Variable (opcional) | `APROVADORES` | Logins separados por vírgula. Padrão: `gustapmartins,on3ver` |
| Variable (opcional) | `DOMINIO_HOMOLOGACAO` | Padrão: `nacall-homologacao.vercel.app` |

Na Vercel, o ambiente **Preview** do projeto precisa das seis variáveis de `.env.example` apontando para serviços de homologação: um projeto Supabase separado, com as migrations de `supabase/migrations` aplicadas, e de preferência um projeto LiveKit separado. Nunca aponte homologação para o banco de produção. No Supabase de homologação, adicione `https://nacall-homologacao.vercel.app` em Site URL e Redirect URLs.

Se a Deployment Protection da Vercel estiver ligada para Preview, a homologação pedirá login na Vercel; desligue-a para o domínio de homologação ou mantenha e acesse logado.

## Limites

O repositório é privado no plano Free do GitHub, que não oferece proteção de branch nem aprovação nativa de ambientes. A trava fica no workflow: um administrador consegue publicar pela Vercel CLI ou alterar os workflows. Alterações em `.github/workflows` devem passar por pull request revisado pelo outro aprovador.
