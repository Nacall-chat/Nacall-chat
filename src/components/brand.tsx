export function Brand({compact=false}:{compact?:boolean}) {
 return <span className={`nacall-brand jacall-brand gamer-brand ${compact?'compact':''}`}>
  <img className="brand-avatar" src="/brand/jacall-avatar.webp" width={44} height={44} alt={compact?'NACALL — mascote Jacall':''} />
  {!compact&&<span className="brand-name" aria-label="NACALL"><span className="brand-na">NA</span><span className="brand-call">CALL</span><span className="brand-period">.</span></span>}
 </span>;
}
