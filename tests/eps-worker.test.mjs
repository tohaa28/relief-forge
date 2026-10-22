import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('real EPS worker short-circuits CorelDRAW outlines before any network or wasm load',async()=>{
  const fixture=readFileSync(new URL('./fixtures/eps/corel-unpainted.eps',import.meta.url));
  const messages=[];
  const oldSelf=globalThis.self,oldFetch=globalThis.fetch;
  try{
    globalThis.self={postMessage:m=>messages.push(m)};
    globalThis.fetch=()=>{throw Error('Unexpected large importer fetch on a simple vector-only EPS');};
    await import('../web/eps-worker.js');
    await globalThis.self.onmessage({data:{bytes:new Uint8Array(fixture),fonts:[]}});
    const last=messages.at(-1);
    assert.equal(last?.type,'done',JSON.stringify(last));
    assert.equal(last.result.outlineRecovery.count,2);
    assert.match(last.result.svg,/stroke=/);
    assert.ok(messages.some(m=>m.type==='progress'));
    assert.ok(!messages.some(m=>m.type==='error'));
  }finally{globalThis.self=oldSelf;globalThis.fetch=oldFetch;}
});
