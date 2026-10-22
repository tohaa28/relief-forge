import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const bytes=readFileSync(new URL('../web/engine.wasm',import.meta.url));
assert(WebAssembly.validate(bytes),'Invalid WASM');
const {instance}=await WebAssembly.instantiate(bytes,{});const e=instance.exports;
for(const name of ['memory','input_alloc','run','result_ptr','result_len'])assert(name in e,`Missing export: ${name}`);
const run=input=>{const ptr=e.input_alloc(input.length);new Float64Array(e.memory.buffer,ptr,input.length).set(input);const code=e.run(ptr,input.length);const result=JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,e.result_ptr(),e.result_len())));return {code,...result};};
// A real compiled WASM crossing test: two crossing lines must produce the centre marker.
const crossing=run([.01,0,0,2,0,2,0,0,10,10,0,2,0,10,10,0]);
assert.equal(crossing.code,0);assert(crossing.issues.some(x=>x.kind==='intersection'&&x.point[0]===5&&x.point[1]===5));
const split=run([.01,7,0,2,0,2,0,0,10,10,0,2,0,10,10,0]);assert.equal(split.paths.length,4);
const loops=run([.01,8,1,1,1,4,0,0,10,10,0,10,10,0]);assert.equal(loops.paths.length,2);
const bad=run([NaN,0,0,0]);assert.equal(bad.code,1);assert(bad.error);
for(let i=0;i<100;i++)assert.equal(run([.01,0,0,0]).code,0);
console.log(`PASS: compiled WASM ABI, crossings, split, loops, validation, repeated ownership (${bytes.length} bytes).`);
