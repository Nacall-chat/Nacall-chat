# Contribuir com o NACALL

Este é um repositório privado. As credenciais não acompanham o código.

1. Clone https://github.com/Nacall-chat/Nacall-chat.git e entre na pasta Nacall-chat.
2. Instale Node.js 24 e pnpm 11.25.0.
3. Execute `pnpm install --frozen-lockfile`.
4. Copie `.env.example` para `.env.local` e preencha as seis variáveis com credenciais de desenvolvimento, compartilhadas por um canal privado.
5. Em um Supabase novo, aplique os seis arquivos de `supabase/migrations` em ordem. Em bancos existentes, aplique somente migrations ainda não executadas. Não use o banco de produção para testes.
6. Configure um projeto LiveKit de desenvolvimento e siga as instruções de Auth no README.
7. Execute `pnpm dev` e abra http://localhost:3000.

Antes de enviar alterações, execute `pnpm typecheck`, `pnpm test` e `pnpm build`. Os testes locais de banco usam PostgreSQL em memória; os scripts de integração com serviços reais exigem credenciais e criam dados QA temporários, que devem ser limpos.

Crie uma branch por alteração, envie e abra um pull request para main. Inclua o que mudou e como foi verificado. O fluxo completo (branch, PR para `release`, teste em homologação e PR para `main`) está descrito na skill `.claude/skills/nacall-fluxo/SKILL.md`, que o Claude Code carrega automaticamente ao abrir o projeto. Nunca envie .env.local, tokens, credenciais, dados de usuários ou arquivos .local-tests. Alterações de banco devem ter uma nova migration revisável.

O upload para GitHub não copia contas, mensagens ou configurações dos serviços. A publicação atual na Vercel é independente deste clone; não altere as configurações de produção sem coordenar com o responsável.

A identidade usada no app fica em public/brand. Os arquivos de marca para redes sociais ficam em brand/social.

