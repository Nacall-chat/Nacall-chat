// O Asaas devolve quem passou pelo checkout para /?checkout=pending|canceled|expired (ver checkoutBody em asaas-server.ts).
// Sem ler esse parâmetro, a pessoa caía em Amigos sem saber o que aconteceu com o pagamento.
export type CheckoutReturn='pending'|'canceled'|'expired';

export function checkoutReturn(raw:string|null|undefined):CheckoutReturn|null{
 return raw==='pending'||raw==='canceled'||raw==='expired'?raw:null;
}

export function checkoutReturnMessage(state:CheckoutReturn){
 if(state==='pending')return 'Pagamento enviado. Assim que o Asaas confirmar, o benefício aparece aqui na Loja (costuma levar menos de um minuto).';
 if(state==='canceled')return 'Pagamento cancelado. Nada foi concluído; você pode tentar de novo quando quiser.';
 return 'O link de pagamento expirou (ele vale 30 minutos). Nada foi concluído; escolha o plano de novo para gerar outro.';
}

/** Tira só o parâmetro checkout da URL, mantendo o resto (por exemplo um convite). */
export function withoutCheckout(href:string){
 const url=new URL(href);url.searchParams.delete('checkout');
 return url.pathname+url.search+url.hash;
}
