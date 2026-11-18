import { z } from 'zod';
/** Nick: 3–24 caracteres, com maiúsculas e estes símbolos: _ . - ! # $ * + = ~ ^ ? (sem espaços, sem @, para não confundir com email). O mesmo padrão vale no banco (profiles_username_check). */
export const usernamePattern = /^[A-Za-z0-9_.\-!#$*+=~^?]{3,24}$/;
export const usernameHint = '3 a 24 caracteres: letras, números ou _ . - ! # $ * + = ~ ^ ?, sem espaços.';
/** O nick aparece como foi digitado, mas é único e pesquisado sem diferenciar maiúsculas (coluna profiles.username_key). */
export const usernameKey = (username: string) => username.trim().toLowerCase();
export const usernameSchema = z.string().trim().regex(usernamePattern, `Use ${usernameHint}`);
export const emailSchema = z.string().trim().toLowerCase().max(254, 'Email muito longo.').pipe(z.email('Informe um email válido.'));
export const nameSchema = z.string().trim().min(2, 'Use pelo menos 2 caracteres.').max(60);
export const messageSchema = z.string().trim().min(1).max(4000, 'Limite de 4.000 caracteres.');
export const tokenSchema = z.object({ channelId: z.uuid() }).strict();
export function errorText(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0].message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível concluir. Tente novamente.';
}
