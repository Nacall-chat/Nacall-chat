/** Script do Cloudflare Turnstile (modo explícito: o widget só é desenhado quando uma ação pede o token). */
export const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const TURNSTILE_ORIGIN = 'https://challenges.cloudflare.com';
/** Chave pública do site no Turnstile. Vazia = CAPTCHA desligado no app (nenhum token é pedido nem enviado).
 * O Next só embute variáveis NEXT_PUBLIC_ escritas literalmente, por isso o acesso direto. */
export const turnstileSiteKey = (): string => (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '').trim();
