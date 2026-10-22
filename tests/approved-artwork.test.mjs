import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const file=(name)=>new URL(name,root);
const html=readFileSync(file('web/index.html'),'utf8');
const css=readFileSync(file('web/style.css'),'utf8');
const manifest=JSON.parse(readFileSync(file('web/approved/sha256-manifest.json'),'utf8'));

test('all exact approved PNG originals and cropped icons have unmodified SHA-256',()=>{
  const entries=Object.entries(manifest.files);
  assert.equal(entries.length,33);
  for(const [path,expected] of entries){
    assert.ok(existsSync(file(path)),'Missing approved PNG: '+path);
    const bytes=readFileSync(file(path));
    assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);
    const sha=createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha,expected,path);
  }
});
test('approved mascot appears exactly once in workspace and never in header',()=>{
  const header=html.split('</header>')[0];
  assert.ok(!header.includes('mascot-approved.png'));
  assert.ok(header.includes('approved/icons/appmark.png'));
  assert.equal((html.match(/src="approved\/mascot-approved.png"/g)||[]).length,1);
  assert.match(html,/<div id="mascot-welcome"[^>]*><img class="workspace-mascot" src="approved\/mascot-approved.png"/);
});
test('every referenced approved PNG icon exists and retains interactive controls',()=>{
  const referenced=[...html.matchAll(/src="(approved\/[^"]+\.png)"/g)].map(m=>m[1]);
  assert.ok(referenced.length>=30,'Expected approved icons in main UI and context menu');
  for(const ref of referenced)assert.ok(existsSync(file('web/'+ref)),ref);
  for(const action of ['open','export-eps','save','undo','redo','curve-edit','node-move',
    'node-add','node-remove','node-handles','node-cusp','node-smooth','node-symmetric',
    'node-line','node-curve','node-break','node-close','node-reverse']){
    assert.match(html,new RegExp('<button[^>]*id="'+action+'"[^>]*><img[^>]*approved-icon'));
  }
  assert.match(css,/\.tool-icon\.approved-icon/);
  assert.match(css,/object-fit:contain/);
});
test('approved icon container and keyboard remain independent of exact PNG bytes',()=>{
  assert.match(html,/<kbd>Ctrl\+S<\/kbd>/);
  assert.match(html,/<kbd>Shift\+S<\/kbd>/);
  assert.match(html,/id="node-context"/);
  assert.match(html,/<svg id="canvas"/);
  assert.match(html,/Применить изменения/);
  assert.ok(!html.includes('src="doctor-mascot.svg"'));
});
