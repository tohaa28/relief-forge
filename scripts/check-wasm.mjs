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
// Same deterministic four-stage auto-repair pipeline used by the browser UI.
const initPaths=[
 {closed:true,points:[[0,0],[10,0],[10,10],[0,10]]},
 {closed:true,points:[[0,0],[10,0],[10,10],[0,10]]},
 {closed:false,points:[[20,0],[20,10],[20.004,0]]},
 {closed:false,points:[[30,0],[30.001,0],[40,0]]}
];
const pack=(paths,action)=>[.01,action,1,paths.length,...paths.flatMap(p=>[+p.closed,p.points.length,...p.points.flat()])];
const before=run(pack(initPaths,0));assert.equal(before.code,0);
let state=initPaths;
for(const action of [2,1,3,4]){const changed=run(pack(state,action));assert.equal(changed.code,0);state=changed.paths;}
const after=run(pack(state,0));assert.equal(after.code,0);
assert(after.issues.length<before.issues.length,'Autofix should reduce issue count on known geometry');
assert(state.some(p=>p.closed&&p.points.some(v=>v[0]>19)),'Near-closed path must become closed');
assert.equal(state.filter(p=>p.points.length===4&&p.closed).length,1,'Duplicate closed path must be removed');
console.log(`PASS: compiled WASM ABI, autoheal before/after, crossings, split, loops, validation, repeated ownership (${bytes.length} bytes).`);
