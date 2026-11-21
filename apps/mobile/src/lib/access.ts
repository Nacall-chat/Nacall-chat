/**
 * Em que ponto do acesso a pessoa está:
 * - loading: lendo a sessão salva (ou conferindo o 2FA);
 * - signedOut: sem sessão (telas de entrada);
 * - mfa: sessão válida, mas a conta tem 2FA e falta o código (aal2);
 * - ready: pode usar o app.
 * Mesma regra do site (components/app.tsx).
 */
export type AccessStatus = 'loading' | 'signedOut' | 'mfa' | 'ready';
export type MfaGate = 'checking' | 'challenge' | 'ok';

export function accessStatus(hasSession: boolean, mfa: MfaGate, loaded: boolean): AccessStatus {
  if (!loaded) return 'loading';
  if (!hasSession) return 'signedOut';
  if (mfa === 'checking') return 'loading';
  return mfa === 'challenge' ? 'mfa' : 'ready';
}
