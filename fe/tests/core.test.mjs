import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, validateState, readState, writeState, KEY} from '../js/storage.js';
import {login, logout, getSession, DEMO_EMAIL, DEMO_PASSWORD} from '../js/auth.js';
const memory = () => { const values = new Map(); return {getItem:k => values.get(k) ?? null,setItem:(k,v) => values.set(k,v),removeItem:k => values.delete(k)}; };
const member = {id:'a',name:'Nguyễn An',code:'CG-01',status:'active',createdAt:'2026-10-01T00:00:00.000Z'};
test('profiles and settings survive a storage roundtrip', () => {
  const storage = memory(), state = {...emptyState(),members:[member]};
  writeState(state,storage); assert.deepEqual(readState(storage),state);
});
test('duplicate codes cannot enter through import', () => {
  assert.throws(() => validateState({...emptyState(),members:[member,{...member,id:'b',code:'cg-01'}]}));
});
test('import strips unknown fields, including biometrics and credentials', () => {
  const state = validateState({...emptyState(),token:'secret',members:[{...member,image:'data:secret',embedding:[1]}]});
  assert.equal(state.token,undefined); assert.equal(state.members[0].image,undefined); assert.equal(state.members[0].embedding,undefined);
});
test('invalid import does not overwrite the last valid data', () => {
  const storage = memory(); writeState({...emptyState(),members:[member]},storage);
  assert.throws(() => writeState({...emptyState(),members:[{...member,status:'invalid'}]},storage));
  assert.equal(readState(storage).members.length,1);
});
test('corrupted storage is reported instead of silently reset', () => {
  const storage = memory(); storage.setItem(KEY,'broken'); assert.throws(() => readState(storage)); assert.equal(storage.getItem(KEY),'broken');
});
test('quota failure reaches the caller', () => {
  assert.throws(() => writeState(emptyState(),{setItem:()=>{throw new Error('quota');}}),/quota/);
});
test('demo auth rejects wrong credentials and supports logout', () => {
  const storage = memory(); assert.throws(() => login(DEMO_EMAIL,'wrong',storage));
  login(DEMO_EMAIL,DEMO_PASSWORD,storage); assert.ok(getSession(storage)); logout(storage); assert.equal(getSession(storage),null);
});
test('expired and malformed sessions are rejected', () => {
  const storage = memory(); storage.setItem('citygym.demo-session',JSON.stringify({expiresAt:1})); assert.equal(getSession(storage),null);
  storage.setItem('citygym.demo-session','oops'); assert.equal(getSession(storage),null);
});
