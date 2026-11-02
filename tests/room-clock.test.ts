import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextRoomStart,durationLabel} from '../src/lib/room-clock';
test('contador usa começo compartilhado, preserva sessão e reinicia após sala vazia',()=>{
 const a={sid:'a',joinedAt:1000};const b={sid:'b',joinedAt:5000};
 assert.equal(nextRoomStart({},[a],2000),1000);
 assert.equal(nextRoomStart({startedAt:1000,observedAt:6000,sids:['a','b']},[b],7000),1000);
 assert.equal(nextRoomStart({startedAt:1000,sids:['a']},[],8000),null);
 assert.equal(nextRoomStart({startedAt:1000,observedAt:6000,sids:['a']},[{sid:'c',joinedAt:9000}],10000),9000);
 assert.equal(durationLabel(1000,3662000),'01:01:01');assert.equal(durationLabel(null),'');
});
