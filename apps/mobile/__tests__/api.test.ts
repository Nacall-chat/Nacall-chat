import { apiConfigured, postJson, type ApiError } from '../src/lib/api';

const original = global.fetch;
afterEach(() => {
  global.fetch = original;
  delete process.env.EXPO_PUBLIC_API_URL;
});

const respond = (status: number, body: unknown) => jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe('cliente da API', () => {
  test('sem EXPO_PUBLIC_API_URL avisa em português e não chama a rede', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    expect(apiConfigured()).toBe(false);
    await expect(postJson('/api/auth', {})).rejects.toThrow(/EXPO_PUBLIC_API_URL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('envia JSON para a URL base (sem barra dupla) e devolve o corpo', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://nacall-hml.example///';
    const fetchMock = respond(200, { ok: true });
    global.fetch = fetchMock as unknown as typeof fetch;
    await expect(postJson('/api/auth', { action: 'check' })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://nacall-hml.example/api/auth');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ action: 'check' });
    expect(init.headers.Authorization).toBeUndefined();
  });

  test('manda o token da sessão como Bearer', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://x.example';
    const fetchMock = respond(200, {});
    global.fetch = fetchMock as unknown as typeof fetch;
    await postJson('/api/auth/mfa', { action: 'status' }, 'tok123');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok123');
  });

  test('erro do servidor vira Error com a mensagem dele e os dados anexados', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://x.example';
    global.fetch = respond(409, { error: 'Esse email já tem uma conta.', code: 'email_exists' }) as unknown as typeof fetch;
    const failure = (await postJson('/api/auth', {}).catch((e) => e)) as ApiError;
    expect(failure.message).toBe('Esse email já tem uma conta.');
    expect(failure.status).toBe(409);
    expect(failure.data?.code).toBe('email_exists');
  });

  test('resposta de erro sem mensagem usa o texto padrão', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://x.example';
    global.fetch = respond(500, {}) as unknown as typeof fetch;
    await expect(postJson('/api/auth', {})).rejects.toThrow('Não foi possível concluir. Tente novamente.');
  });

  test('sem rede e tempo esgotado têm mensagens claras', async () => {
    process.env.EXPO_PUBLIC_API_URL = 'https://x.example';
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed')) as unknown as typeof fetch;
    await expect(postJson('/api/auth', {})).rejects.toThrow(/Sem conexão/);
    global.fetch = jest.fn().mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' })) as unknown as typeof fetch;
    await expect(postJson('/api/auth', {})).rejects.toThrow(/demorou para responder/);
  });
});
