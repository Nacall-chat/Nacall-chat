/** Detecção local de fala (medida no próprio microfone), para o indicador verde acender na hora, sem esperar o servidor. */
export const SPEAK_THRESHOLD = 0.015;
export const SPEAK_HOLD_MS = 350;
/** Intervalo entre leituras do microfone (ms): rápido o bastante para o indicador, leve para quem joga. */
export const SPEAK_SAMPLE_MS = 50;
export type SpeakingState = { on: boolean; lastLoud: number };

/** Volume (RMS, 0 a 1) de uma amostra de bytes no domínio do tempo (128 é o silêncio). */
export function rmsOf(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) { const d = (samples[i] - 128) / 128; sum += d * d; }
  return Math.sqrt(sum / samples.length);
}

/**
 * Acende assim que passa do limiar e só apaga depois de um instante de silêncio,
 * para não piscar entre as palavras.
 */
export function speakingStep(state: SpeakingState, rms: number, now: number, threshold = SPEAK_THRESHOLD, hold = SPEAK_HOLD_MS): SpeakingState {
  if (rms >= threshold) return { on: true, lastLoud: now };
  if (state.on && now - state.lastLoud > hold) return { on: false, lastLoud: state.lastLoud };
  return state;
}
