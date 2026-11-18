'use client';
import { useEffect, useRef, useState } from 'react';
import { Bell, RefreshCw, Sparkles, Volume2, VolumeX } from 'lucide-react';
import type { DM, Profile } from '@/lib/types';
import { ago, badgeText, previewOf, unreadTotal, type UnreadDm } from '@/lib/unread';
import { avisos, avisosKey, parseAvisosRead, unreadAvisos, updateAvailable, withRead } from '@/lib/avisos';
import { UPDATE_ID, whatsNewKey } from '@/lib/novidades';
import { playChime, primeSound, setSoundEnabled, soundEnabled } from '@/lib/notify-sound';
import { Avatar } from './avatar';

const BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? '';

/** Há uma versão nova no ar? Confere ao abrir, a cada 5 minutos e quando a aba volta ao foco. Em desenvolvimento (sem versão) nunca avisa. */
function useNewVersion() {
  const [latest, setLatest] = useState('');
  useEffect(() => {
    if (!BUILD) return;
    let live = true;
    const check = async () => {
      try {
        const response = await fetch('/api/version', { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { id?: unknown };
        if (live && typeof data.id === 'string') setLatest(data.id);
      } catch { /* sem rede: tenta de novo depois */ }
    };
    const visible = () => { if (document.visibilityState === 'visible') void check(); };
    void check();
    const timer = window.setInterval(visible, 300000);
    document.addEventListener('visibilitychange', visible);
    return () => { live = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return updateAvailable(BUILD, latest);
}

function readAvisos(userId: string): string[] {
  try {
    const stored = parseAvisosRead(localStorage.getItem(avisosKey(userId)));
    // Quem já viu o carrossel de novidades não recebe esse aviso como novo.
    return localStorage.getItem(whatsNewKey(userId)) === '1' ? withRead(stored, [UPDATE_ID]) : stored;
  } catch { return []; }
}

/**
 * Sino: mensagens novas de DMs, avisos de atualização do NACALL e a chave do som de aviso.
 * Abrir o sino marca os avisos como vistos; as mensagens só saem quando a conversa é aberta.
 */
export function NotificationBell({ userId, me, items, dms, profiles, getName, openConversation }: { userId: string; me: string; items: UnreadDm[]; dms: DM[]; profiles: Record<string, Profile>; getName: (id: string) => string; openConversation: (dmId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [read, setRead] = useState<string[]>([]);
  const [sound, setSound] = useState(true);
  const fresh = useRef<Set<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const newVersion = useNewVersion();

  useEffect(() => { setRead(readAvisos(userId)); setSound(soundEnabled()); }, [userId]);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const unseen = unreadAvisos(read);
  const messages = unreadTotal(items);
  const count = messages + unseen.length + (newVersion ? 1 : 0);

  function toggle() {
    if (open) { setOpen(false); return; }
    const current = readAvisos(userId);
    const pending = unreadAvisos(current);
    fresh.current = new Set(pending.map(a => a.id));
    if (pending.length) {
      const next = withRead(current, pending.map(a => a.id));
      try { localStorage.setItem(avisosKey(userId), JSON.stringify(next)); } catch { /* vale até recarregar */ }
      setRead(next);
    } else setRead(current);
    setOpen(true);
  }
  function toggleSound() {
    const next = !sound;
    setSound(next);
    setSoundEnabled(next);
    if (next) { primeSound(); playChime(); } // toca uma vez para a pessoa ouvir como é
  }
  function openSlides() { setOpen(false); window.dispatchEvent(new Event('nacall-open-novidades')); }

  const label = count > 0 ? `Notificações: ${count} novas` : 'Notificações';
  return <div className="bell-wrap" ref={root}>
    <button type="button" className="bell" aria-label={label} title="Notificações" aria-haspopup="dialog" aria-expanded={open} onClick={toggle}>
      <Bell size={19} />{count > 0 && <span className="bell-badge" aria-hidden="true">{badgeText(count)}</span>}
    </button>
    {open && <div className="bell-panel" role="dialog" aria-label="Notificações">
      <header><strong>Notificações</strong><button type="button" className="bell-sound" aria-pressed={sound} aria-label={sound ? 'Desligar o som de aviso' : 'Ligar o som de aviso'} title={sound ? 'Som de aviso ligado' : 'Som de aviso desligado'} onClick={toggleSound}>{sound ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></header>
      <div className="bell-body">
        {newVersion && <section className="bell-item bell-update"><RefreshCw size={18} aria-hidden="true" /><div><strong>Nova versão do NACALL</strong><p>Atualize para usar as novidades. Se você estiver numa call, ela é encerrada.</p><button type="button" className="primary" onClick={() => window.location.reload()}>Atualizar agora</button></div></section>}
        <h3>Mensagens</h3>
        {!items.length && <p className="bell-empty">Nenhuma mensagem nova.</p>}
        {items.map(item => {
          const dm = dms.find(d => d.id === item.dm_id);
          const other = dm ? (dm.user_a === me ? dm.user_b : dm.user_a) : '';
          return <button type="button" className="bell-item bell-message" key={item.dm_id} onClick={() => { setOpen(false); openConversation(item.dm_id); }}>
            <Avatar profile={profiles[other]} />
            <span className="bell-text"><strong>{getName(other)}</strong><small>{previewOf(item.last_kind, item.last_body)}</small></span>
            <span className="bell-meta"><time dateTime={item.last_at}>{ago(item.last_at)}</time><span className="unread-badge" aria-label={`${item.unread} mensagens não lidas`}>{badgeText(item.unread)}</span></span>
          </button>;
        })}
        <h3>Novidades do NACALL</h3>
        {avisos.map(aviso => <article className="bell-item bell-aviso" key={aviso.id}>
          <Sparkles size={18} aria-hidden="true" />
          <div className="bell-text"><strong>{aviso.title}{fresh.current.has(aviso.id) && <i className="bell-new" aria-label="Novo" />}</strong><small>{new Date(`${aviso.date}T12:00:00`).toLocaleDateString('pt-BR')}</small><p>{aviso.text}</p>{aviso.slides && <button type="button" className="link small" onClick={openSlides}>Ver novidades</button>}</div>
        </article>)}
      </div>
    </div>}
  </div>;
}
