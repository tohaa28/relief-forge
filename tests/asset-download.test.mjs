import test from 'node:test';
import assert from 'node:assert/strict';
import {downloadBinary} from '../web/asset-download.js';
const wasm=new Uint8Array([0,97,115,109,1,0,0,0]);
const url='https://example.test/engine.wasm';
test('streamed engine download preserves bytes and reports actual received sizes',async()=>{
 const progress=[],body=new ReadableStream({start(c){c.enqueue(wasm.slice(0,4));c.enqueue(wasm.slice(4));c.close();}});
 const actual=await downloadBinary(url,{fetcher:async()=>new Response(body,{headers:{'content-length':'8'}}),onProgress:p=>progress.push(p)});
 assert.deepEqual(actual,wasm);assert.equal(progress.at(-1).loaded,8);assert.equal(progress.at(-1).total,8);assert.equal(progress.at(-1).done,true);assert.ok(progress.some(p=>p.loaded===4));
});
test('compressed transfer Content-Length is never presented as decoded total',async()=>{
 const progress=[];
 await downloadBinary(url,{fetcher:async()=>new Response(wasm,{headers:{'content-length':'4','content-encoding':'gzip'}}),onProgress:p=>progress.push(p)});
 assert.equal(progress.at(-1).loaded,8);assert.ok(progress.every(p=>p.total===0));
});
test('a stalled response header request is aborted with a clear retryable error',async()=>{
 let aborted=false;
 await assert.rejects(downloadBinary(url,{idleTimeoutMs:15,fetcher:async(_,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{aborted=true;reject(Error('aborted'));}))}),/нет данных/);
 assert.equal(aborted,true);
});
test('a stalled body is bounded too, even after an initial valid chunk',async()=>{
 await assert.rejects(downloadBinary(url,{idleTimeoutMs:15,fetcher:async(_,options)=>new Response(new ReadableStream({start(c){c.enqueue(wasm.slice(0,4));options.signal.addEventListener('abort',()=>c.error(Error('aborted')));}}))}),/нет данных/);
});
test('HTTP errors, HTML instead of WASM and excess size fail before engine evaluation',async()=>{
 await assert.rejects(downloadBinary(url,{fetcher:async()=>new Response('Unavailable',{status:503})}),/503/);
 await assert.rejects(downloadBinary(url,{fetcher:async()=>new Response('<html>error</html>')}),/WASM/);
 await assert.rejects(downloadBinary(url,{maxBytes:4,fetcher:async()=>new Response(wasm)}),/Слишком большой/);
});
