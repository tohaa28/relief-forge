import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportEps} from '../web/eps-export.js';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('unapplied DO/POSLE preview does not disable committed EPS saving',()=>{
  const start=app.indexOf("$('export-eps').onclick=");
  const end=app.indexOf("$('log').onclick=",start);
  assert.ok(start>=0&&end>start);
  const action=app.slice(start,end);
  assert.match(action,/exportEps\(doc\)/);
  assert.doesNotMatch(action,/if\s*\(curvePreview\)\s*\{/);
  assert.match(action,/currentComparison\(\)/);
  assert.match(action,/epsResultFilename\(doc\.sourceFileName/);
});
test('EPS export serializes only committed geometry, not smoother preview',()=>{
  const source={width:20,height:20,paths:[{closed:false,points:[[0,0],[10,0]]}]};
  const candidate={width:20,height:20,paths:[{closed:false,points:[[0,0],[10,10]]}]};
  const snapshot=JSON.stringify(source);
  const output=exportEps(source);
  assert.match(output,/10 0 L|28\.3464567 56\.6929134 L|28\.3464567 56\.69291338 L/);
  assert.notEqual(output,exportEps(candidate));
  assert.equal(JSON.stringify(source),snapshot);
});
