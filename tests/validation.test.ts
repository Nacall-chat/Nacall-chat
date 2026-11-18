import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageSchema, usernameKey, usernameSchema, tokenSchema } from '../src/lib/validation';
test('mensagem limita tamanho e rejeita texto vazio', () => {
  assert.equal(messageSchema.parse(' olá '), 'olá');
  assert.equal(messageSchema.safeParse('  ').success, false);
  assert.equal(messageSchema.safeParse('a'.repeat(4001)).success, false);
});
test('nick mantém maiúsculas, aceita símbolos permitidos e recusa o resto', () => {
  assert.equal(usernameSchema.parse(' Maria_01 '), 'Maria_01');
  for (const ok of ['Gu$tavo_X', 'Ana.Paula-2', 'x!#$*+=~^?', 'ABC']) assert.equal(usernameSchema.safeParse(ok).success, true, ok);
  for (const bad of ['ab', 'a'.repeat(25), 'com espaço', '@nick', 'ni@ck', 'maria<script>', 'Ñandú', "o'nick", 'a/b\c', 'nick%']) assert.equal(usernameSchema.safeParse(bad).success, false, bad);
  assert.equal(usernameKey('Gu$tavo_X'), 'gu$tavo_x');
});
test('token só aceita UUID de canal, nunca nome de sala ou identidade fornecida', () => {
  assert.equal(tokenSchema.safeParse({ channelId: 'minha-sala' }).success, false);
  assert.equal(tokenSchema.safeParse({ channelId: '11111111-1111-4111-8111-111111111111', identity: 'outro' }).success, false);
});
