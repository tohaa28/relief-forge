import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
const base=new URL('../web/',import.meta.url);
const version=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')).version;
test('every versioned local ES module, CSS and script uses the current release cache key',()=>{
 const files=['index.html',...readdirSync(base).filter(p=>p.endsWith('.js')||p.endsWith('.mjs'))];
 let count=0;
 for(const file of files){
  const source=readFileSync(new URL(file,base),'utf8');
  for(const match of source.matchAll(/\?v=(0\.2\.0-alpha\.\d+)/g)){
   assert.equal(match[1],version, file+' has a stale cache-busting URL');count++;
  }
 }
 assert.ok(count>10,'expected versioned module imports to be covered');
});
