'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMediaDeviceSelect } from '@livekit/components-react';
import { Camera, CameraOff, Check, ChevronUp, Headphones, Mic, MicOff, MonitorOff, MonitorUp, Music2, PhoneOff, Settings2, VolumeX, Wifi } from 'lucide-react';
import { buildDeviceList, outputSelectionSupported, pickDevice, saveMicPrefs } from '@/lib/mic';

export type VoiceBarProps = {
  /** `side`: cartão na barra lateral (desktop). `dock`: barra compacta acima do menu de baixo (celular). */
  variant: 'side' | 'dock';
  name: string;
  status: string;
  tone: 'ok' | 'wait' | 'bad';
  duration: string;
  mic: boolean;
  deaf: boolean;
  pushToTalk: boolean;
  screen: boolean;
  camera: boolean;
  music: boolean;
  settings: boolean;
  busy: boolean;
  onOpen: () => void;
  onMic: () => void;
  onDeaf: () => void;
  onScreen: () => void;
  onCamera: () => void;
  onMusic: () => void;
  onSettings: () => void;
  onLeave: () => void;
  report: (message: string) => void;
};

/** Lista de aparelhos da seta do microfone ou do fone. Só existe aberta, então só lê os aparelhos quando a pessoa pede. */
function DeviceMenu({ kind, report, close }: { kind: 'audioinput' | 'audiooutput'; report: (message: string) => void; close: () => void }) {
  // O LiveKit refaz a lista de aparelhos sempre que o onError muda; uma função nova a cada render gera um laço de renderização. Por isso ele é estável.
  const reportRef = useRef(report);
  reportRef.current = report;
  const onError = useCallback((e: Error) => reportRef.current(e.message), []);
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, onError });
  const input = kind === 'audioinput';
  const supported = input || outputSelectionSupported();
  const list = buildDeviceList(devices, kind);
  const current = pickDevice(list, activeDeviceId);
  async function choose(id: string) {
    try {
      await setActiveMediaDevice(id);
      saveMicPrefs(input ? { inputId: id, setupDone: true } : { outputId: id });
    } catch (e) { report(e instanceof Error ? e.message : 'Não foi possível trocar o aparelho.'); }
    close();
  }
  return <div className="vb-menu" role="menu" aria-label={input ? 'Escolher microfone' : 'Escolher saída de áudio'}>
    <strong>{input ? 'Microfone' : 'Saída de áudio'}</strong>
    {!supported || !list.length
      ? <p>{supported ? 'Nenhum aparelho encontrado.' : 'Este navegador não deixa escolher a saída de áudio. Ele usa a saída padrão do sistema.'}</p>
      : list.map(d => <button type="button" role="menuitemradio" aria-checked={d.id === current} key={d.id} onClick={() => void choose(d.id)}><span>{d.label}</span>{d.id === current && <Check size={15} aria-hidden="true" />}</button>)}
  </div>;
}

/**
 * Controles da call num lugar só, como no Discord: estado da conexão, microfone, fone e sair sempre à mão, em qualquer tela.
 * No desktop é um cartão acima do perfil (com as setas de aparelho, câmera, tela, DJ e ajustes); no celular é uma barra compacta acima do menu de baixo.
 * Fica fora do painel da call, que só aparece quando a pessoa o abre.
 */
export function VoiceBar(p: VoiceBarProps) {
  const [menu, setMenu] = useState<'mic' | 'out' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setMenu(null); };
    const escape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [menu]);

  const micLabel = p.pushToTalk ? 'Apertar para falar ativo: segure V' : p.mic ? 'Desligar microfone' : 'Ligar microfone';
  const deafLabel = p.deaf ? 'Voltar a ouvir a call' : 'Silenciar áudio da call';
  const micButton = <button type="button" className={`vb-btn ${p.mic ? '' : 'off'}`} aria-label={micLabel} aria-pressed={p.mic} title={micLabel} disabled={p.busy || p.pushToTalk} onClick={p.onMic}>{p.mic ? <Mic size={19} /> : <MicOff size={19} />}</button>;
  const deafButton = <button type="button" className={`vb-btn ${p.deaf ? 'off' : ''}`} aria-label={deafLabel} aria-pressed={p.deaf} title={deafLabel} onClick={p.onDeaf}>{p.deaf ? <VolumeX size={19} /> : <Headphones size={19} />}</button>;
  const info = <button type="button" className="vb-info" aria-label={`Abrir a call ${p.name}`} title="Abrir a call" onClick={p.onOpen}>
    <span className={`vb-signal ${p.tone}`}><Wifi size={16} /></span>
    <span className="vb-text"><strong className={p.tone}>{p.status}</strong><small>{p.name}{p.duration ? ` · ${p.duration}` : ''}</small></span>
  </button>;
  const leave = <button type="button" className="vb-btn vb-leave" aria-label="Sair da call" title="Sair da call" onClick={p.onLeave}><PhoneOff size={19} /></button>;

  if (p.variant === 'dock') return <div className="voice-bar dock" ref={root} role="group" aria-label="Controles da call">{info}{micButton}{deafButton}{leave}</div>;

  const split = (which: 'mic' | 'out', button: React.ReactNode, label: string) => <div className="vb-split">{button}<button type="button" className="vb-chev" aria-label={label} aria-haspopup="menu" aria-expanded={menu === which} onClick={() => setMenu(menu === which ? null : which)}><ChevronUp size={13} /></button></div>;
  return <div className="voice-bar side" ref={root} role="group" aria-label="Controles da call">
    <div className="vb-top">{info}{leave}</div>
    <div className="vb-row">{split('mic', micButton, 'Escolher microfone')}{split('out', deafButton, 'Escolher saída de áudio')}</div>
    <div className="vb-row vb-tools">
      <button type="button" className={`vb-btn ${p.camera ? 'active' : ''}`} aria-label={p.camera ? 'Desligar câmera' : 'Ligar câmera'} aria-pressed={p.camera} title={p.camera ? 'Desligar câmera' : 'Ligar câmera'} disabled={p.busy} onClick={p.onCamera}>{p.camera ? <Camera size={18} /> : <CameraOff size={18} />}</button>
      <button type="button" className={`vb-btn ${p.screen ? 'active' : ''}`} aria-label={p.screen ? 'Parar compartilhamento de tela' : 'Compartilhar tela'} aria-pressed={p.screen} title={p.screen ? 'Parar tela' : 'Compartilhar tela'} disabled={p.busy} onClick={p.onScreen}>{p.screen ? <MonitorOff size={18} /> : <MonitorUp size={18} />}</button>
      <button type="button" className={`vb-btn ${p.music ? 'active' : ''}`} aria-label="Música da call" aria-expanded={p.music} title="DJ do lobby" onClick={p.onMusic}><Music2 size={18} /></button>
      <button type="button" className={`vb-btn ${p.settings ? 'active' : ''}`} aria-label="Ajustes da call" aria-expanded={p.settings} title="Ajustes da call" onClick={p.onSettings}><Settings2 size={18} /></button>
    </div>
    {menu && <DeviceMenu key={menu} kind={menu === 'mic' ? 'audioinput' : 'audiooutput'} report={p.report} close={() => setMenu(null)} />}
  </div>;
}
