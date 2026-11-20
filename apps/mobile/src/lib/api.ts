/** Cliente das rotas /api do NACALL (as mesmas que o site usa). */
export type ApiError = Error & { data?: Record<string, unknown>; status?: number };

const base = () => (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
export const apiConfigured = () => base().length > 0;

const TIMEOUT_MS = 15000;

/** POST JSON; erros do servidor viram Error com a mensagem em português (mesmo contrato do site). */
export async function postJson<T = Record<string, unknown>>(path: string, body: unknown, token?: string): Promise<T> {
  if (!apiConfigured()) throw new Error('O app ainda não sabe onde fica o servidor (EXPO_PUBLIC_API_URL).');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${base()}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) {
      throw Object.assign(
        new Error(typeof data.error === 'string' ? data.error : 'Não foi possível concluir. Tente novamente.'),
        { data, status: response.status },
      ) as ApiError;
    }
    return data as T;
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw new Error('O servidor demorou para responder. Confira a internet e tente de novo.');
    if (error instanceof TypeError) throw new Error('Sem conexão com o servidor. Confira a internet e tente de novo.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
