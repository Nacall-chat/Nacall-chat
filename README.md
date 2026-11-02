# NACALL

A play pode dar ruim. A resenha não.

App web em português com identidade original, Next.js, TypeScript, Tailwind, Supabase e LiveKit. Serviços reais; sem usuários ou chamadas simulados. A pasta continua `rcm-call` para preservar a configuração de hospedagem existente.

## Executar

Requer Node.js 24 e pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

No Windows, use `Copy-Item .env.example .env.local`. Abra http://localhost:3000.

## Configurar

Preencha as seis variáveis de `.env.example`. Somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são públicas. `SUPABASE_SERVICE_ROLE_KEY` e as credenciais LiveKit ficam no servidor; nunca use prefixo NEXT_PUBLIC nesses segredos.

Em um Supabase novo, aplique os cinco arquivos em `supabase/migrations/`, em ordem. Em uma instalação que já recebeu a primeira migration, aplique apenas as seguintes. A segunda preserva os dados existentes e cria Storage, música e recuperação; a terceira concede a leitura de perfis exclusivamente ao serviço de autenticação no servidor. Não reaplique a primeira migration.

Habilite email/senha no Supabase Auth, com confirmação desativada para este fluxo: o servidor cria um endereço interno para novas contas. A interface pede apenas usuário e senha. Contas antigas mantêm suas identidades e podem entrar usando o username do perfil. Configure o domínio publicado em Site URL e Redirect URLs.

No LiveKit, crie credenciais e configure URL WSS, API key e API secret. O endpoint assina tokens somente para membros do servidor/canal autorizado.

## Recursos

- Cadastro e login por username; senha e código de recuperação de uso único, que deve ser salvo pelo usuário. Gerar outro código invalida o anterior. Sem email de recuperação para contas novas.
- Amigos, solicitações, DMs, servidores, convites com validade, canais de texto/voz e mensagens persistentes com Realtime.
- Perfil com nome personalizado, bio e foto; upload convertido para WebP com isolamento por usuário.
- Temas claro, escuro e sistema; identidade NACALL, fonte Manrope local e controles com ícones.
- Voz LiveKit com cards de participantes, foto, nome, indicação de fala, mic, ensurdecer, volume individual, dispositivos e qualidade de conexão.
- Supressão de ruído nativa do navegador, cancelamento de eco, ganho automático e push-to-talk segurando V. O processamento disponível depende do navegador/dispositivo; não é Krisp.
- Tela com limite solicitado de 1280×720 ou 1920×1080, 15/30 fps e áudio opcional quando o navegador permitir. Câmera opcional em 720p. A resolução efetiva depende da captura e conexão.
- DJ do lobby: link do YouTube, player oficial visível, estado compartilhado de tocar/pausar/remover, volume local e sincronização aproximada. Cada pessoa ativa seu player; vídeos restritos e bloqueio de autoplay podem impedir reprodução. Não é um bot que extrai áudio do YouTube.

## Estrutura

`src/app/api/auth` resolve login privado e recuperação. `src/app/api/account/recovery` renova códigos. `src/app/api/livekit/token` autoriza chamadas. `src/components` contém workspace, perfil, preferências, voz e música. `supabase/migrations` define tabelas, RLS, RPCs e Storage. `public/brand` inclui a identidade usada pelo app. `tests` cobre validação e permissões reais em PostgreSQL local.

O navegador usa Supabase Auth/Postgres/Realtime. As rotas do servidor guardam os segredos e emitem sessões/tokens; LiveKit transporta mídia. Recuperação e tentativas de login não têm acesso direto pelo cliente. As mensagens são renderizadas como texto.

