import { test } from 'node:test';
import assert from 'node:assert/strict';
import { messageSchema, usernameSchema, tokenSchema } from '../src/lib/validation';
test('mensagem limita tamanho e rejeita texto vazio', () => {
  assert.equal(messageSchema.parse(' olá '), 'olá');
  assert.equal(messageSchema.safeParse('  ').success, false);
  assert.equal(messageSchema.safeParse('a'.repeat(4001)).success, false);
});
test('username normaliza e recusa caracteres inválidos', () => {
  assert.equal(usernameSchema.parse(' Maria_01 '), 'maria_01');
  assert.equal(usernameSchema.safeParse('maria<script>').success, false);
});
test('token só aceita UUID de canal, nunca nome de sala ou identidade fornecida', () => {
  assert.equal(tokenSchema.safeParse({ channelId: 'minha-sala' }).success, false);
  assert.equal(tokenSchema.safeParse({ channelId: '11111111-1111-4111-8111-111111111111', identity: 'outro' }).success, false);
});
