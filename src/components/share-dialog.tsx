'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {AppWindow,Monitor,MonitorUp,PanelTop,X} from 'lucide-react';
import {SHARE_SURFACES,type ShareSurface} from '@/lib/screen-share';
import {usePreferences} from './preferences';

type Option<T extends number>={value:T;label:string;hint:string};

function Choice<T extends number>({legend,value,options,onChange}:{legend:string;value:T;options:Option<T>[];onChange:(value:T)=>void}){
 return <fieldset className="share-field"><legend>{legend}</legend><div className="share-choices" role="radiogroup" aria-label={legend}>{options.map(o=><button type="button" role="radio" aria-checked={o.value===value} className={`share-choice ${o.value===value?'selected':''}`} key={o.value} onClick={()=>onChange(o.value)}><strong>{o.label}</strong><small>{o.hint}</small></button>)}</div></fieldset>;
}

/** Janela do NACALL que vem antes do seletor do navegador: a pessoa ajusta qualidade, fluidez e som e só então escolhe
 * o que mostrar. O seletor em si (abas, janelas, telas) é do navegador e nenhum site consegue trocá-lo. */
const surfaceIcon={monitor:Monitor,window:AppWindow,browser:PanelTop} as const;
export function ShareDialog({onClose,onStart}:{onClose:()=>void;onStart:(surface:ShareSurface)=>void}){
 const{voice,setVoice}=usePreferences();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();return()=>{if(node?.open)node.close();};},[]);
 return createPortal(<dialog ref={dialog} className="mic-modal share-modal" aria-labelledby="share-modal-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="mic-modal-body">
   <header className="row between"><h2 id="share-modal-title"><MonitorUp size={20} aria-hidden="true"/> Compartilhar tela</h2><button type="button" className="icon-button" aria-label="Cancelar" onClick={onClose}><X size={18}/></button></header>
   <p className="muted">Ajuste como a transmissão vai sair e escolha o que mostrar. Quem está na call vê uma prévia pequena da sua tela (um quadro a cada poucos segundos) e só assiste de verdade se clicar em <strong>Assistir</strong>.</p>
   <Choice legend="Qualidade" value={voice.screenHeight} onChange={screenHeight=>setVoice({screenHeight})} options={[{value:720,label:'720p',hint:'Leve, roda em qualquer internet'},{value:1080,label:'1080p',hint:'Mais detalhes, usa mais internet'}]}/>
   <Choice legend="Fluidez" value={voice.screenFps} onChange={screenFps=>setVoice({screenFps})} options={[{value:30,label:'30 fps',hint:'Ideal para jogo e vídeo'},{value:15,label:'15 fps',hint:'Mais leve, bom para apresentar'}]}/>
   <label className="share-toggle"><div><strong>Compartilhar o som</strong><small>Ao escolher uma aba, marque “Compartilhar áudio da guia” no seletor. Na tela inteira, depende do sistema e do navegador.</small></div><input type="checkbox" checked={voice.shareAudio} onChange={e=>setVoice({shareAudio:e.target.checked})}/></label>
   <fieldset className="share-field"><legend>O que mostrar</legend><div className="share-surfaces">{SHARE_SURFACES.map(o=>{const Icon=surfaceIcon[o.id];return <button type="button" className="share-surface" key={o.id} onClick={()=>onStart(o.id)}><Icon size={26} aria-hidden="true"/><strong>{o.label}</strong><small>{o.hint}</small></button>;})}</div><p className="share-note">O navegador vai abrir a lista já nessa opção. É por segurança que ele mesmo mostra as telas e pede a sua confirmação: nenhum site consegue pular esse passo.</p></fieldset>
   <footer className="row"><button type="button" onClick={onClose}>Cancelar</button></footer>
  </div>
 </dialog>,document.body);
}
