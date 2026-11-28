import { memberState, offlineInfo, toServerStates } from '@nacall/core/presence';

const ME = '11111111-1111-4111-8111-111111111111';
const A = '22222222-2222-4222-8222-222222222222';
const B = '33333333-3333-4333-8333-333333333333';

describe('presença dos membros do servidor (gaveta)', () => {
  test('você mostra o status escolhido, inclusive invisível', () => {
    expect(memberState(ME, ME, 'invisible', {}, {})).toBe('invisible');
    expect(memberState(ME, ME, 'away', {}, {})).toBe('away');
  });

  test('amigo segue a presença de amigos; quem não é amigo segue a do servidor; fora da lista é offline', () => {
    const server = toServerStates([{ user_id: B, state: 'online' }]);
    expect(memberState(A, ME, 'online', { [A]: { ...offlineInfo, state: 'away' } }, { [A]: 'online' })).toBe('away');
    expect(memberState(B, ME, 'online', {}, server)).toBe('online');
    expect(memberState(A, ME, 'online', {}, server)).toBe('offline');
  });
});
