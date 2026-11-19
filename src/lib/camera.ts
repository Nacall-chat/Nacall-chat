/** Faixa de câmera que vale mostrar no card. Desligar a câmera no LiveKit só deixa a faixa muda (a publicação continua
 * na sala), então uma faixa muda conta como câmera desligada e o card volta para a foto de perfil. */
export type CameraRef = { participant: { identity: string }; publication?: { isMuted: boolean } };
export function liveCamera<T extends CameraRef>(refs: T[], identity: string): T | undefined {
  return refs.find(ref => ref.participant.identity === identity && ref.publication !== undefined && !ref.publication.isMuted);
}
