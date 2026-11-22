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

/** Igual ao Discord: só uma transmissão aberta por vez. Escolher uma fecha as outras (inclusive a sua prévia), que
 * voltam a ser cards com prévia na grade. Duas ou mais telas empilhadas ficavam confusas e cortadas. */
export function focusStream(state: WatchState, trackSid: string, watching: boolean, allSids: string[]): WatchState {
  if (!watching) return setWatching(state, trackSid, false);
  const next: WatchState = { ...state };
  for (const sid of allSids) if (sid !== trackSid) next[sid] = false;
  next[trackSid] = true;
  return next;
}

/** Qual transmissão fica aberta na área da call (no máximo uma): a escolhida pela pessoa ou, se ela não escolheu
 * nenhuma, a própria prévia de quem está transmitindo. */
export function openStreamSid(state: WatchState, streams: { sid: string; isLocal: boolean }[]): string | null {
  const chosen = streams.find(s => state[s.sid] === true);
  if (chosen) return chosen.sid;
  return streams.find(s => s.isLocal && state[s.sid] === undefined)?.sid ?? null;
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

/** Quem está assistindo. O LiveKit não conta os espectadores de uma faixa para quem transmite, então cada pessoa publica,
 * num atributo do próprio participante, os ids das transmissões que está de fato assistindo (o mesmo mecanismo do fone mudo).
 * Atributo de quem sai da sala some sozinho, e o número se atualiza em tempo real para todos. Vale só como contagem:
 * não é uma garantia de segurança. */
export const WATCH_ATTRIBUTE = 'nacall.watching';

/** Valor publicado: ids separados por vírgula, sem repetir e em ordem estável. Vazio remove o atributo. */
export function watchingValue(sids: string[]): string {
  return [...new Set(sids.filter(sid => sid && !sid.includes(',')))].sort().join(',');
}

export function parseWatching(value: string | undefined): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

type Person = { identity: string; isLocal: boolean; attributes: Record<string, string> };

/** Quantas pessoas assistem a esta transmissão. Não conta quem transmite (a prévia da própria tela não é plateia). Quem está
 * na tela conta a si mesmo na hora (`localWatching`), sem esperar o servidor devolver o atributo. */
export function countViewers(people: Person[], sid: string, sharerIdentity: string, localWatching = false): number {
  let count = localWatching ? 1 : 0;
  for (const person of people) {
    if (person.isLocal || person.identity === sharerIdentity) continue;
    if (parseWatching(person.attributes[WATCH_ATTRIBUTE]).includes(sid)) count += 1;
  }
  return count;
}

export function viewersLabel(count: number): string {
  return count > 0 ? `${count} assistindo` : 'Ninguém assistindo';
}
