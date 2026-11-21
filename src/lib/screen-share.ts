/** Compartilhar tela depende de `getDisplayMedia`, que o Safari do iPhone e o Chrome/Firefox do Android não oferecem.
 * Sem checar antes, o LiveKit falha com "getDisplayMedia not supported" e a pessoa não entende o que houve. */
export const SCREEN_UNSUPPORTED_MESSAGE = 'Este celular/navegador não permite compartilhar a tela. Use o computador para transmitir; no celular dá para assistir normalmente.';

export function canShareScreen(nav: Pick<Navigator, 'mediaDevices'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return typeof nav?.mediaDevices?.getDisplayMedia === 'function';
}

/** Onde o seletor do navegador já abre: aba, janela ou tela inteira. É só uma dica (Chrome, Edge e Brave respeitam;
 * outros navegadores ignoram). Quem decide o que é compartilhado é sempre a pessoa, no seletor do navegador. */
export type ShareSurface = 'browser' | 'window' | 'monitor';
export const SHARE_SURFACES: { id: ShareSurface; label: string; hint: string }[] = [
  { id: 'monitor', label: 'Tela inteira', hint: 'Tudo o que aparece no monitor' },
  { id: 'window', label: 'Uma janela', hint: 'Só um programa, como o jogo' },
  { id: 'browser', label: 'Aba do navegador', hint: 'Melhor para vídeo com som' },
];
