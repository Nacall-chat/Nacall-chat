export type MobileTab = 'home' | 'servers' | 'messages' | 'call';

/**
 * Qual botão do menu de baixo (celular) fica verde.
 * - Com a barra lateral aberta, vale o que ela mostra: servidores (se há um servidor escolhido) ou mensagens diretas;
 * - com a call em primeiro plano, "call";
 * - lendo uma conversa: mensagens (DM) ou servidores (canal);
 * - sem conversa: servidores se há um servidor aberto, senão início.
 */
export function mobileTabFor({ navOpen, serverId, target, inCallView }: { navOpen: boolean; serverId: string | null; target: { type: 'channel' | 'dm' } | null; inCallView: boolean }): MobileTab {
  if (navOpen) return serverId ? 'servers' : 'messages';
  if (inCallView) return 'call';
  if (target) return target.type === 'dm' ? 'messages' : 'servers';
  return serverId ? 'servers' : 'home';
}

/**
 * Como a call aparece no layout (celular e desktop seguem a mesma regra):
 * - os controles (mic, fone, câmera, tela, sair) ficam sempre na barra de voz, num lugar só, e a barra aparece em toda tela enquanto há call (`has-voice`);
 * - o painel da call (participantes, telas) só ocupa a tela quando a pessoa o abre e não há conversa aberta (`call-focus`);
 * - no resto do tempo ele fica escondido, conectado (`call-away`), e a conversa ou a tela atual usa a área toda.
 */
export function shellCallClass({ voice, callView, target }: { voice: boolean; callView: boolean; target: boolean }): string {
  if (!voice) return '';
  return callView && !target ? 'has-voice has-call call-focus' : 'has-voice call-away';
}
