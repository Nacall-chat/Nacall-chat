---
name: nacall-fluxo
description: Fluxo de entrega do projeto Nacall-chat. Use quando for criar uma feature, correção ou hotfix e levá-la até a homologação e a produção: cria a branch, implementa, verifica, abre o PR para release, testa em HML e, só depois, prepara o PR release para main.
---

# Fluxo de entrega NACALL

Repositório: `Nacall-chat/Nacall-chat` (privado). Ambientes: **HML** (`release`, https://nacall-hml.vercel.app) e **PRD** (`main`, https://nacall.vercel.app). Detalhes da esteira em `docs/DEPLOY.md` e da infraestrutura em `docs/MIGRACAO.md`.

```
feat/* → PR para release → CI + Preview → merge → Esteira publica em HML (ou Run workflow na release, para repetir) → teste
PR release → main (merge commit) → revisão → merge (nada é publicado) → Actions > Site · Esteira (HML e PRD) > Run workflow (main) → PRD
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
9. **`main` e `release` andam sempre sincronizadas.** Toda vez que for abrir uma branch, abrir um PR ou terminar uma entrega, confira a sincronia (seção abaixo). Se `main` tiver commits que a `release` não tem, traga-os para a `release` por PR de sync (merge commit) **antes** de seguir. Depois de cada merge `release` → `main`, abra o PR de sync na hora.

## Pré-requisitos (confira antes de começar)

- `gh auth status` logado com a conta do GitHub da pessoa. Se não estiver, ela precisa fazer `gh auth login`.
- Node 24 e `pnpm` 11.25.0 (`corepack enable`). No Windows PowerShell use `npx.cmd` em vez de `npx`.
- `pnpm install --frozen-lockfile` já executado.
- Para testar contra a homologação: `.env.local` com as credenciais de HML, que a pessoa obtém por canal privado. Nunca use as de produção.

## Sincronia main ↔ release (confira sempre)

```
git fetch
git rev-list --left-right --count origin/release...origin/main   # "A B": A = só na release, B = só na main
git diff --stat origin/release origin/main                         # o que difere em arquivos
```
- **B precisa ser 0.** Se B > 0, a `main` tem commits (em geral o merge commit do último `release` → `main`) que a `release` não tem. Corrija antes de qualquer outra coisa:
  `git switch -c sync/main-para-release-AAAAMMDD origin/main` → `git push -u origin <branch>` → `gh pr create --base release --head <branch>` (normalmente **0 arquivos alterados**) → CI verde → mesclar com **"Create a merge commit"**, nunca squash (squash deixa as duas divergentes de novo). Peça a confirmação da pessoa para mesclar.
- **A > 0 é normal** enquanto há trabalho em HML ainda não promovido; ao promover, o PR `release` → `main` leva tudo e A volta a 0.
- Teste de conflito antes de abrir ou mesclar qualquer PR entre as duas: `git merge-tree --write-tree origin/main origin/release` (sem saída de conflito = pode seguir).
- **Quando conferir:** (1) antes de criar uma branch nova (passo 1); (2) antes de abrir o PR `release` → `main` (passo 7); (3) logo depois de mesclar esse PR, abrindo o sync (passo 7); (4) depois da produção publicada (passo 8); (5) no relatório final.
- Depois do sync, o esperado é **B = 0 e `git diff --stat origin/release origin/main` vazio** (o conteúdo é idêntico). O A pode ficar em 1: é o próprio merge commit do sync, que só existe na `release` e segue para a `main` junto com o próximo `release` → `main`. Isso é normal; B > 0 ou diff com arquivos, não. Registre o resultado no relatório.

## Passo a passo

### 1. Branch
```
git switch release && git pull
git switch -c feat/<assunto-curto>      # ou fix/<...>, hotfix/<...>
```
Parta sempre da `release` atualizada **e sincronizada com a `main`** (conferir a seção "Sincronia": B = 0). Se não estiver, faça o PR de sync primeiro.

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
- Só depois de HML aprovado. Antes, confira a sincronia (seção acima): se `main` tiver commits que a `release` não tem (B > 0), traga-os para a `release` primeiro, por PR de sync, e rode o teste de conflito (`git merge-tree`).
- `gh pr create --base main --head release`, listando: o que entra, o que foi testado em HML, **migrations a aplicar em PRD antes do deploy** e qualquer variável de ambiente nova que precise ser cadastrada no `nacall-prd`.
- O PR deve ser mesclado com **"Create a merge commit"**, nunca squash (squash faz `release` e `main` divergirem e gera conflitos).
- **Não mescle sem a confirmação explícita da pessoa.**
- **Logo depois de mesclar esse PR, abra o PR de sync `main` → `release`** (o merge commit só existe na `main`; sem o sync a `release` fica 1 ou 2 commits atrás e o próximo PR já nasce divergente). Mescle o sync com merge commit, com a confirmação da pessoa, e confira B = 0 e diff vazio.

### 8. Produção
- Mesclar na `main` **não publica**. A produção só muda quando alguém aperta **Run workflow** na Esteira (workflow "Site · Esteira (HML e PRD)", arquivo `esteira.yml`; GitHub → Actions → Site · Esteira → branch `main`) e o job PRD roda (`docs/DEPLOY.md`). Quem aperta o botão é humano: não dispare o PRD por conta própria, só a pedido explícito da pessoa.
- Antes do botão, lembre quem decide: migrations de PRD aplicadas no Supabase `nacall-prd`? variáveis novas cadastradas no `nacall-prd` (somente em Production)?
- Acompanhe (`gh run list --workflow esteira.yml`) e o deploy (`vercel ls nacall-prd --scope nacall`) até **Ready**; confira o site (landing, `/login`, rotas de API). Em caso de problema: Instant Rollback na Vercel, em Deployments.
- Confirme de novo que `main` e `release` estão sincronizadas (B = 0 e diff vazio). Só então, depois que a produção estiver publicada e conferida, **apague a branch de trabalho** (`git push origin --delete <branch>`, `git branch -D <branch>`, `git fetch --prune`) e confirme com `git branch -a` que só restaram `main`, `release` e o que estiver em andamento.

## Hotfix urgente
Mesmo caminho, com `hotfix/<assunto>` a partir da `release`: PR para `release`, HML, depois PR para `main`. Não pule a homologação.

## Relatório final (sempre)
Termine com: PRs abertos/mesclados (links), resultado de CI e Esteira, o que foi testado e o que **não** foi, migrations pendentes para PRD, ações que dependem de humanos, branches ainda abertas e **a sincronia `main` ↔ `release`** (resultado de `git rev-list --left-right --count origin/release...origin/main` e do `git diff --stat`; se B > 0 ou o diff tiver arquivos, diga o que falta para sincronizar).
