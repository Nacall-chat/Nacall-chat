/** Regras de quem assiste a uma transmissão de tela. A pessoa escolhe: ninguém é forçado a assistir, e sair da
 * transmissão não tira ninguém da call (o vídeo e o áudio da tela deixam de chegar; a voz continua). */
export type WatchState = Record<string, boolean>;

/** Está assistindo? Chave = id da faixa da tela (cada transmissão nova começa do zero). A sua própria prévia
 * aparece por padrão; a dos outros só depois do "Assistir". */
export function isWatching(state: WatchState, trackSid: string, isLocal: boolean): boolean {
  return state[trackSid] ?? isLocal;
}

/** Guarda a escolha de assistir/sair de uma transmissão. */
export function setWatching(state: WatchState, trackSid: string, watching: boolean): WatchState {
  return { ...state, [trackSid]: watching };
}

type Pub = { isSubscribed: boolean; setSubscribed: (subscribed: boolean) => void };
type SharingParticipant = { screen?: (Pub & { trackSid: string }) | undefined; audio?: Pub | undefined };

/** Liga ou desliga o vídeo E o áudio da tela de acordo com a escolha. O áudio da tela é outra faixa: esquecê-la
 * deixava a transmissão tocando mesmo depois de "parar de assistir". Idempotente: só pede o que mudou. */
export function reconcileScreenSubscriptions(participants: SharingParticipant[], state: WatchState): void {
  for (const { screen, audio } of participants) {
    if (!screen) continue;
    const wanted = state[screen.trackSid] === true;
    for (const pub of [screen, audio]) if (pub && pub.isSubscribed !== wanted) pub.setSubscribed(wanted);
  }
}

/** Volume da transmissão (0 a 1) vindo do controle deslizante; valores fora da faixa são ajustados. */
export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}
