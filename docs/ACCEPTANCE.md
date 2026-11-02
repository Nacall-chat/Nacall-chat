# Aceite manual — NACALL

1. Criar duas contas por username, guardar os códigos e entrar. Confirmar erro de senha incorreta, recuperação e invalidação do código antigo.
2. Editar nome/foto/bio; alternar claro/escuro/sistema e recarregar.
3. Solicitar/aceitar amizade, trocar DM, criar servidor, aceitar convite e trocar mensagens de canal entre dois navegadores.
4. Entrar na voz em dois dispositivos. Confirmar áudio, indicador de fala, mute, ensurdecer, volume individual e troca de microfone/saída.
5. Testar ruído, eco e ganho no navegador usado. Com push-to-talk ligado, só transmitir segurando V; sair da janela deve silenciar.
6. Compartilhar uma janela em 720p; testar 15/30 fps, finalizar pelo navegador e pelo app. Áudio de aba/sistema varia por navegador e origem de captura. Testar câmera separadamente.
7. Colocar link YouTube permitido; ativar player nos dois usuários; tocar/pausar/remover e ajustar volume local. Verificar erro de vídeo restrito e ressincronização.
8. Sair da chamada, trocar de servidor, recarregar, sair da conta. Conferir layout no celular e teclado, incluindo fechar o diálogo com Esc.
9. Confirmar que um não membro não lê mensagens, não controla música nem recebe token de voz do servidor privado.

Não use contas pessoais para automação destrutiva. Fixtures do script são identificadas por namespace QA e removidas ao final.

## Aceite da atualização de grupos

- Dono: criar cargo de prioridade 100 com permissão de cargos/canais/convites e atribuí-lo a um segundo usuário. Esse usuário pode criar cargo inferior e canal, mas não gerenciar o dono, o próprio cargo, outro de mesma prioridade, ou conceder uma permissão que não possui.
- Atualizar nome, descrição e foto; conferir a foto no seletor de grupos e na página de convite.
- Criar link com uma entrada máxima e abrir em sessão sem login: ver preview, fazer login e aceitar com um clique. Um segundo não membro deve receber aviso de limite. Revogar link e conferir que para de funcionar.
- Escolher 720p/1080p antes da captura; validar resolução negociada no dispositivo real.
- Música: confirmar ausência de iframe antes de ativar, ativar e depois silenciar somente localmente. Outro usuário deve continuar ouvindo. Fechar DJ deve descarregar o player local; reabrir deve ressincronizar.

## Aceite de call lateral, timer e capa

- Entrar na voz abre a call sem um chat empilhado acima. Abrir geral/DM mantém a conexão e move participantes para a lateral; “Abrir call” expande novamente.
- Em dois navegadores, verificar início compartilhado; sair do primeiro preserva o tempo com o segundo. Ao sair o último, o contador desaparece após a consulta de ocupação. Reentrar inicia nova contagem.
- Subir PNG/JPG/WebP e GIF de até 5 MB em Meu perfil. Conferir recorte de imagem 3:1, animação do GIF, remover capa e cartão de perfil aberto pelo avatar.
- Confirmar que usuário não consegue enviar capa para a pasta de outra pessoa. Não usar contas pessoais no teste automatizado.
