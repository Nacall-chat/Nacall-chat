# Novidades do sino

O sino do site e do app mostra as **Novidades do NACALL** que estão no ar. Elas ficam na tabela `product_updates`
(migration `202611280002_novidades.sql`) e expiram sozinhas: por padrão, 3 dias depois de publicadas.

## Tabela `product_updates`
| coluna | o que é |
|---|---|
| `slug` | chave única e fixa (ex.: `pr-142`). Publicar de novo com o mesmo slug atualiza a linha. |
| `title` | título curto (3 a 80 caracteres) |
| `body` | texto em linguagem simples (10 a 400 caracteres) |
| `published_at` | quando passa a aparecer (padrão: agora) |
| `expires_at` | quando some (padrão: agora + 3 dias) |
| `pr_url` | link do PR no GitHub, opcional, só para rastrear (o app não mostra) |

- **Leitura:** só quem está logado, e só o que já foi publicado e ainda não expirou (RLS).
- **Escrita:** só `service_role` (workflow abaixo ou painel do Supabase). Ninguém escreve pelo app.

## Publicar a partir do PR
1. No corpo do PR, preencha a seção do modelo (`.github/pull_request_template.md`):
   ```
   ## Novidade para quem usa
   Título: Veja quem está em call
   Texto: Passe o mouse no ícone de um servidor para ver quem está na call agora.
   ```
   Escreva para quem usa o NACALL: o que a pessoa vê e faz, sem termos técnicos (o script recusa palavras como
   "PR", "deploy", "API", "migration", "fix"). Sem a seção, nada é publicado.
2. **HML:** ao mesclar o PR na `release`, o workflow **Novidades do sino** publica sozinho no Supabase de homologação.
3. **PRD:** depois que a produção estiver no ar, rode à mão: Actions > Novidades do sino > Run workflow, branch `main`,
   ambiente `prd`, número do PR. Usa o ambiente `production` (aprovação humana, como a Esteira).

Para testar sem gravar nada: `node scripts/novidade.mjs --pr 142 --dry-run` (precisa do `gh` logado).

## Configuração externa (uma vez)
Em GitHub > Settings > Secrets and variables > Actions (nunca no código):
- `HML_SUPABASE_URL` e `HML_SUPABASE_SERVICE_ROLE_KEY`: projeto de homologação.
- `PRD_SUPABASE_URL` e `PRD_SUPABASE_SERVICE_ROLE_KEY`: **só como secrets do ambiente `production`**.

Sem os secrets, o workflow avisa e não publica nada (não falha).

## Publicar à mão
No SQL Editor do Supabase:
```sql
insert into public.product_updates(slug,title,body) values('aviso-manutencao','Manutenção rápida','Hoje às 23h o NACALL fica fora do ar por alguns minutos.');
```
Para tirar antes da hora: `update public.product_updates set expires_at=now() where slug='aviso-manutencao';`
