import { avisoDate, liveAvisos, toAvisos, unreadAvisos } from '@nacall/core/avisos';

const row = (slug: string, published: string, expires: string) => ({ slug, title: `Título ${slug}`, body: 'Texto simples da novidade.', published_at: published, expires_at: expires });

describe('novidades do sino (tabela product_updates)', () => {
  test('mais novas primeiro e expiradas fora', () => {
    const now = Date.parse('2026-11-27T12:00:00Z');
    const list = toAvisos([row('pr-1', '2026-11-25T10:00:00Z', '2026-11-28T10:00:00Z'), row('pr-2', '2026-11-26T10:00:00Z', '2026-11-29T10:00:00Z'), row('pr-0', '2026-11-20T10:00:00Z', '2026-11-23T10:00:00Z')], now);
    expect(list.map((a) => a.id)).toEqual(['pr-2', 'pr-1']);
    expect(liveAvisos(list, Date.parse('2026-11-28T12:00:00Z')).map((a) => a.id)).toEqual(['pr-2']);
    expect(unreadAvisos(['pr-2'], list).map((a) => a.id)).toEqual(['pr-1']);
  });

  test('data em pt-BR', () => {
    expect(avisoDate('2026-11-19')).toBe('19/11/2026');
    expect(avisoDate('lixo')).toBe('');
  });
});
