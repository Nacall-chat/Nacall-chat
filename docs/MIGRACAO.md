# Migração da infraestrutura para a conta da empresa

Objetivo: Vercel, Supabase e LiveKit vinculados à conta da empresa, com Homologação (branch `release`) e Produção (branch `main`), sem perder estrutura, configurações nem funcionalidades. O banco atual é de testes; os registros não precisam ser preservados.

Regras: nada antigo é apagado ou revogado antes da validação. Nenhum valor secreto entra neste arquivo, em commits, issues ou conversas; anote apenas onde o valor está.

O código não tem URLs ou chaves fixas: tudo vem das seis variáveis de `.env.example`. A migração é de configuração.

## Ambientes

| Ambiente | Branch | Vercel | Supabase | LiveKit |
| --- | --- | --- | --- | --- |
| Production | `main` | Production, `nacall.vercel.app` | projeto atual, transferido | projeto PRD novo |
| Homologação | `release` | Preview da branch `release`, domínio fixo (ex.: `nacall-hml.vercel.app`) | projeto HML novo | projeto HML novo |
| Development | local | `vercel env pull` do Preview | HML | HML |

Fluxo: branch de trabalho → PR para `release` → teste em homologação → PR `release` → `main`.

## Fase 1 — Contas da empresa (vocês)

- [ ] Senha do e-mail da empresa trocada e verificação em duas etapas ligada.
- [ ] Vercel: conta/time da empresa criado. Anotar o nome do time.
- [ ] Supabase: organização da empresa criada. Convidar o dono atual (on3ver) como membro, para ele poder transferir.
- [ ] LiveKit Cloud: conta da empresa criada, com dois projetos: `nacall-prd` e `nacall-hml`.

## Fase 2 — Conferência da estrutura antiga (on3ver, só leitura)

Vercel, projeto `rcm-call` (time ON3VER):
- [ ] Settings → Environment Variables: quais das seis existem em Production, Preview e Development (só os nomes).
- [ ] Settings → Domains: lista completa de domínios e se algum usa DNS externo.
- [ ] Settings → Git: está conectado a algum repositório? Qual branch de produção?
- [ ] Settings → Build: Node, comandos de instalação e build, diretório raiz.
- [ ] Integrations: alguma integração instalada (ex.: Supabase)? Integrações não são transferidas.
- [ ] Deployment Protection: ligada para Preview?

Supabase, projeto atual:
- [ ] Settings → General: nome, região e plano da organização.
- [ ] Integrations: sem conexão GitHub e sem log drains (exigência da transferência).
- [ ] Authentication → Sign In / Providers: Email ligado, "Confirm email" desligado, cadastros permitidos.
- [ ] Authentication → URL Configuration: Site URL e Redirect URLs.
- [ ] Storage: buckets `avatars`, `group-icons`, `profile-covers` presentes.
- [ ] Database → Publications → `supabase_realtime`: `messages`, `friendships`, `room_media`.

## Fase 3 — Homologação

- [ ] Supabase HML criado na organização da empresa, mesma região da produção.
- [ ] SQL Editor: aplicar em ordem `202611020001` → `202611020005` de `supabase/migrations`. Não aplicar `rollback_groups_permissions.sql`.
- [ ] Auth do HML igual ao da produção (Email ligado, "Confirm email" desligado; Site URL = domínio de homologação).
- [ ] Vercel: Preview com as seis variáveis apontando para Supabase HML e LiveKit HML, restritas à branch `release`.
- [ ] Vercel: domínio de homologação atribuído à branch `release`.
- [ ] Testes automáticos contra HML: `pnpm typecheck`, `pnpm test`, `pnpm build`, `scripts/check-services.mjs`, `scripts/integration-smoke.mjs` (cria e apaga dados QA).
- [ ] Testes manuais em dois dispositivos: cadastro, login, recuperação, amigos, DM, grupos, convites, música, voz, câmera, tela.

## Fase 4 — Transferências (on3ver inicia)

- [ ] Supabase: projeto atual → organização da empresa (Settings → General → Transfer project). URL e chaves continuam iguais.
- [ ] Vercel: projeto `rcm-call` → time da empresa (Settings → General → Transfer). Domínios, variáveis e deployments vão junto; integrações e logs não.
- [ ] Conferir `nacall.vercel.app` no ar, login funcionando.
- [ ] Conectar o repositório `Nacall-chat/Nacall-chat` no projeto transferido (produção = `main`).

## Fase 5 — LiveKit da produção

- [ ] Em horário sem calls: trocar `LIVEKIT_URL`, `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET` de Production para o `nacall-prd` e fazer redeploy.
- [ ] Testar voz, câmera e tela em produção com dois dispositivos.
- [ ] Só depois: desativar as chaves do LiveKit antigo.

## Fase 6 — Encerramento

- [ ] PR `release` → `main`.
- [ ] Atualizar `docs/CONFIGURATION-STATUS.md` com o novo estado (sem segredos).
- [ ] Projetos antigos mantidos por pelo menos duas semanas antes de qualquer remoção.

## Rollback

| Problema | Ação |
| --- | --- |
| Deploy quebrado | Vercel → Deployments → Instant Rollback para o anterior |
| LiveKit novo falhando | Voltar as três variáveis do LiveKit antigo e redeploy |
| Transferência Supabase | Transferir de volta para a organização antiga (URL e chaves não mudam) |
| Transferência Vercel | Transferir o projeto de volta ao time ON3VER |
