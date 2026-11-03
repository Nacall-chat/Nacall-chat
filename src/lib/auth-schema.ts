import { z } from 'zod';
import { usernameSchema, nameSchema, emailSchema } from './validation';
// Senhas que ninguém deveria usar mesmo passando no tamanho mínimo.
const common = new Set(['senha1234567','senha12345678','password1234','password12345','123456789012','1234567890123','qwertyuiop12','qwertyuiopas','abcdefghijkl','nacall123456','jacall123456']);
export const passwordMin = 12;
/** Primeira regra violada, ou null. Usada pelo frontend (dica ao vivo) e pelo backend (decisão). */
export function passwordIssue(password: string): string | null {
  if (password.length < passwordMin) return `Use pelo menos ${passwordMin} caracteres.`;
  if (password.length > 128) return 'Use no máximo 128 caracteres.';
  if (!/\p{L}/u.test(password) || !/[^\p{L}]/u.test(password)) return 'Misture letras com números ou símbolos.';
  if (/^(.)\1+$/u.test(password) || common.has(password.toLowerCase())) return 'Essa senha é comum demais. Escolha outra.';
  return null;
}
export const newPasswordSchema = z.string().superRefine((value, ctx) => { const message = passwordIssue(value); if (message) ctx.addIssue({ code: 'custom', message }); });
export const codeSchema = z.string().trim().regex(/^\d{6}$/, 'O código tem 6 dígitos.');
const same = (d: { password: string; confirmPassword: string }) => d.password === d.confirmPassword;
const mismatch = { message: 'As senhas não conferem.', path: ['confirmPassword'] };
export const authSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('login'), identifier: z.string().trim().toLowerCase().min(3, 'Informe seu usuário ou email.').max(254), password: z.string().min(1, 'Informe a senha.').max(128) }),
  z.object({ action: z.literal('signup'), username: usernameSchema, displayName: nameSchema, email: emailSchema, password: newPasswordSchema, confirmPassword: z.string() }).refine(same, mismatch),
  z.object({ action: z.literal('verify'), email: emailSchema, code: codeSchema }),
  z.object({ action: z.literal('resend'), email: emailSchema }),
  z.object({ action: z.literal('recover'), email: emailSchema }),
  z.object({ action: z.literal('recover-confirm'), email: emailSchema, code: codeSchema, password: newPasswordSchema, confirmPassword: z.string() }).refine(same, mismatch),
]);
export const passwordChangeSchema = z.object({ current: z.string().min(1, 'Informe a senha atual.').max(128), password: newPasswordSchema, confirmPassword: z.string() }).refine(same, mismatch);
export const mfaSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('status') }),
  z.object({ action: z.literal('generate-codes') }),
  z.object({ action: z.literal('use-code'), code: z.string().trim().min(8).max(40) }),
  z.object({ action: z.literal('disable'), password: z.string().min(1, 'Informe a senha.').max(128) }),
]);
/** Email (contém @) ou username. O username segue a política do projeto: minúsculas, números e _. */
export function isEmailIdentifier(identifier: string) { return identifier.includes('@'); }
