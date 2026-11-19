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
