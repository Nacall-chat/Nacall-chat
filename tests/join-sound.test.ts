import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {bindJoinSound} from '../src/lib/join-sound';
test('som de entrada não repete roster inicial, elimina evento duplicado e limpa listeners',()=>{
 const room=Object.assign(new EventEmitter(),{state:'connecting',remoteParticipants:new Map([['old',{sid:'old'}]])});let count=0;
 const stop=bindJoinSound(room,()=>count++);room.emit('participantConnected',{sid:'old'});assert.equal(count,0);
 room.emit('connected');assert.equal(count,1);room.emit('participantConnected',{sid:'old'});assert.equal(count,1);
 room.emit('participantConnected',{sid:'new'});room.emit('participantConnected',{sid:'new'});assert.equal(count,2);
 stop();room.emit('participantConnected',{sid:'next'});assert.equal(count,2);assert.equal(room.listenerCount('participantConnected'),0);
});
