'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Copy, LogOut, PlusCircle, Settings, Shield, UserPlus, X } from 'lucide-react';
import type { Server } from '@/lib/types';
import { serverMenuItems, serverMenuSections, type ServerMenuAction } from '@/lib/server-menu';

const icons: Record<ServerMenuAction, typeof Copy> = { invite: UserPlus, settings: Settings, 'create-channel': PlusCircle, roles: Shield, 'copy-id': Copy, leave: LogOut };

/**
 * Nome do grupo no topo da lateral, que abre o menu do grupo (como o menu de servidor do Discord).
 * Ao lado, o atalho de convite para quem pode convidar. Só aparece o que a pessoa pode fazer.
 */
export function ServerMenu({ server, me, can, onAction }: { server: Server; me: string; can: (permission: string) => boolean; onAction: (action: ServerMenuAction) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const items = serverMenuItems(server, me, can);
  const sections = serverMenuSections(items);
  const canInvite = items.some(item => item.id === 'invite');

  useEffect(() => { setOpen(false); }, [server.id]);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLElement>('[role=menuitem]')?.focus();
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  // Setas para cima e para baixo andam pelos itens; Home e End vão ao primeiro e ao último.
  function move(e: KeyboardEvent<HTMLDivElement>) {
    const list = [...(root.current?.querySelectorAll<HTMLElement>('[role=menuitem]') ?? [])];
    const at = list.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? at + 1 : e.key === 'ArrowUp' ? at - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
    if (next === null || !list.length) return;
    e.preventDefault();
    list[(next + list.length) % list.length]?.focus();
  }
  function choose(action: ServerMenuAction) { setOpen(false); onAction(action); }

  return <div className="server-menu-wrap" ref={root}>
    <h2 className="server-menu-head">
      <button type="button" ref={trigger} className="server-menu-trigger" aria-haspopup="menu" aria-expanded={open} aria-controls="server-menu" onClick={() => setOpen(v => !v)}>
        <span>{server.name}</span>{open ? <X size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
      </button>
    </h2>
    {canInvite && <button type="button" className="server-menu-invite" aria-label="Convidar amigos" title="Convidar amigos" onClick={() => onAction('invite')}><UserPlus size={18} /></button>}
    {open && <div className="server-menu" id="server-menu" role="menu" aria-label={`Menu do grupo ${server.name}`} onKeyDown={move}>
      {sections.map((group, index) => <div className="server-menu-group" role="group" key={group[0].section}>
        {index > 0 && <hr aria-hidden="true" />}
        {group.map(item => { const Icon = icons[item.id]; return <button type="button" role="menuitem" key={item.id} className={item.danger ? 'danger' : ''} onClick={() => choose(item.id)}>
          <span><strong>{item.label}</strong>{item.hint && <small>{item.hint}</small>}</span><Icon size={17} aria-hidden="true" />
        </button>; })}
      </div>)}
    </div>}
  </div>;
}
