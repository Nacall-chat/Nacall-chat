import { copy, isNewPasswordMode, mismatchHint, noSpaces, onlyDigits, passwordHint, submitLabel, validated } from '../src/features/auth/flow';

describe('fluxo de entrada', () => {
  test('cada modo tem texto e rótulo de botão', () => {
    for (const mode of ['login', 'signup', 'verify', 'recover', 'recover-confirm'] as const) {
      expect(copy[mode].title.length).toBeGreaterThan(0);
      expect(submitLabel(mode, false).length).toBeGreaterThan(0);
      expect(submitLabel(mode, true)).toBe('Conectando o lobby…');
    }
  });

  test('só cadastro e recuperação criam senha nova', () => {
    expect(isNewPasswordMode('signup')).toBe(true);
    expect(isNewPasswordMode('recover-confirm')).toBe(true);
    expect(isNewPasswordMode('login')).toBe(false);
  });

  test('dica de senha usa a mesma regra do servidor e só aparece quando há senha nova', () => {
    expect(passwordHint('signup', 'curta')).toMatch(/12 caracteres/);
    expect(passwordHint('signup', '')).toBeUndefined();
    expect(passwordHint('login', 'curta')).toBeUndefined();
    expect(passwordHint('signup', 'uma senha boa 2026!')).toBeUndefined();
    expect(passwordHint('signup', 'senha1234567')).toMatch(/Misture|comum/);
  });

  test('confirmação diferente da senha avisa', () => {
    expect(mismatchHint('signup', 'abc', 'abd')).toBe('As senhas não conferem.');
    expect(mismatchHint('signup', 'abc', 'abc')).toBeUndefined();
    expect(mismatchHint('signup', 'abc', '')).toBeUndefined();
    expect(mismatchHint('login', 'abc', 'xyz')).toBeUndefined();
  });

  test('validated aceita o que o servidor aceita e recusa o que ele recusa', () => {
    const login = { action: 'login', identifier: 'cupincha', password: 'qualquer' };
    expect(validated(login)).toBe(login);
    expect(() => validated({ action: 'login', identifier: 'ab', password: 'x' })).toThrow('Informe seu usuário ou email.');
    expect(() => validated({ action: 'verify', email: 'a@b.co', code: '12345' })).toThrow('O código tem 6 dígitos.');
    expect(() => validated({ action: 'signup', username: 'ok_nick', displayName: 'Nome', email: 'a@b.co', password: 'uma senha boa 2026!', confirmPassword: 'outra' })).toThrow('As senhas não conferem.');
    expect(() => validated({ action: 'signup', username: 'a b', displayName: 'Nome', email: 'a@b.co', password: 'uma senha boa 2026!', confirmPassword: 'uma senha boa 2026!' })).toThrow();
  });

  test('máscaras de campo', () => {
    expect(onlyDigits('12 34-5678')).toBe('123456');
    expect(noSpaces(' a b c ')).toBe('abc');
  });
});
