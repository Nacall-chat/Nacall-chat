# Balões, mensagens não lidas e sino

## Balões
Em canais e DMs, o que a pessoa envia fica à direita, num balão um pouco mais claro; o que os outros enviam fica à esquerda, mais escuro (`src/app/chat-bubbles.css`). Vale para texto, áudio e figurinha.

## Mensagens não lidas (DMs)
- **Banco** (`supabase/migrations/202611190002_leitura_de_dms.sql`, aditiva): tabela `dm_reads` (até quando cada pessoa leu cada DM; só o dono enxerga a própria linha e ninguém escreve direto nela), `mark_dm_read(dm)` (marca como lida agora, com a hora do servidor, só para quem participa da DM) e `unread_dms()` (quantas não lidas há em cada DM e a mais recente: tipo e prévia curta). `unread_dms` roda com os direitos de quem chama, então a RLS de `messages` limita tudo às próprias DMs. As DMs que já existiam começam como lidas.
- **App** (`src/components/use-unread.ts`): carrega ao entrar, atualiza em tempo real (mensagem nova numa DM e leitura em outro aparelho) e consulta de novo a cada 30 s (cobre falhas do tempo real e as DMs além das 100 que o filtro do tempo real aceita). A conversa aberta é marcada como lida ao abrir, a cada mensagem nova e quando a janela volta ao foco; com a aba em segundo plano ou sem foco, ela continua não lida.
- **Onde aparece:** bolinha vermelha com a contagem ao lado de cada DM, no botão de Amigos da barra de ícones, em "Mensagens" no menu de baixo (celular) e no sino.
- Só **DMs**. Canais de servidor não geram bolinha.

## Sino
Fica no topo, ao lado de "Atualizar" (`src/components/notification-bell.tsx`):
- **Mensagens:** uma linha por DM com não lidas (nome, prévia, quanto tempo e contagem); tocar abre a conversa.
- **Novidades do NACALL:** a lista de `src/lib/avisos.ts`. Para avisar de uma atualização, acrescente um item no topo (`id` único e fixo). Quem ainda não viu ganha a bolinha; abrir o sino marca como visto (por conta, neste navegador). O item com `slides: true` tem o botão "Ver novidades", que reabre o carrossel.
- **Nova versão:** `/api/version` devolve o hash do commit publicado (`VERCEL_GIT_COMMIT_SHA`, variável de sistema da Vercel em tempo de execução). A primeira resposta, ao abrir o app, vira a versão daquela aba; o app consulta de novo a cada 5 minutos e quando a aba volta ao foco. Se a resposta mudar, o sino mostra "Nova versão do NACALL" com o botão "Atualizar agora". Nunca recarrega sozinho (a pessoa pode estar numa call). Sem a variável de sistema da Vercel (em desenvolvimento, por exemplo), o aviso fica desligado.

## Som
Duas notas curtas, geradas na hora (`src/lib/notify-sound.ts`, sem arquivo de áudio). Toca quando chega mensagem de uma DM que a pessoa não está olhando. Não toca na carga inicial, na conversa aberta com a janela em foco nem com o som desligado (botão de alto-falante no sino, salvo neste navegador). O navegador só libera o som depois do primeiro toque ou tecla na página; antes disso o aviso fica em silêncio.

## Limites conhecidos
- Não há notificação do sistema nem aviso com o NACALL fechado (isso exigiria service worker e chaves de push). Tudo acontece com o app aberto.
- O estado de "avisos vistos" e a escolha do som ficam no navegador, não na conta. A leitura das DMs fica na conta e vale em todos os aparelhos.
