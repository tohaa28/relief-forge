import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {exportEps} from '../web/eps-export.js';

const app=readFileSync(new URL('../web/app.js',import.meta.url),'utf8');
test('unresolved preview never enters EPS without clean full-document Rust preflight',()=>{
  const start=app.indexOf('function exportConfirmedEps('),end=app.indexOf("$('log').onclick=",start);
  assert.ok(start>=0&&end>start);
  const action=app.slice(start,end);
  assert.match(action,/exportEps\(doc\)/);
  assert.match(action,/epsResultFilename\(doc.sourceFileName/);
  assert.match(action,/function saveEpsWithPreflight\(\)/);
  assert.match(action,/epsSaveCandidate\(doc,curvePreview,readEpsSaveSettings\(\)\)/);
  assert.match(action,/showEpsSaveWarning/);
  assert.match(action,/exportConfirmedEps\(\{overridden:true,verified:false\}\)/);
  assert.doesNotMatch(action,/exportEps\(curvePreview\.result\)/);
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
