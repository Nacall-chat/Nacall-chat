import { accessStatus } from '../src/lib/access';

describe('estado de acesso', () => {
  test('carregando até ler a sessão salva', () => {
    expect(accessStatus(false, 'checking', false)).toBe('loading');
    expect(accessStatus(true, 'ok', false)).toBe('loading');
  });

  test('sem sessão: telas de entrada', () => {
    expect(accessStatus(false, 'checking', true)).toBe('signedOut');
    expect(accessStatus(false, 'ok', true)).toBe('signedOut');
  });

  test('com sessão, espera conferir o 2FA antes de decidir', () => {
    expect(accessStatus(true, 'checking', true)).toBe('loading');
  });

  test('conta com 2FA ativo e sem o código fica na tela do código; sem 2FA entra', () => {
    expect(accessStatus(true, 'challenge', true)).toBe('mfa');
    expect(accessStatus(true, 'ok', true)).toBe('ready');
  });
});
