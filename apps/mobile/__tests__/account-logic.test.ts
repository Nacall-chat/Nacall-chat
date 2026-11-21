import { brandTotpUri } from '@nacall/core/totp';
import { avatarFilePath, coverCrop, coverFilePath, inviteCode, isGifBytes, passwordFormHints, profileChanged, profileFormIssue, qrMatrix, recoveryText, squareCrop } from '../src/features/account/logic';

describe('perfil', () => {
  const ok = { displayName: 'Cupincha', username: 'cupincha_br', bio: 'Main suporte.' };

  test('formulário válido não tem problema', () => {
    expect(profileFormIssue(ok)).toBeNull();
    expect(profileFormIssue({ ...ok, username: 'Nick#1!' })).toBeNull();
  });

  test('nome curto, usuário inválido e bio longa são recusados com a mensagem do site', () => {
    expect(profileFormIssue({ ...ok, displayName: 'a' })).toBe('Use pelo menos 2 caracteres.');
    expect(profileFormIssue({ ...ok, username: 'ab' })).toMatch(/3 a 24 caracteres/);
    expect(profileFormIssue({ ...ok, username: 'com espaço' })).toMatch(/3 a 24 caracteres/);
    expect(profileFormIssue({ ...ok, username: 'um@email' })).toMatch(/3 a 24 caracteres/);
    expect(profileFormIssue({ ...ok, bio: 'x'.repeat(301) })).toMatch(/no máximo 300/);
    expect(profileFormIssue({ ...ok, bio: 'x'.repeat(300) })).toBeNull();
  });

  test('só conta como mudança o que realmente mudou (espaços nas pontas não contam)', () => {
    expect(profileChanged(ok, { ...ok })).toBe(false);
    expect(profileChanged(ok, { ...ok, displayName: '  Cupincha ' })).toBe(false);
    expect(profileChanged(ok, { ...ok, bio: 'Outra bio' })).toBe(true);
    expect(profileChanged(ok, { ...ok, username: 'novo_nick' })).toBe(true);
  });
});

describe('imagens', () => {
  test('caminhos no storage seguem o padrão que o banco aceita', () => {
    const user = '11111111-1111-4111-8111-111111111111';
    const id = '22222222-2222-4222-8222-222222222222';
    expect(avatarFilePath(user, id)).toBe(`${user}/${id}.webp`);
    expect(coverFilePath(user, id, 'gif')).toBe(`${user}/${id}.gif`);
    expect(avatarFilePath(user, id)).toMatch(/^[0-9a-f-]{36}\/[a-zA-Z0-9_-]+\.webp$/);
  });

  test('recorte da capa: 3:1 centralizado, nunca maior que a imagem', () => {
    expect(coverCrop(1200, 400)).toEqual({ originX: 0, originY: 0, width: 1200, height: 400 });
    expect(coverCrop(1000, 1000)).toEqual({ originX: 0, originY: 333, width: 1000, height: 333 });
    const wide = coverCrop(4000, 1000);
    expect(wide.width).toBe(3000);
    expect(wide.height).toBe(1000);
    expect(wide.originX).toBe(500);
    const crop = coverCrop(900, 900);
    expect(crop.originX + crop.width).toBeLessThanOrEqual(900);
    expect(crop.originY + crop.height).toBeLessThanOrEqual(900);
  });

  test('recorte da foto: quadrado centralizado', () => {
    expect(squareCrop(1000, 600)).toEqual({ originX: 200, originY: 0, width: 600, height: 600 });
    expect(squareCrop(600, 1000)).toEqual({ originX: 0, originY: 200, width: 600, height: 600 });
  });

  test('só aceita GIF de verdade', () => {
    expect(isGifBytes(new TextEncoder().encode('GIF89a....'))).toBe(true);
    expect(isGifBytes(new TextEncoder().encode('GIF87a....'))).toBe(true);
    expect(isGifBytes(new TextEncoder().encode('<html>...'))).toBe(false);
    expect(isGifBytes(new Uint8Array([]))).toBe(false);
  });
});

describe('convite', () => {
  const code = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

  test('aceita o código puro e o link com ?invite=', () => {
    expect(inviteCode(code)).toBe(code);
    expect(inviteCode(`  ${code}  `)).toBe(code);
    expect(inviteCode(`https://www.nacall.site/?invite=${code}`)).toBe(code);
    expect(inviteCode(code.toUpperCase())).toBe(code.toUpperCase());
  });

  test('recusa lixo, link sem convite e código malformado', () => {
    expect(inviteCode('')).toBeNull();
    expect(inviteCode('oi')).toBeNull();
    expect(inviteCode('https://www.nacall.site/')).toBeNull();
    expect(inviteCode(`https://x.com/?invite=${code}0`)).toBeNull();
    expect(inviteCode('https://')).toBeNull();
  });
});

describe('2FA', () => {
  test('o QR é uma matriz quadrada com os três marcadores de canto', () => {
    const uri = brandTotpUri('otpauth://totp/x:y?secret=JBSWY3DPEHPK3PXP&issuer=x', 'cupincha');
    const m = qrMatrix(uri);
    expect(m.length).toBeGreaterThan(20);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    const n = m.length;
    // marcadores de posição: o canto de cada um é escuro
    expect(m[0][0] && m[0][n - 1] && m[n - 1][0]).toBe(true);
    expect(m.flat().some((v) => !v)).toBe(true);
  });

  test('o link do autenticador sai como NACALL + nick', () => {
    const uri = brandTotpUri('otpauth://totp/localhost:me@x.com?secret=JBSWY3DPEHPK3PXP&issuer=localhost', 'cupincha');
    expect(uri).toContain('otpauth://totp/NACALL:cupincha?');
    expect(uri).toContain('issuer=NACALL');
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(() => brandTotpUri('https://x', 'a')).toThrow();
  });

  test('texto dos códigos de recuperação', () => {
    const text = recoveryText(['AAAA-1111', 'BBBB-2222']);
    expect(text).toContain('AAAA-1111\nBBBB-2222');
    expect(text.startsWith('NACALL — códigos de recuperação do 2FA')).toBe(true);
  });
});

describe('troca de senha', () => {
  test('dicas ao vivo e botão pronto só com tudo certo', () => {
    expect(passwordFormHints({ current: '', next: '', confirm: '' }).ready).toBe(false);
    expect(passwordFormHints({ current: 'antiga', next: 'curta', confirm: 'curta' }).next).toMatch(/12 caracteres/);
    expect(passwordFormHints({ current: 'antiga', next: 'uma senha boa 2026!', confirm: 'outra coisa' }).confirm).toBe('As senhas não conferem.');
    const good = passwordFormHints({ current: 'antiga', next: 'uma senha boa 2026!', confirm: 'uma senha boa 2026!' });
    expect(good.ready).toBe(true);
    expect(good.next).toBeUndefined();
    expect(passwordFormHints({ current: '', next: 'uma senha boa 2026!', confirm: 'uma senha boa 2026!' }).ready).toBe(false);
  });
});