## Verificar

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm start
```

Com credenciais reais:

```sh
node --env-file=.env.local scripts/check-services.mjs
node --env-file=.env.local scripts/integration-smoke.mjs
```

O segundo comando cria contas QA temporárias e apaga os dados no final. `--keep` é reservado a inspeção autorizada; após isso execute o mesmo script com `--cleanup`. Nunca publique `.env.local` ou `.local-tests`.

## Publicar na Vercel / GitHub

Importe o conteúdo desta pasta como projeto Next.js; Node 24, instalação `pnpm install --frozen-lockfile`, build `pnpm build`. Configure as seis variáveis em Production antes do build. Alterar variáveis públicas exige republicação. O ZIP não contém credenciais, dependências ou dados de teste. O workflow em `.github/workflows/ci.yml` executa tipos, testes e build quando enviado ao GitHub. Nenhum repositório remoto é criado automaticamente.

O domínio principal é `nacall.vercel.app`; a marca exibida é NACALL. Para usar domínio próprio, adicione-o na Vercel e atualize as URLs do Supabase.

## Limites desta versão

Não inclui diretório público, presença social completa, notificações push, moderação avançada, permissões por canal, reações/anexos/busca, chamada direta com toque, gravação, aplicativo nativo, bot de música ou transmissão 4K. A referência GoLive foi analisada pelas páginas públicas acessíveis; este é um produto próprio, sem promessa de reproduzir todos os recursos privados daquele serviço.

Sem email, a perda da senha e do código de recuperação impede recuperar uma conta nova pela interface. Microfone, câmera, compartilhamento de tela e áudio do sistema exigem permissão do navegador e validação manual nos dispositivos reais. Proteção contra abuso, moderação, backups, observabilidade e capacidade devem evoluir antes de abrir uma comunidade grande.

Veja `docs/VERIFICATION.md` e `docs/ACCEPTANCE.md` para evidências e testes pendentes.


## Atualização de grupos e transmissão

A migration `202611020004_groups.sql` adiciona perfil de grupo, ícone, cargos, atribuições e convites com limite de uso. Em produção, revise e aplique apenas essa nova migration. O arquivo `supabase/rollback_groups_permissions.sql` restaura a administração exclusiva do proprietário sem apagar grupos, mensagens ou cargos, caso seja necessário voltar ao app anterior.

Cargos possuem cor, prioridade de 1 a 999 e quatro permissões: editar grupo, criar/renomear canais, gerenciar cargos/membros e gerenciar convites. O proprietário está sempre acima de todos; um membro só pode criar/editar/atribuir cargos inferiores ao seu, gerenciar pessoas abaixo dele e conceder permissões que já possui. As permissões se somam; @todos pode conversar e participar das calls. Permissões por canal e cargos equivalentes a toda a matriz do Discord não fazem parte desta versão.

O perfil do grupo inclui nome, descrição e foto convertida em WebP. Configurações têm abas de perfil, cargos, membros, canais/calls e convites. Convites permitem validade de 1/7/30 dias e limite opcional de entradas. A página do link exibe o grupo antes do login, mantém o convite durante o cadastro e permite aceitar com um clique, abrindo um canal de texto. Preview público contém apenas nome, descrição, imagem e quantidade de membros de um convite válido; não expõe a lista de pessoas.

O transmissor escolhe 720p ou 1080p antes de compartilhar, com 15/30 fps. A escolha é um limite solicitado, não garantia de resolução ou taxa efetiva. Para mudar durante uma captura, pare e compartilhe novamente.

O DJ começa em modo leve: busca apenas informações da música, sem iframe do YouTube. “Não quero ouvir” afeta apenas o dispositivo local, descarrega o player e não pausa a música dos outros. Ativar escuta carrega o player oficial visível. Fechar o painel também descarrega o vídeo e interrompe a escuta local; ao reabrir, o player sincroniza novamente. Não há extração de áudio, reprodução invisível nem garantia de áudio sem tráfego de vídeo pelo YouTube.

## Identidade gamer, call lateral e capa de perfil

A marca usa o jacaré gamer com duas chuquinhas e headset. Artes separadas para redes sociais acompanham a entrega; no site são usadas versões WebP mais leves, com favicon PNG.

Ao entrar numa sala de voz, a área de chamada ocupa o centro. Abrir um canal de texto ou DM mantém a mesma conexão e leva a call para uma coluna lateral com participantes compactos. “Abrir call” retorna à área maior. Em telas pequenas, a call usa um painel inferior compacto.

O endpoint autenticado `/api/livekit/rooms` valida o acesso aos canais pelo RLS e consulta participantes reais no LiveKit. O início da sessão é mantido nos metadados da sala somente pelo servidor, compartilhado entre observadores; sair de um usuário não reinicia enquanto outro permanece. A sala vazia tem início nulo e o contador some. O próximo acesso pelo app verifica a ocupação antes de emitir o token e inicia uma nova sessão ao entrar. Consulta a cada 5 segundos; o relógio visual avança a cada segundo. Não é presença social inventada. Queda de rede pode adiar a detecção até o LiveKit confirmar a desconexão.

A migration `202611020005_profile_covers.sql` adiciona capa de perfil e Storage próprio. JPG/PNG/WebP são convertidos para WebP 1200×400; GIF até 5 MB é preservado para manter animação. Apenas o dono grava/remove objetos na própria pasta. A capa aparece nas configurações e no cartão aberto pelos avatares das mensagens/lista de membros. As capas são públicas por URL, assim como fotos de perfil; não envie informação privada na imagem.

## Colaborar

Repositório privado: https://github.com/on3ver/Nacall-chat . Consulte CONTRIBUTING.md para configurar um ambiente de desenvolvimento e enviar alterações.

O som de entrada usa public/audio/join-call.mp3, em volume moderado, e pode ser desativado nas preferências de áudio.

