'use client';
import {useState} from 'react';
import {Eye,EyeOff} from 'lucide-react';
export type ApiError=Error&{data?:Record<string,unknown>;status?:number};
/** POST JSON para as rotas de autenticação; erros do servidor viram Error com a mensagem em português. */
export async function postJson<T=Record<string,unknown>>(path:string,body:unknown,token?:string):Promise<T>{
 const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const data=await response.json().catch(()=>({}));
 if(!response.ok)throw Object.assign(new Error(typeof data.error==='string'?data.error:'Não foi possível concluir. Tente novamente.'),{data,status:response.status}) as ApiError;
 return data as T;
}
export function PasswordField({label,value,onChange,autoComplete,placeholder,hint,invalid,minLength}:{label:string;value:string;onChange:(v:string)=>void;autoComplete:'current-password'|'new-password';placeholder?:string;hint?:string;invalid?:boolean;minLength?:number}){
 const[show,setShow]=useState(false);
 return <label>{label}<span className="password-field"><input type={show?'text':'password'} required minLength={minLength} maxLength={128} autoComplete={autoComplete} placeholder={placeholder} value={value} aria-invalid={invalid||undefined} onChange={e=>onChange(e.target.value)}/><button type="button" className="icon-button" aria-label={show?'Ocultar senha':'Mostrar senha'} aria-pressed={show} onClick={()=>setShow(!show)}>{show?<EyeOff size={17}/>:<Eye size={17}/>}</button></span>{hint&&<small className="field-hint" role="status">{hint}</small>}</label>;
}
