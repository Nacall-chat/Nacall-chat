'use client';
import { useEffect, useState } from 'react';
import { rmsOf, speakingStep, type SpeakingState } from '@/lib/speaking';

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
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      const next = speakingStep(state, rmsOf(samples), performance.now());
      if (next.on !== state.on) setSpeaking(next.on);
      state = next;
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(frame); try { source.disconnect(); } catch { /* já desligado */ } void ctx.close().catch(() => {}); setSpeaking(false); };
  }, [track, enabled]);
  return speaking;
}
