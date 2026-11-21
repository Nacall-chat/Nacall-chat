/** Mensagens técnicas do navegador/Supabase viram texto em português que a pessoa entende. */
export function friendlyError(message: string): string {
  if (/failed to fetch|network request failed|networkerror|load failed|timeout|timed out/i.test(message)) {
    return 'Sem conexão com o servidor. Confira a internet e tente de novo.';
  }
  if (/jwt|invalid token|not authenticated/i.test(message)) return 'Sua sessão expirou. Saia e entre de novo.';
  return message;
}
