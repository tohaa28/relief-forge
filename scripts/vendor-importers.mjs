import {cpSync,existsSync,mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),vendor=new URL('web/vendor/',root);
mkdirSync(vendor,{recursive:true});
const gs=new URL('node_modules/@wasm-zoo/ghostscript/',root);
cpSync(gs,new URL('ghostscript/',vendor),{recursive:true});
const mp=new URL('node_modules/mupdf/',root),mpout=new URL('mupdf/',vendor);
mkdirSync(mpout,{recursive:true});
for(const name of readdirSync(new URL('dist/',mp)))if(/\.(js|wasm)$/.test(name))cpSync(new URL('dist/'+name,mp),new URL(name,mpout));
for(const name of ['LICENSE','COPYING','README.md','package.json'])if(existsSync(new URL(name,mp)))cpSync(new URL(name,mp),new URL(name,mpout));
await build({stdin:{contents:'import svgpath from "svgpath";export default svgpath;',resolveDir:fileURLToPath(root)},bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('svgpath.mjs',vendor)),legalComments:'inline'});
cpSync(new URL('node_modules/svgpath/LICENSE',root),new URL('LICENSE-svgpath',vendor));
// Geometry-only Paper core: no PaperScript, DOM emulation or native canvas.
await build({stdin:{contents:'import paper from "paper/dist/paper-core.js";export default paper;',resolveDir:fileURLToPath(root)},bundle:true,format:'esm',platform:'browser',outfile:fileURLToPath(new URL('paper-core.mjs',vendor)),legalComments:'inline',plugins:[{
 name:'geometry-only-node-self',setup(b){
  b.onResolve({filter:/node\/self\.js$/},()=>({path:'geometry-self',namespace:'geometry'}));
  b.onLoad({filter:/.*/,namespace:'geometry'},()=>({contents:'module.exports={navigator:{userAgent:"ReliefForge geometry kernel"}};',loader:'js'}));
 }
}]});
cpSync(new URL('node_modules/paper/LICENSE.txt',root),new URL('LICENSE-paper',vendor));
const provenance=JSON.parse(readFileSync(new URL('provenance.json',gs)));
for(const item of provenance.subject.filter(s=>s.name==='gs-core.wasm'||s.name==='gs-core.js')){
  const actual=createHash('sha256').update(readFileSync(new URL('ghostscript/'+item.name,vendor))).digest('hex');
  if(actual!==item.digest.sha256)throw Error('Ghostscript upstream digest mismatch: '+item.name);
}
writeFileSync(new URL('versions.json',vendor),JSON.stringify({ghostscript:'10.08.0',ghostscript_package:'0.7.2',mupdf:'1.28.1',svgpath:'2.6.0',paper:'0.16.0',wasmBytes:{ghostscript:readFileSync(new URL('ghostscript/gs-core.wasm',vendor)).length,mupdf:readFileSync(new URL('mupdf/mupdf-wasm.wasm',vendor)).length}},null,2));
console.log('Self-hosted EPS importers prepared; Ghostscript provenance digests verified.');
