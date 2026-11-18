import { parseSound, soundKey } from './avisos';

/** Som curto de mensagem nova, gerado na hora (sem arquivo): duas notas suaves. Respeita a escolha da pessoa de ligar ou desligar. */
export function soundEnabled(): boolean {
  try { return parseSound(localStorage.getItem(soundKey)); } catch { return true; }
}
export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(soundKey, on ? '1' : '0'); } catch { /* sem armazenamento: vale até recarregar */ }
}

let context: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** Os navegadores só liberam som depois de um toque ou tecla; chame isso na primeira interação. */
export function primeSound() {
  const ctx = audio();
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => {});
}

/** Toca o aviso. Sem som liberado pelo navegador ainda, fica em silêncio em vez de tocar atrasado. */
export function playChime() {
  if (!soundEnabled()) return;
  const ctx = audio();
  if (!ctx) return;
  if (ctx.state !== 'running') { void ctx.resume().catch(() => {}); return; }
  const start = ctx.currentTime;
  for (const [frequency, delay] of [[880, 0], [1318.5, 0.17]] as const) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start + delay);
    gain.gain.exponentialRampToValueAtTime(0.16, start + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + delay + 0.34);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start + delay);
    osc.stop(start + delay + 0.36);
  }
}
