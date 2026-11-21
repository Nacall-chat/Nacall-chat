/** Trocar de call sem passar pela saída: a sessão nova entra no lugar da antiga. A antiga se desconecta ao sair da tela
 * e avisa "saí"; esse aviso não pode derrubar a call nova. Só vale como saída se ainda for a call da sala que avisou. */
export function isCurrentCall(current: { channelId: string } | null, channelId: string): boolean {
  return current?.channelId === channelId;
}
