'use client';
import {useCallback,useEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {ImagePlus,RotateCw,X} from 'lucide-react';
import {STICKER_MAX_BYTES,STICKER_SOURCE_MAX_BYTES,sniffImage} from '@/lib/chat-media';
import {defaultEdit,drawSticker,placement,sampleBackground,STICKER_SIZE,stickerBlob,type StickerEdit,type StickerShape} from '@/lib/sticker-render';
import {errorText} from '@/lib/validation';

const shapes:{id:StickerShape;label:string}[]=[{id:'square',label:'Quadrado'},{id:'rounded',label:'Arredondado'},{id:'circle',label:'Círculo'}];

/**
 * Criar figurinha: escolher a imagem, enquadrar (arrastar e zoom), formato, ajuste, remoção de fundo liso,
 * ver o resultado e salvar. O arquivo final é um WEBP 512×512 com fundo transparente.
 */
export function StickerEditor({onClose,onSave}:{onClose:()=>void;onSave:(blob:Blob)=>Promise<void>}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const mini=useRef<HTMLCanvasElement>(null);
 const dialog=useRef<HTMLDivElement>(null);
 const drag=useRef<{id:number;x:number;y:number;ex:number;ey:number}|null>(null);
 const[bitmap,setBitmap]=useState<ImageBitmap|null>(null);
 const[background,setBackground]=useState<[number,number,number]>([255,255,255]);
 const[edit,setEdit]=useState<StickerEdit>(defaultEdit);
 const[error,setError]=useState('');
 const[saving,setSaving]=useState(false);

 useEffect(()=>()=>{bitmap?.close();},[bitmap]);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null;
  dialog.current?.querySelector<HTMLElement>('button,input')?.focus();
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!saving){e.stopPropagation();onClose();}};
  document.addEventListener('keydown',onKey,true);
  return()=>{document.removeEventListener('keydown',onKey,true);previous?.focus?.();};
 },[onClose,saving]);

 useEffect(()=>{
  const target=canvas.current;if(!target||!bitmap)return;
  try{drawSticker(target,bitmap,edit,background);}catch(e){setError(errorText(e));return;}
  const small=mini.current;const ctx=small?.getContext('2d');
  if(small&&ctx){small.width=96;small.height=96;ctx.clearRect(0,0,96,96);ctx.drawImage(target,0,0,96,96);}
 },[bitmap,edit,background]);

 async function choose(file?:File){
  if(!file)return;setError('');
  try{
   if(file.size>STICKER_SOURCE_MAX_BYTES)throw new Error('Escolha uma imagem de até 12 MB.');
   if(!sniffImage(new Uint8Array(await file.slice(0,16).arrayBuffer())))throw new Error('Use uma imagem WEBP, PNG, JPEG ou GIF.');
   let next=await createImageBitmap(file).catch(()=>{throw new Error('Não consegui abrir essa imagem. O arquivo pode estar corrompido.');});
   if(Math.max(next.width,next.height)>2048){ // imagens enormes viram 2048 px: o resultado final tem 512
    const factor=2048/Math.max(next.width,next.height);
    const smaller=await createImageBitmap(next,{resizeWidth:Math.round(next.width*factor),resizeHeight:Math.round(next.height*factor),resizeQuality:'high'});
    next.close();next=smaller;
   }
   setBackground(sampleBackground(next));setEdit(defaultEdit);setBitmap(next);
  }catch(e){setError(errorText(e));}
 }
 const patch=useCallback((change:Partial<StickerEdit>)=>setEdit(current=>({...current,...change})),[]);
 function onPointerDown(e:ReactPointerEvent<HTMLCanvasElement>){
  if(!bitmap)return;
  e.currentTarget.setPointerCapture(e.pointerId);
  drag.current={id:e.pointerId,x:e.clientX,y:e.clientY,ex:edit.x,ey:edit.y};
 }
 function onPointerMove(e:ReactPointerEvent<HTMLCanvasElement>){
  const d=drag.current;if(!d||d.id!==e.pointerId||!bitmap)return;
  const ratio=STICKER_SIZE/e.currentTarget.getBoundingClientRect().width;
  const next=placement(bitmap.width,bitmap.height,{...edit,x:d.ex+(e.clientX-d.x)*ratio,y:d.ey+(e.clientY-d.y)*ratio});
  patch({x:next.x,y:next.y});
 }
 const endDrag=(e:ReactPointerEvent<HTMLCanvasElement>)=>{if(drag.current?.id===e.pointerId)drag.current=null;};
 function onWheel(e:React.WheelEvent){if(!bitmap)return;patch({zoom:Math.min(4,Math.max(1,edit.zoom*(e.deltaY<0?1.08:1/1.08)))});}
 async function save(){
  const target=canvas.current;if(!target||!bitmap||saving)return;
  setSaving(true);setError('');
  try{await onSave(await stickerBlob(target,STICKER_MAX_BYTES));onClose();}
  catch(e){setError(errorText(e));setSaving(false);}
 }
 const clamp=useCallback((e:StickerEdit)=>bitmap?{...e,x:placement(bitmap.width,bitmap.height,e).x,y:placement(bitmap.width,bitmap.height,e).y}:e,[bitmap]);

 return createPortal(<div className="sticker-editor-overlay" role="presentation" onPointerDown={e=>{if(e.target===e.currentTarget&&!saving)onClose();}}>
  <div className="sticker-editor" role="dialog" aria-modal="true" aria-labelledby="sticker-editor-title" ref={dialog}>
   <header className="row between"><h2 id="sticker-editor-title">Criar figurinha</h2><button type="button" className="icon-button" aria-label="Fechar criador de figurinha" disabled={saving} onClick={onClose}><X size={18}/></button></header>
   {!bitmap?<label className="sticker-drop"><ImagePlus size={30}/><strong>Escolher imagem</strong><span>WEBP, PNG, JPEG ou GIF, até 12 MB. GIF animado vira uma imagem parada aqui; para manter o movimento, use “Importar”.</span>
     <input type="file" accept="image/webp,image/png,image/jpeg,image/gif" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/></label>
   :<>
    <div className="sticker-stage">
     <canvas ref={canvas} className="sticker-canvas" aria-label="Pré-visualização da figurinha. Arraste para enquadrar." role="img" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onWheel={onWheel}/>
     <div className="sticker-preview"><span className="small muted">No chat</span><canvas ref={mini} aria-hidden="true"/></div>
    </div>
    <p className="muted small">Arraste a imagem para enquadrar e use o zoom para aproximar.</p>
    <label className="sticker-field">Zoom<input type="range" min={1} max={4} step={0.01} value={edit.zoom} onChange={e=>setEdit(current=>clamp({...current,zoom:Number(e.target.value)}))}/></label>
    <div className="sticker-field"><span>Ajuste</span><div className="segmented" role="group" aria-label="Ajuste da imagem">
     {(['cover','contain'] as const).map(fit=><button type="button" key={fit} aria-pressed={edit.fit===fit} className={edit.fit===fit?'selected':''} onClick={()=>setEdit(current=>clamp({...current,fit}))}>{fit==='cover'?'Preencher':'Inteira'}</button>)}
     <button type="button" aria-label="Girar 90 graus" onClick={()=>setEdit(current=>clamp({...current,turns:(current.turns+1)%4}))}><RotateCw size={15}/> Girar</button></div></div>
    <div className="sticker-field"><span>Formato</span><div className="segmented" role="group" aria-label="Formato da figurinha">
     {shapes.map(s=><button type="button" key={s.id} aria-pressed={edit.shape===s.id} className={edit.shape===s.id?'selected':''} onClick={()=>patch({shape:s.id})}>{s.label}</button>)}</div></div>
    <div className="sticker-field"><label className="check"><input type="checkbox" checked={edit.removeBg} onChange={e=>patch({removeBg:e.target.checked})}/> Remover fundo liso</label>
     {edit.removeBg&&<><label className="sticker-field">Tolerância<input type="range" min={8} max={120} step={1} value={edit.tolerance} onChange={e=>patch({tolerance:Number(e.target.value)})}/></label><p className="muted small">Funciona melhor com fundo de uma cor só (cor lida dos cantos da imagem). Aumente a tolerância se sobrar fundo; diminua se apagar o desenho.</p></>}</div>
    <div className="row wrap"><label className="upload-button sticker-change"><ImagePlus size={16}/>Trocar imagem<input type="file" accept="image/webp,image/png,image/jpeg,image/gif" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/></label></div>
   </>}
   {error&&<p className="form-feedback" role="alert">{error}</p>}
   <footer className="row between"><button type="button" disabled={saving} onClick={onClose}>Cancelar</button><button type="button" className="primary" disabled={!bitmap||saving} onClick={()=>void save()}>{saving?'Salvando…':'Salvar na coleção'}</button></footer>
  </div>
 </div>,document.body);
}
