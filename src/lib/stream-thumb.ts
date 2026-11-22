/** Prévia da transmissão de tela: um quadro pequeno (JPEG) que quem transmite publica de tempos em tempos num atributo do
 * próprio participante no LiveKit. Quem entra depois já recebe o último quadro, ele some junto com a transmissão (ou
 * quando a pessoa sai) e nada vai para disco ou banco de dados. Só viaja por atributo porque o token da call não
 * permite mensagens de dados. */
export const THUMB_ATTRIBUTE = 'nacall.thumb';
/** Primeiro quadro logo depois de começar (o vídeo precisa decodificar) e depois a cada intervalo. */
export const THUMB_FIRST_MS = 1500;
export const THUMB_INTERVAL_MS = 10_000;
/** Limite do texto base64 do quadro: ~10 KB de imagem. Bem abaixo do que o LiveKit aceita por atributo. */
export const THUMB_MAX_BASE64 = 14_000;
/** Tamanhos tentados em ordem: do melhor ao mais leve, até o quadro caber no limite. */
export const THUMB_STEPS: { width: number; quality: number }[] = [
  { width: 320, quality: 0.5 }, { width: 256, quality: 0.42 }, { width: 192, quality: 0.36 }, { width: 160, quality: 0.3 },
];
const PREFIX = 'data:image/jpeg;base64,';
/** Todo JPEG em base64 começa com "/9j/" (bytes FF D8 FF). */
const BASE64_JPEG = /^\/9j\/[A-Za-z0-9+/]+={0,2}$/;

/** Tamanho do quadro mantendo o formato da tela (ultrawide continua ultrawide). Nulo se o vídeo ainda não tem imagem. */
export function thumbSize(videoWidth: number, videoHeight: number, maxWidth: number): { width: number; height: number } | null {
  if (!(videoWidth > 0) || !(videoHeight > 0) || !(maxWidth > 0)) return null;
  const width = Math.min(maxWidth, Math.round(videoWidth));
  return { width, height: Math.max(1, Math.round((width * videoHeight) / videoWidth)) };
}

/** Do `canvas.toDataURL('image/jpeg')` para o valor publicado. Nulo se não for JPEG ou passar do limite (aí tenta um tamanho menor). */
export function thumbValue(dataUrl: string): string | null {
  if (!dataUrl.startsWith(PREFIX)) return null;
  const base64 = dataUrl.slice(PREFIX.length);
  return base64.length <= THUMB_MAX_BASE64 && BASE64_JPEG.test(base64) ? base64 : null;
}

/** Do atributo de outro participante para o `src` da imagem. Qualquer coisa que não seja um JPEG pequeno é descartada:
 * o valor vem de outra pessoa e nunca é usado sem conferir. */
export function thumbSrc(value: string | undefined): string | null {
  if (!value || value.length > THUMB_MAX_BASE64 || !BASE64_JPEG.test(value)) return null;
  return PREFIX + value;
}

/** Vale a pena gastar CPU e rede com a prévia? Só se alguém na sala ainda não está assistindo (é quem vê o cartão). */
export function needsThumb(remoteCount: number, viewers: number): boolean {
  return remoteCount > viewers;
}
