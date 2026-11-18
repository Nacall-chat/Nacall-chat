'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { Profile } from '@/lib/types';
import { profileTag } from '@/lib/identity';
import { presenceLine, stateLabel, statusHint, statusLabel, type PresenceInfo, type PresenceState, type PresenceStatus } from '@/lib/presence';
import { Avatar } from './avatar';
import { coverUrl } from './profile-card';

type Dot = PresenceState | 'invisible';
const dotLabel = (state: Dot) => (state === 'invisible' ? 'Invisível' : stateLabel[state]);

/** Bolinha de status: verde online, amarela ausente, cinza offline ou invisível. */
export function StatusDot({ state, className = '' }: { state: Dot; className?: string }) {
  return <span className={`status-badge ${state} ${className}`} role="img" aria-label={dotLabel(state)} />;
}

/** Avatar com a bolinha de status no canto (sem `state`, é só o avatar: pessoas que não são amigas não mostram status). */
export function PresenceAvatar({ profile, name, url, state }: { profile?: Profile; name?: string; url?: string; state?: Dot }) {
  return <span className="presence-avatar"><Avatar profile={profile} name={name} url={url} />{state && <StatusDot state={state} />}</span>;
}

/** Cartão que abre ao passar o mouse (só em telas com mouse): foto, nome, status, "visto pela última vez" e bio. */
export function ProfileHover({ profile, info, children, className = '' }: { profile?: Profile; info?: PresenceInfo; children: ReactNode; className?: string }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const pointer = useRef({ x: 0, y: 0 });
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const hide = () => { window.clearTimeout(timer.current); setPos(null); };
  const show = (e: React.MouseEvent) => {
    pointer.current = { x: e.clientX, y: e.clientY };
    if (!profile || !window.matchMedia('(hover: hover)').matches) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const { x, y } = pointer.current;
      const width = 300, height = 250;
      const left = x + 18 + width <= window.innerWidth - 8 ? x + 18 : Math.max(8, x - width - 18);
      setPos({ left, top: Math.min(Math.max(8, y - 36), Math.max(8, window.innerHeight - height - 8)) });
    }, 350);
  };
  return <span className={`hover-anchor ${className}`} onMouseEnter={show} onMouseMove={e => { pointer.current = { x: e.clientX, y: e.clientY }; }} onMouseLeave={hide} onClickCapture={hide}>
    {children}
    {pos && profile && createPortal(<div className="hover-card" style={{ top: pos.top, left: pos.left }} role="tooltip">
      <div className="hc-cover">{coverUrl(profile.cover_path) && <img src={coverUrl(profile.cover_path)} alt="" />}</div>
      <div className="hc-body">
        <PresenceAvatar profile={profile} state={info?.state} />
        <strong>{profileTag(profile)}</strong>
        <small>@{profile.username}</small>
        {info && <p className="hc-status"><StatusDot state={info.state} className="inline" />{presenceLine(info)}</p>}
        {profile.bio && <p className="hc-bio">{profile.bio}</p>}
      </div>
    </div>, document.body)}
  </span>;
}

/** Menu do próprio status, como no Discord: online, ausente ou invisível. */
export function StatusMenu({ profile, status, setStatus, onError }: { profile?: Profile; status: PresenceStatus; setStatus: (next: PresenceStatus) => Promise<boolean>; onError: (message: string) => void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);
  const dot: Dot = status === 'invisible' ? 'invisible' : status;
  async function choose(next: PresenceStatus) {
    setOpen(false);
    if (next === status) return;
    if (!(await setStatus(next))) onError('Não foi possível trocar o status agora.');
  }
  return <div className="status-menu-wrap" ref={root}>
    <button type="button" className="account-avatar" aria-haspopup="menu" aria-expanded={open} aria-label={`Seu status: ${statusLabel[status]}. Trocar`} title={`Seu status: ${statusLabel[status]}`} onClick={() => setOpen(v => !v)}>
      <PresenceAvatar profile={profile} state={dot} />
    </button>
    {open && <div className="status-menu" role="menu" aria-label="Escolher status">
      {(['online', 'away', 'invisible'] as const).map(option => <button type="button" role="menuitemradio" aria-checked={option === status} key={option} onClick={() => void choose(option)}>
        <StatusDot state={option} className="inline" />
        <span><strong>{statusLabel[option]}</strong><small>{statusHint[option]}</small></span>
        {option === status && <Check size={15} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>;
}
