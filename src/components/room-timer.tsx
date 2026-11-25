'use client';
import { useEffect, useState } from 'react';
import { durationLabel } from '@/lib/room-clock';

/**
 * Cronômetro da call. Fica num componente próprio para que só este texto mude a cada
 * segundo: antes o relógio ficava no app inteiro (ou na tela da chamada) e redesenhava
 * tudo uma vez por segundo, gastando CPU à toa enquanto a pessoa joga.
 * Com a janela escondida ele não atualiza; ao voltar, acerta na hora.
 */
export function RoomTimer({ start, offset = 0 }: { start: number | null; offset?: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!start) return;
    const update = () => { if (document.visibilityState !== 'hidden') setNow(Date.now()); };
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [start]);
  return <>{durationLabel(start, now + offset)}</>;
}
