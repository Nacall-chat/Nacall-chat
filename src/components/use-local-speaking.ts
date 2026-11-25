'use client';
import { useEffect, useState } from 'react';
import { rmsOf, SPEAK_SAMPLE_MS, speakingStep, type SpeakingState } from '@/lib/speaking';

/** `true` enquanto a pessoa fala, medido no microfone dela (instantâneo; o servidor só avisa depois). */
export function useLocalSpeaking(track: MediaStreamTrack | undefined, enabled: boolean) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!track || !enabled || track.readyState !== 'live') { setSpeaking(false); return; }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    let ctx: AudioContext;
    try { ctx = new Ctor(); } catch { return; }
    const source = ctx.createMediaStreamSource(new MediaStream([track]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let state: SpeakingState = { on: false, lastLoud: 0 };
    // 20 leituras por segundo bastam para o indicador. Antes era a cada quadro da tela
    // (144 ou 240 vezes por segundo num monitor gamer), disputando CPU com o jogo.
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      const next = speakingStep(state, rmsOf(samples), performance.now());
      if (next.on !== state.on) setSpeaking(next.on);
      state = next;
    };
    tick();
    const timer = window.setInterval(tick, SPEAK_SAMPLE_MS);
    return () => { window.clearInterval(timer); try { source.disconnect(); } catch { /* já desligado */ } void ctx.close().catch(() => {}); setSpeaking(false); };
  }, [track, enabled]);
  return speaking;
}
