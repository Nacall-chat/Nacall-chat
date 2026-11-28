'use client';
import { createPortal } from 'react-dom';
import { Headphones } from 'lucide-react';
import type { Profile, Server } from '@/lib/types';
import type { RoomPerson } from '@/lib/room-clock';
import { callPreview, extraLabel } from '@/lib/call-preview';
import { Avatar } from './avatar';
import { GroupIcon } from './group-icon';

/**
 * Popover do rail: ao passar o mouse (ou focar pelo teclado) num servidor com gente em call, mostra o nome e os rostos
 * de quem está na call, com "+N" para o excedente. Sem ninguém em call, não aparece.
 */
export function CallPopover({ server, people, profiles, position }: { server: Server; people: RoomPerson[]; profiles: Record<string, Profile>; position: { left: number; top: number } }) {
  if (!people.length) return null;
  const { shown, extra } = callPreview(people, 5);
  const names = people.slice(0, 3).map(p => profiles[p.id]?.display_name || p.name).join(', ');
  return createPortal(<div className="rail-call-popover" role="tooltip" style={{ left: position.left, top: position.top }}>
    <div className="rcp-head"><GroupIcon server={server} /><strong>{server.name}</strong></div>
    <div className="rcp-row" aria-label={`${people.length} ${people.length === 1 ? 'pessoa' : 'pessoas'} em call: ${names}${people.length > 3 ? ' e mais' : ''}`}>
      <Headphones size={17} aria-hidden="true" />
      <span className="rcp-faces">{shown.map(p => <Avatar key={p.id} profile={profiles[p.id]} name={p.name} url={p.avatar} />)}</span>
      {extra > 0 && <span className="rcp-extra">{extraLabel(extra)}</span>}
    </div>
  </div>, document.body);
}
