'use client';
import {createContext,useCallback,useContext,useEffect,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {Headphones,LockKeyhole,Mic,Volume2,X} from 'lucide-react';
import {listAudioDevices,micPermission,micStage,microphoneError,outputSelectionSupported,pickDevice,readMicPrefs,saveMicPrefs,toneWav,type AudioDevice,type MicPrefs,type MicStage} from '@/lib/mic';

type Gate={
 /** Garante o microfone antes de uma call ou de um áudio: devolve a escolha salva (sem perguntar nada se já estiver liberado) ou `null` se a pessoa cancelar. */
 ensureMic:()=>Promise<MicPrefs|null>;
 /** Abre a janela para trocar de microfone ou de saída de áudio quando quiser. */
 configure:()=>Promise<MicPrefs|null>;
};
const Context=createContext<Gate>({ensureMic:async()=>readMicPrefs(),configure:async()=>null});
export const useMicGate=()=>useContext(Context);

export function MicGateProvider({children}:{children:ReactNode}){
 const[open,setOpen]=useState(false);
 const waiting=useRef<{promise:Promise<MicPrefs|null>;resolve:(prefs:MicPrefs|null)=>void}|null>(null);
 const show=useCallback((): Promise<MicPrefs|null>=>{
  if(waiting.current)return waiting.current.promise;
  let resolve:(prefs:MicPrefs|null)=>void=()=>{};
  const promise=new Promise<MicPrefs|null>(done=>{resolve=done;});
  waiting.current={promise,resolve};setOpen(true);
  return promise;
 },[]);
 const finish=useCallback((prefs:MicPrefs|null)=>{waiting.current?.resolve(prefs);waiting.current=null;setOpen(false);},[]);
 const ensureMic=useCallback(async()=>{
  if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia)return readMicPrefs(); // o erro aparece onde o microfone for usado
  const prefs=readMicPrefs();
  if(micStage(await micPermission(),prefs)==='skip')return prefs;
  return show();
 },[show]);
 return <Context.Provider value={{ensureMic,configure:show}}>{children}{open&&<MicModal onDone={finish}/>}</Context.Provider>;
}

/** Botão para as configurações de áudio: reabre a janela de escolha do microfone. */
export function MicSettingsButton(){
 const{configure}=useMicGate();
 return <button type="button" onClick={()=>void configure()}><Mic size={16}/>Escolher microfone e saída de áudio</button>;
}

