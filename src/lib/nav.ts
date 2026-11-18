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
