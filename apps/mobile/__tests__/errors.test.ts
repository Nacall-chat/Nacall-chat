import { friendlyError } from '../src/lib/errors';

describe('mensagens de erro', () => {
  test('falhas de rede viram texto em português', () => {
    expect(friendlyError('TypeError: Failed to fetch')).toMatch(/Sem conexão/);
    expect(friendlyError('Network request failed')).toMatch(/Sem conexão/);
    expect(friendlyError('The request timed out')).toMatch(/Sem conexão/);
  });

  test('sessão vencida pede para entrar de novo', () => {
    expect(friendlyError('JWT expired')).toMatch(/sessão expirou/);
    expect(friendlyError('invalid token')).toMatch(/sessão expirou/);
  });

  test('o resto passa como está (já vem em português do servidor)', () => {
    expect(friendlyError('Usuário não encontrado.')).toBe('Usuário não encontrado.');
    expect(friendlyError('')).toBe('');
  });
});
