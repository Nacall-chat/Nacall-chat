import {HeadphoneOff,MicOff} from 'lucide-react';

/** Selo vermelho de quem está transmitindo a tela (na call e na lista de salas). */
export function LiveBadge(){return <span className="live-badge" aria-label="Ao vivo"><i aria-hidden="true"/>AO VIVO</span>;}

/** Ícones de estado ao lado do nome: microfone fechado e áudio da call fechado (fone mudo). Só mostram, ninguém clica. */
export function PersonStateIcons({muted,deaf}:{muted:boolean;deaf:boolean}){
 if(!muted&&!deaf)return null;
 return <span className="person-state">{muted&&<span role="img" aria-label="Microfone fechado" title="Microfone fechado"><MicOff size={13}/></span>}{deaf&&<span role="img" aria-label="Sem ouvir a call" title="Sem ouvir a call"><HeadphoneOff size={13}/></span>}</span>;
}
