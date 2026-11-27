import { serverMenuItems } from '@nacall/core/server-menu';

const OWNER = '11111111-1111-4111-8111-111111111111';
const ME = '22222222-2222-4222-8222-222222222222';

describe('menu do grupo na gaveta do app', () => {
  test('sem as telas de configuração: copiar ID e, para quem não é dono, sair do grupo', () => {
    expect(serverMenuItems({ owner_id: OWNER, is_official: false }, ME, () => true, { manage: false }).map((i) => i.id)).toEqual(['copy-id', 'leave']);
    expect(serverMenuItems({ owner_id: ME, is_official: false }, ME, () => true, { manage: false }).map((i) => i.id)).toEqual(['copy-id']);
    expect(serverMenuItems({ owner_id: null, is_official: true }, ME, () => false, { manage: false }).map((i) => i.id)).toEqual(['copy-id']);
  });
});
