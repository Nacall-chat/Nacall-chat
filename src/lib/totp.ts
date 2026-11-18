/** Nome que aparece no app autenticador. O Supabase usa o endereço do site (localhost, nacall.site…) e o email; aqui vira "NACALL" + o nick. */
export const TOTP_ISSUER = 'NACALL';

/** Reescreve o otpauth:// devolvido pelo Supabase: emissor fixo "NACALL" e conta = nick da pessoa. O segredo e os demais parâmetros ficam como vieram. */
export function brandTotpUri(uri: string, account: string): string {
  const url = new URL(uri);
  if (url.protocol !== 'otpauth:') throw new Error('Link do autenticador inválido.');
  const params = new URLSearchParams(url.search);
  params.set('issuer', TOTP_ISSUER);
  const name = account.trim().replace(/[\u0000-\u001f]/g, '').slice(0, 60) || 'conta';
  return `otpauth://totp/${encodeURIComponent(TOTP_ISSUER)}:${encodeURIComponent(name)}?${params.toString()}`;
}
