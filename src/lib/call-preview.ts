import type { RoomPerson, RoomSnapshot } from './room-clock';

/** Quem está em call num servidor: as pessoas de todas as salas de voz dele, sem repetir quem aparece em duas salas. */
export function serverCallPeople(voiceChannelIds: string[], roomOf: (channelId: string) => RoomSnapshot | undefined): RoomPerson[] {
  const seen = new Set<string>();
  const people: RoomPerson[] = [];
  for (const id of voiceChannelIds) for (const person of roomOf(id)?.participants ?? []) {
    if (seen.has(person.id)) continue;
    seen.add(person.id);
    people.push(person);
  }
  return people;
}

/** O popover mostra até `max` rostos; o resto vira "+N" (no máximo "+99", como no Discord). */
export function callPreview<T>(people: T[], max = 5): { shown: T[]; extra: number } {
  const limit = Math.max(0, Math.floor(max));
  return { shown: people.slice(0, limit), extra: Math.max(0, people.length - limit) };
}
export const extraLabel = (extra: number) => `+${Math.min(99, Math.max(0, extra))}`;

/** Popover ao lado do ícone do servidor: à direita dele, centralizado na altura, sem sair da tela. */
export function placeRailPopover(anchor: { right: number; top: number; bottom: number }, viewportHeight: number, height = 92, gap = 12, margin = 8): { left: number; top: number } {
  const center = (anchor.top + anchor.bottom) / 2;
  const top = Math.min(Math.max(margin, center - height / 2), Math.max(margin, viewportHeight - height - margin));
  return { left: anchor.right + gap, top };
}
