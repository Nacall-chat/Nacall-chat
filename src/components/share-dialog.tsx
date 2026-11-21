'use client';
import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {MonitorUp,X} from 'lucide-react';
import {usePreferences} from './preferences';

type Option<T extends number>={value:T;label:string;hint:string};

function Choice<T extends number>({legend,value,options,onChange}:{legend:string;value:T;options:Option<T>[];onChange:(value:T)=>void}){
 return <fieldset className="share-field"><legend>{legend}</legend><div className="share-choices" role="radiogroup" aria-label={legend}>{options.map(o=><button type="button" role="radio" aria-checked={o.value===value} className={`share-choice ${o.value===value?'selected':''}`} key={o.value} onClick={()=>onChange(o.value)}><strong>{o.label}</strong><small>{o.hint}</small></button>)}</div></fieldset>;
}

/** Janela do NACALL que vem antes do seletor do navegador: a pessoa ajusta qualidade, fluidez e som e só então escolhe
 * o que mostrar. O seletor em si (abas, janelas, telas) é do navegador e nenhum site consegue trocá-lo. */
export function ShareDialog({onClose,onStart}:{onClose:()=>void;onStart:()=>void}){
 const{voice,setVoice}=usePreferences();
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();return()=>{if(node?.open)node.close();};},[]);
 return createPortal(<dialog ref={dialog} className="mic-modal share-modal" aria-labelledby="share-modal-title" onCancel={e=>{e.preventDefault();onClose();}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <div className="mic-modal-body">
   <header className="row between"><h2 id="share-modal-title"><MonitorUp size={20} aria-hidden="true"/> Compartilhar tela</h2><button type="button" className="icon-button" aria-label="Cancelar" onClick={onClose}><X size={18}/></button></header>
   <p className="muted">Ajuste como a transmissão vai sair. No passo seguinte o navegador pergunta o que mostrar: uma aba, uma janela ou a tela inteira. Quem está na call só assiste se clicar em <strong>Assistir</strong>.</p>
   <Choice legend="Qualidade" value={voice.screenHeight} onChange={screenHeight=>setVoice({screenHeight})} options={[{value:720,label:'720p',hint:'Leve, roda em qualquer internet'},{value:1080,label:'1080p',hint:'Mais detalhes, usa mais internet'}]}/>
   <Choice legend="Fluidez" value={voice.screenFps} onChange={screenFps=>setVoice({screenFps})} options={[{value:30,label:'30 fps',hint:'Ideal para jogo e vídeo'},{value:15,label:'15 fps',hint:'Mais leve, bom para apresentar'}]}/>
   <label className="share-toggle"><div><strong>Compartilhar o som</strong><small>Ao escolher uma aba, marque “Compartilhar áudio da guia” no seletor. Na tela inteira, depende do sistema e do navegador.</small></div><input type="checkbox" checked={voice.shareAudio} onChange={e=>setVoice({shareAudio:e.target.checked})}/></label>
   <footer className="row between"><button type="button" onClick={onClose}>Cancelar</button><button type="button" className="primary" onClick={onStart}><MonitorUp size={16}/> Escolher o que mostrar</button></footer>
  </div>
 </dialog>,document.body);
}
