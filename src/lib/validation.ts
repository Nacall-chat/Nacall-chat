import { z } from 'zod';
export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, 'Use 3–24 letras minúsculas, números ou _.');
export const nameSchema = z.string().trim().min(2, 'Use pelo menos 2 caracteres.').max(60);
export const messageSchema = z.string().trim().min(1).max(4000, 'Limite de 4.000 caracteres.');
export const tokenSchema = z.object({ channelId: z.uuid() }).strict();
export function errorText(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0].message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return 'Não foi possível concluir. Tente novamente.';
}
