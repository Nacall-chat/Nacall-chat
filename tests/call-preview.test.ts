import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callPreview, extraLabel, placeRailPopover, serverCallPeople } from '../src/lib/call-preview';
import type { RoomSnapshot } from '../src/lib/room-clock';

const person = (id: string) => ({ id, name: id.toUpperCase(), avatar: '' });
const rooms: Record<string, RoomSnapshot> = {
  v1: { channelId: 'v1', startedAt: 1, count: 2, participants: [person('a'), person('b')] },
  v2: { channelId: 'v2', startedAt: 1, count: 2, participants: [person('b'), person('c')] },
};

test('popover do rail: junta as salas do servidor sem repetir quem está em duas', () => {
  assert.deepEqual(serverCallPeople(['v1', 'v2', 'vazia'], id => rooms[id]).map(p => p.id), ['a', 'b', 'c']);
  assert.deepEqual(serverCallPeople([], id => rooms[id]), [], 'servidor sem sala de voz: ninguém em call (e o popover não aparece)');
  assert.deepEqual(serverCallPeople(['vazia'], id => rooms[id]), []);
});

test('popover do rail: até 5 rostos e "+N" do excedente, com teto de +99', () => {
  const many = Array.from({ length: 112 }, (_, i) => i);
  assert.deepEqual(callPreview([1, 2, 3]), { shown: [1, 2, 3], extra: 0 });
  assert.deepEqual(callPreview(many, 5).shown, [0, 1, 2, 3, 4]);
  assert.equal(callPreview(many, 5).extra, 107);
  assert.equal(extraLabel(7), '+7');
  assert.equal(extraLabel(107), '+99');
});

test('popover do rail: abre à direita do ícone, centralizado e sem sair da tela', () => {
  assert.deepEqual(placeRailPopover({ right: 60, top: 200, bottom: 246 }, 800, 92), { left: 72, top: 177 });
  assert.equal(placeRailPopover({ right: 60, top: 0, bottom: 20 }, 800, 92).top, 8, 'no topo, não passa da borda');
  assert.equal(placeRailPopover({ right: 60, top: 780, bottom: 800 }, 800, 92).top, 700, 'embaixo, sobe para caber');
});
