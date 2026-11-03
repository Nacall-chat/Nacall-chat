---
name: nacall-fluxo
description: Fluxo de entrega do projeto Nacall-chat. Use quando for criar uma feature, correção ou hotfix e levá-la até a homologação e a produção: cria a branch, implementa, verifica, abre o PR para release, testa em HML e, só depois, prepara o PR release para main.
---

# Fluxo de entrega NACALL

Repositório: `Nacall-chat/Nacall-chat` (privado). Ambientes: **HML** (`release`, https://nacall-hml.vercel.app) e **PRD** (`main`, https://nacall.vercel.app). Detalhes da esteira em `docs/DEPLOY.md` e da infraestrutura em `docs/MIGRACAO.md`.

```
feat/* → PR para release → CI + Preview → merge → Esteira publica em HML → teste
PR release → main (merge commit) → revisão → merge → a Vercel (projeto nacall-prd) publica em PRD
```

## Regras que valem sempre

1. **Nunca digite, leia ou peça segredos** (tokens, chaves de API, senhas, service role, secrets do LiveKit). Se faltar uma credencial, diga onde a pessoa deve cadastrá-la e pare. Não cole valores em commits, PRs, issues ou logs.
2. **Nunca faça push direto em `main` nem em `release`.** Todo trabalho entra por PR.
3. **Nunca faça force push** nem reescreva histórico publicado.
4. **Não faça merge sem a confirmação da pessoa**, a menos que ela tenha dito explicitamente "pode mesclar" para aquele PR. Isso vale em dobro para `release` → `main`.
5. **A aprovação da produção é humana:** é a revisão e o merge do PR `release` → `main`. Nunca mescle esse PR por conta própria nem finja a aprovação de outra pessoa.
6. **Nunca use credenciais de produção em HML, Preview ou testes.** Dados de QA só no Supabase de homologação.
7. **Não apague contas, grupos ou dados que você não criou.** Apague apenas o QA que você mesmo criou.
8. **Branches:** depois que a alteração chegar em produção, apague a branch de trabalho (remota e local). **Nunca apague `main` nem `release`.** Antes disso, mantenha a branch.

## Pré-requisitos (confira antes de começar)

- `gh auth status` logado com a conta do GitHub da pessoa. Se não estiver, ela precisa fazer `gh auth login`.
- Node 24 e `pnpm` 11.25.0 (`corepack enable`). No Windows PowerShell use `npx.cmd` em vez de `npx`.
- `pnpm install --frozen-lockfile` já executado.
- Para testar contra a homologação: `.env.local` com as credenciais de HML, que a pessoa obtém por canal privado. Nunca use as de produção.

## Passo a passo

### 1. Branch
```
git switch release && git pull
git switch -c feat/<assunto-curto>      # ou fix/<...>, hotfix/<...>
```
Parta sempre da `release` atualizada.

### 2. Implementar
- Mantenha a alteração pequena e focada; siga o estilo do código vizinho.
- Mudança de banco: **crie uma nova migration** em `supabase/migrations/` (nome `AAAAMMDDNNNN_descricao.sql`, com `begin; … commit;`, RLS ligado e `revoke`/`grant` explícitos). Nunca edite migrations antigas.
- Dados sensíveis (como email) nunca em `profiles`, que é legível por outros usuários; use tabela privada sem policies de cliente.
- Escreva testes (`tests/*.test.ts`). Banco local nos testes usa PGlite.
- Atualize README/CONTRIBUTING/docs se o comportamento mudar.

### 3. Verificar localmente
```
pnpm typecheck
pnpm test
pnpm build
```
Os três precisam passar. Se falhar, corrija antes de continuar; não abra PR quebrado.

### 4. Migration em HML (só se houver)
Aplique a migration nova no Supabase de **homologação** antes do código chegar lá, e confira o resultado (tabelas, RLS, permissões). Migrations devem ser aditivas para não quebrar a versão que está no ar. Para produção, **não aplique**: liste a migration no PR e na resposta final como pendência para a pessoa responsável.

### 5. Commit, push e PR para `release`
- Commits em português, descrevendo o motivo. Termine com a linha de coautoria da ferramenta, quando houver.
- `git push -u origin <branch>` e `gh pr create --base release`.
- Corpo do PR: o que mudou; como foi verificado (comandos e resultados reais); o que **não** foi verificado; migrations e ações pendentes para PRD.
- Aguarde a CI (`gh pr checks <n> --watch`). O Preview da Vercel exige login da Vercel; não crie bypass de proteção nem altere configurações de segurança.

### 6. Merge em `release` e teste em HML
- Com a CI verde e a confirmação da pessoa, mescle (`gh pr merge <n> --squash`) **sem apagar a branch**.
- Acompanhe a Esteira (`gh run list --branch release`): precisa terminar com **Verificar** e **HML** em sucesso.
- Teste a funcionalidade em https://nacall-hml.vercel.app de verdade (contas de QA criadas por você: cadastro, login e o fluxo alterado). Registre o que passou e o que ficou sem teste (mídia entre dispositivos, uploads, tempo real).
- Apague os dados de QA que criou e confirme que o banco voltou ao estado anterior, sem tocar em contas de outras pessoas.
- Se algo falhar em HML: corrija na mesma branch e abra novo PR para `release`. Não avance.

### 7. PR `release` → `main`
- Só depois de HML aprovado. Antes, `git fetch` e confira se `release` e `main` não divergiram (`git merge-base`); se `main` tiver commits que a `release` não tem, traga-os para a `release` primeiro.
- `gh pr create --base main --head release`, listando: o que entra, o que foi testado em HML, **migrations a aplicar em PRD antes do deploy** e qualquer variável de ambiente nova que precise ser cadastrada no `nacall-prd`.
- O PR deve ser mesclado com **"Create a merge commit"**, nunca squash (squash faz `release` e `main` divergirem e gera conflitos).
- **Não mescle sem a confirmação explícita da pessoa.**

### 8. Produção
- O merge em `main` faz a Vercel construir e publicar o projeto `nacall-prd` em https://nacall.vercel.app. Não há etapa extra de aprovação (`docs/DEPLOY.md`); a revisão é a do PR `release` → `main`.
- Antes do merge, lembre quem decide: migrations de PRD aplicadas no Supabase `nacall-prd`? variáveis novas cadastradas no `nacall-prd` (somente em Production)?
- Acompanhe o deploy (`vercel ls nacall-prd --scope nacall`) até **Ready** e confira o site (landing, `/login`, rotas de API respondendo). Em caso de problema: Instant Rollback na Vercel, em Deployments.
- Depois que a produção estiver publicada e conferida, **apague a branch de trabalho** (`git push origin --delete <branch>`, `git branch -D <branch>`, `git fetch --prune`) e confirme com `git branch -a` que só restaram `main`, `release` e o que estiver em andamento.

## Hotfix urgente
Mesmo caminho, com `hotfix/<assunto>` a partir da `release`: PR para `release`, HML, depois PR para `main`. Não pule a homologação.

## Relatório final (sempre)
Termine com: PRs abertos/mesclados (links), resultado de CI e Esteira, o que foi testado e o que **não** foi, migrations pendentes para PRD, ações que dependem de humanos e branches ainda abertas.