function MicModal({onDone}:{onDone:(prefs:MicPrefs|null)=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 const[stage,setStage]=useState<MicStage|'loading'>('loading');
 const[inputs,setInputs]=useState<AudioDevice[]>([]);
 const[outputs,setOutputs]=useState<AudioDevice[]>([]);
 const[inputId,setInputId]=useState('');
 const[outputId,setOutputId]=useState('');
 const[level,setLevel]=useState(0);
 const[busy,setBusy]=useState(false);
 const[error,setError]=useState('');
 const canChooseOutput=outputSelectionSupported();

 const refresh=useCallback(async()=>{
  const saved=readMicPrefs();const found=await listAudioDevices();
  setInputs(found.inputs);setOutputs(found.outputs);
  setInputId(pickDevice(found.inputs,saved.inputId));setOutputId(pickDevice(found.outputs,saved.outputId));
 },[]);

 useEffect(()=>{const node=dialog.current;if(node&&!node.open)node.showModal();return()=>{if(node?.open)node.close();};},[]);
 useEffect(()=>{
  let live=true;
  void (async()=>{
   const next=micStage(await micPermission(),readMicPrefs());
   const shown:MicStage=next==='skip'?'choose':next; // aberta pelos ajustes: só escolher
   if(shown==='choose'){try{await refresh();}catch{setError('Não consegui listar os seus microfones.');}}
   if(live)setStage(shown);
  })();
  return()=>{live=false;};
 },[refresh]);

 // Barra de nível do microfone escolhido: mostra que ele está captando.
 useEffect(()=>{
  if(stage!=='choose')return;
  let dead=false,stream:MediaStream|null=null,context:AudioContext|null=null,frame=0;
  void (async()=>{
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:inputId?{deviceId:{exact:inputId}}:true});
    if(dead){stream.getTracks().forEach(track=>track.stop());return;}
    const Context=window.AudioContext||(window as unknown as {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!Context)return;
    context=new Context();const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(stream).connect(analyser);
    const data=new Uint8Array(analyser.fftSize);let last=0;
    const tick=(time:number)=>{
     if(dead)return;
     if(time-last>60){analyser.getByteTimeDomainData(data);let sum=0;for(const value of data){const d=(value-128)/128;sum+=d*d;}last=time;setLevel(Math.min(1,Math.sqrt(sum/data.length)*3.6));}
     frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
   }catch{if(!dead)setLevel(0);}
  })();
  return()=>{dead=true;cancelAnimationFrame(frame);stream?.getTracks().forEach(track=>track.stop());void context?.close().catch(()=>{});setLevel(0);};
 },[stage,inputId]);

 /** Chama o aviso do navegador. Só depois de liberado os nomes dos microfones aparecem. */
 async function allow(){
  setBusy(true);setError('');
  try{
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   stream.getTracks().forEach(track=>track.stop());
   await refresh();setStage('choose');
  }catch(e){
   const state=await micPermission();
   if(state==='denied')setStage('blocked');
   else setError(e&&typeof e==='object'&&'name' in e&&e.name==='NotAllowedError'?'O aviso do navegador foi fechado sem uma resposta. Toque em Permitir de novo e escolha “Permitir ao visitar o site”.':microphoneError(e).message);
  }finally{setBusy(false);}
 }
 async function retry(){
  setBusy(true);setError('');
  try{if(await micPermission()==='granted'){await refresh();setStage('choose');}else setError('O navegador ainda está bloqueando. Libere o microfone no cadeado, ao lado do endereço, e tente de novo.');}
  catch{setError('Não consegui conferir a permissão. Atualize a página e tente de novo.');}
  finally{setBusy(false);}
 }
 async function playTest(){
  try{
   const audio=new Audio(URL.createObjectURL(new Blob([toneWav() as BlobPart],{type:'audio/wav'})));
   const sink=audio as HTMLAudioElement&{setSinkId?:(id:string)=>Promise<void>};
   if(canChooseOutput&&outputId&&sink.setSinkId)await sink.setSinkId(outputId);
   audio.onended=()=>URL.revokeObjectURL(audio.src);
   await audio.play();
  }catch{setError('Não consegui tocar o som de teste nessa saída.');}
 }
 const confirm=()=>onDone(saveMicPrefs({inputId,outputId:canChooseOutput?outputId:'',setupDone:true}));
 const title=stage==='choose'?'Escolha seu microfone':stage==='blocked'?'Microfone bloqueado':'Libere seu microfone';

 return createPortal(<dialog ref={dialog} className="mic-modal" aria-labelledby="mic-modal-title" onCancel={e=>{e.preventDefault();onDone(null);}} onClick={e=>{if(e.target===e.currentTarget)onDone(null);}}>
  <div className="mic-modal-body">
   <header className="row between"><h2 id="mic-modal-title">{title}</h2><button type="button" className="icon-button" aria-label="Cancelar" onClick={()=>onDone(null)}><X size={18}/></button></header>
   {stage==='loading'&&<p className="muted" role="status">Conferindo seu microfone…</p>}
   {stage==='ask'&&<>
    <p className="muted">Pra falar na call e mandar áudio, o NACALL precisa usar o seu microfone. Toque em <strong>Permitir</strong> e, no aviso do navegador, escolha <strong>Permitir ao visitar o site</strong> para a gente não perguntar de novo.</p>
    <p className="muted small">Depois de liberar, você escolhe qual microfone e qual saída de áudio usar. A escolha fica salva e vale para as calls e para os áudios.</p>
   </>}
   {stage==='blocked'&&<>
    <p className="muted"><LockKeyhole size={16} aria-hidden="true"/> O navegador está bloqueando o microfone para o NACALL.</p>
    <ol className="mic-steps"><li>Abra as configurações do site: toque no cadeado (ou no ícone de microfone) ao lado do endereço. No iPhone, use o botão <strong>aA</strong>, depois <strong>Ajustes do site</strong>.</li><li>Ative <strong>Microfone</strong> para este site.</li><li>Volte aqui e toque em <strong>Tentar de novo</strong>.</li></ol>
   </>}
   {stage==='choose'&&<>
    <p className="muted small">Fale alguma coisa: a barra mexe quando o microfone está captando. Essa escolha fica salva e vale para as calls e para os áudios.</p>
    <fieldset className="mic-field"><legend><Mic size={15} aria-hidden="true"/> Microfone</legend>
     {inputs.length===0?<p className="muted small">Nenhum microfone foi encontrado neste dispositivo.</p>
      :<div className="mic-list" role="radiogroup" aria-label="Microfone">{inputs.map(device=><label key={device.id} className={`mic-option ${inputId===device.id?'selected':''}`}><input type="radio" name="mic-input" checked={inputId===device.id} onChange={()=>setInputId(device.id)}/><span>{device.label}</span></label>)}</div>}
     <div className="mic-meter" role="meter" aria-label="Nível do microfone" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level*100)}><i style={{width:`${Math.round(level*100)}%`}}/></div>
    </fieldset>
    <fieldset className="mic-field"><legend><Headphones size={15} aria-hidden="true"/> Saída de áudio</legend>
     {!canChooseOutput?<p className="muted small">Este navegador usa a saída de áudio padrão do sistema.</p>
      :outputs.length===0?<p className="muted small">Só a saída padrão do sistema está disponível.</p>
      :<div className="row"><select aria-label="Saída de áudio" value={outputId} onChange={e=>setOutputId(e.target.value)}>{outputs.map(device=><option key={device.id} value={device.id}>{device.label}</option>)}</select><button type="button" onClick={()=>void playTest()}><Volume2 size={16}/>Testar</button></div>}
    </fieldset>
   </>}
   {error&&<p className="form-feedback" role="alert">{error}</p>}
   <footer className="row between">
    <button type="button" onClick={()=>onDone(null)}>Cancelar</button>
    {stage==='ask'&&<button type="button" className="primary" disabled={busy} onClick={()=>void allow()}>{busy?'Aguardando o navegador…':'Permitir microfone'}</button>}
    {stage==='blocked'&&<button type="button" className="primary" disabled={busy} onClick={()=>void retry()}>Tentar de novo</button>}
    {stage==='choose'&&<button type="button" className="primary" disabled={inputs.length===0} onClick={confirm}>Usar este microfone</button>}
   </footer>
  </div>
 </dialog>,document.body);
}
