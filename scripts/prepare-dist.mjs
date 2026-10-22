import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),web=new URL('web/',root),dist=new URL('dist/',root);
const wasm=new URL('engine.wasm',web);
if(!existsSync(wasm)||!WebAssembly.validate(readFileSync(wasm)))throw Error('A verified Rust/WASM engine is required for publication.');
mkdirSync(dist,{recursive:true});
for(const name of readdirSync(web))cpSync(new URL(name,web),new URL(name,dist),{recursive:true});
console.log('Prepared static application with compiled Rust/WASM: '+fileURLToPath(dist));
