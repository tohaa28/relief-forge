import fs from 'node:fs';
import assert from 'node:assert/strict';
const load=async file=>{
 const {instance}=await WebAssembly.instantiate(fs.readFileSync(file),{}),e=instance.exports;
 return input=>{const p=e.input_alloc(input.length);new Float64Array(e.memory.buffer,p,input.length).set(input);assert.equal(e.run(p,input.length),0);return new TextDecoder().decode(new Uint8Array(e.memory.buffer,e.result_ptr(),e.result_len()));};
};
const old=await load(process.env.BASELINE_WASM||'evidence/private/alpha32-engine.wasm'),next=await load('web/engine.wasm');
let seed=32768;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
const inputs=[];
for(let test=0;test<120;test++){
 const paths=Array.from({length:1+test%4},(_,j)=>({closed:test%3!==0,points:Array.from({length:4+test%27},()=>[Math.round(rand()*50)/5+j,Math.round(rand()*50)/5])}));
 const tolerance=[.000001,.01,.5,2][test%4];
 inputs.push([tolerance,0,0,paths.length,...paths.flatMap(p=>[+p.closed,p.points.length,...p.points.flat()])]);
}
const ring=Array.from({length:2000},(_,i)=>[100*Math.cos(i*Math.PI/1000),100*Math.sin(i*Math.PI/1000)]);
inputs.push([.01,0,0,1,1,ring.length,...ring.flat()]);
for(const input of inputs)assert.equal(next(input),old(input),'optimized kernel must preserve exact JSON including order and indices');
const bench=run=>{const t=performance.now();for(let i=0;i<5;i++)run(inputs.at(-1));return (performance.now()-t)/5;};
const before=bench(old),after=bench(next);
console.log(JSON.stringify({differentialCases:inputs.length,oldMs:Math.round(before),newMs:Math.round(after),speedup:Number((before/after).toFixed(2)),nodes:2000}));
