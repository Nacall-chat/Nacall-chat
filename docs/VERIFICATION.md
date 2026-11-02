# Verificação — NACALL

Verificação local em 02/11/2026.

- Oito testes automatizados aprovados: validação e PostgreSQL PGlite com RLS, amizades, DMs, convites, isolamento, limites, recuperação privada, música por membro e avatar por proprietário.
- Build de produção Next.js/webpack e TypeScript aprovados. Turbopack não é usado devido a uma falha de subprocesso neste Windows.
- Serviços reais: cadastro/login por usuário, senha incorreta, compatibilidade com conta antiga, recuperação e rotação de código, amizade, DM, convite, música por Realtime e tokens LiveKit com fontes de tela verificados pelo script de integração.
- Navegador: perfil salvo, foto enviada ao Storage, temas claro/escuro, ajustes e push-to-talk; duas contas QA conectadas simultaneamente ao LiveKit com microfones desligados. Player oficial YouTube carregou e reproduziu vídeo de teste; pausa compartilhada exercitada.
- Dados QA são temporários e devem ser removidos com `scripts/integration-smoke.mjs --cleanup` após a inspeção.

Não foi validada a qualidade de áudio entre dispositivos físicos, captura de tela/câmera, áudio do sistema, reconexão sob perda de rede nem carga de muitos usuários. Esses itens exigem testes manuais; uma conexão com microfones desligados não comprova qualidade de mídia.

A publicação NACALL deve ser confirmada no domínio público após o novo build da Vercel. O estado de uma publicação anterior RCM-CALL não comprova a atualização.

Publicação confirmada em 02/11/2026: deployment `dpl_FUxPQHyUogxTQrpbdJnxVNzRgexj`, estado READY, alias https://rcm-call.vercel.app. Login real por username exercitado no domínio público com conta QA. Contas, avatar e lobby QA removidos ao final; contas anteriores preservadas. Navegador público sem transbordamento horizontal na largura observada de 1280 px. O controle de viewport desta sessão não aplicou a largura solicitada de celular; repetir o aceite em um aparelho real.

## Atualização de grupos — publicada em 02/11/2026

Migration 004 aplicada no Supabase com aprovação específica. Tabelas server_roles/member_roles, coluna de foto e políticas conferidas no catálogo. O editor também continha uma consulta antiga após o commit: ela falhou ao tentar recriar profiles, sem alterar a tabela existente; as mudanças da 004 foram confirmadas por consulta e pelo teste real.

Nove testes automatizados passaram. O script groups-smoke.mjs confirmou no Supabase real: edição do grupo, cargo delegado, bloqueio de escalada, criação delegada de canal, convite limitado, reentrada sem consumir uso extra, preview anônimo e leitura compartilhada da música.

No navegador: nome/descrição salvos, foto convertida e enviada ao Storage, cargo criado e atribuído, preview do convite antes do login, convite preservado após login e entrada com um clique abrindo o canal geral. Na call QA com microfone fechado, 1080p selecionável confirmado. DJ: zero iframes antes de ativar; um após ativar; zero após silenciar localmente. Estado compartilhado da música preservado.

O teste antigo de música Realtime excedeu 15 segundos em duas execuções, mesmo com subscription SUBSCRIBED e room_media presente na publicação. Não foi corrigida ou validada a entrega instantânea de eventos nesta sessão. A consulta de reserva do app a cada 10 segundos e a leitura de estado por outro usuário funcionam; a sincronização pode demorar e não é exata. Captura física em 1080p, áudio do sistema e qualidade de microfone entre aparelhos permanecem para aceite manual.

Publicação oficial CLI Vercel: dpl_3LMebddRuWsfNXHD5QpxhpuQuhjP, READY, alias https://nacall.vercel.app. Login QA e configurações do grupo verificados no domínio público. API de informações da música retornou 200 com título real; token de voz anônimo retornou 401. Credenciais e pasta QA foram excluídas do envio conforme inspeção dry-run.

Todas as contas QA, grupo, cargos, convites e foto temporária foram apagados ao final. Contas e grupos anteriores preservados.

## Identidade gamer, layout e capas — verificação de 02/11/2026

Dez testes passaram: relógio compartilhado com preservação/reinício, RLS e Storage de capa, além dos testes anteriores. Build local completo passou. Migration 005 aplicada no Supabase real: coluna cover_path, bucket e políticas limitadas ao proprietário.

QA no navegador e LiveKit real: chamada com microfone desligado abriu no centro; selecionar geral manteve a conexão e mostrou participantes compactos na lateral. Duas contas conectadas usaram o mesmo startedAt (1793654129000). A saída da primeira preservou esse início com um participante. Sala vazia retornou count=0 e startedAt=null; botão voltou a “Entrar na call”. Nova sessão retornou início 1793654414000. Captura de tela/microfone físicos não foram ativados.

GIF real de dois frames enviado ao Storage e atribuído ao perfil QA; bytes de download idênticos ao original, imagem carregada no navegador. Upload na pasta do outro usuário rejeitado. O editor aceita também imagens convertidas para WebP; teste visual do seletor de arquivo desta versão não foi repetido. Capa e todos os fixtures QA removidos ao final.

Identidade aplicada em marca, entrada, avatar de marca e favicon; arquivos WebP para o site, PNG separados para redes sociais. Quatro assets derivados com image_gen, transparência verificada (alpha no canto=0). O arquivo de logo com personagem inclui brilho suave; a marca de texto é a opção mais limpa.

Publicação confirmada: dpl_3SD73bwPnGQwi3L4fD4AiWG23vZF, READY, alias https://nacall.vercel.app. As três imagens da identidade carregaram no domínio público; endpoint de salas sem sessão retornou 401.

