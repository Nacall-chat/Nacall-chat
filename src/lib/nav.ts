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
 * Como a call aparece no layout:
 * - celular: em tela cheia só quando a pessoa a abre (e sem conversa aberta); no resto vira uma janela flutuante sobre a tela atual (`call-float`), inclusive com um chat em tela cheia;
 * - desktop: ao lado do chat (`call-chat`), em foco (`call-focus`) ou escondida com uma faixa para voltar (`call-away`).
 */
export function shellCallClass({ voice, isMobile, callView, target }: { voice: boolean; isMobile: boolean; callView: boolean; target: boolean }): string {
  if (!voice) return '';
  if (isMobile) return callView && !target ? 'has-call call-focus' : 'call-float';
  if (target) return 'has-call call-chat';
  return callView ? 'has-call call-focus' : 'call-away';
}
