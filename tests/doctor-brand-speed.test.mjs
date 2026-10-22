import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {keyboardAction} from '../web/doctor-shortcuts.js';
import {curveNodes,curveNodesTyped,curveNodeType} from '../web/curve-edit.js';
const read=p=>readFileSync(new URL('../web/'+p,import.meta.url),'utf8');
const key=(value,options={})=>keyboardAction({key:value,code:options.code||'',target:{tagName:options.tagName||'BODY'},...options},Boolean(options.nodes));

test('Every editing and file operation has its unique SVG symbol and Russian branding',()=>{
  const html=read('index.html'),icons=read('doctor-icons.svg'),styles=read('style.css');
  assert.match(html,/Доктор\s*<em>Узелков<\/em>/);
  assert.match(html,/approved\/mascot-approved\.png/);
  assert.match(styles,/\.mascot-welcome/);
  const present=new Set([...icons.matchAll(/<symbol id="([^"]+)"/g)].map(v=>v[1]));
  assert.ok(present.size>=32);
  for(const [,id] of html.matchAll(/<use href="doctor-icons\.svg#([^"]+)"/g))
    assert.ok(present.has(id),'Unresolved icon '+id);
  for(const name of ['node-move','node-add','node-remove','node-handles','node-cusp','node-smooth',
    'node-symmetric','node-line','node-curve','node-break','node-close','node-reverse']){
    assert.match(html,new RegExp('id="'+name+'"[^>]*><img[^>]*approved-icon'));
  }
  for(let i=1;i<=8;i++)assert.match(html,new RegExp('data-action="'+i+'"[^>]*><svg'));
});

test('Global hotkeys, node modes and text-field safety are deterministic',()=>{
  assert.deepEqual(key('o',{ctrlKey:true}),{button:'open'});
  assert.deepEqual(key('s',{ctrlKey:true}),{button:'export-eps'});
  assert.deepEqual(key('S',{ctrlKey:true,shiftKey:true}),{button:'save'});
  assert.deepEqual(key('z',{ctrlKey:true}),{button:'undo'});
  assert.deepEqual(key('Z',{ctrlKey:true,shiftKey:true}),{button:'redo'});
  assert.deepEqual(key('y',{ctrlKey:true}),{button:'redo'});
  assert.deepEqual(key('n',{ctrlKey:true}),{button:'new'});
  assert.deepEqual(key('E',{ctrlKey:true,shiftKey:true}),{button:'export'});
  assert.deepEqual(key('v',{}),{button:'select'});
  assert.deepEqual(key('e',{}),{button:'curve-edit'});
  assert.deepEqual(key('h',{nodes:true}),{tool:'handles'});
  assert.deepEqual(key('+',{nodes:true,shiftKey:true}),{tool:'add'});
  assert.deepEqual(key('Delete',{nodes:true}),{operation:'remove'});
  assert.deepEqual(key('s',{nodes:true}),{operation:'smooth'});
  assert.deepEqual(key('s',{nodes:true,shiftKey:true}),{operation:'symmetric'});
  assert.deepEqual(key('x',{nodes:true}),{operation:'close'});
  assert.deepEqual(key('c',{nodes:true}),{operation:'cusp'});
  assert.deepEqual(key('3',{code:'Digit3',altKey:true,shiftKey:true}),{repair:3});
  assert.equal(key('s',{tagName:'INPUT',ctrlKey:true}),null);
  assert.equal(key('q',{nodes:true,altKey:true}),null);
  assert.equal(key('q',{nodes:false}),null);
});

test('One-pass typed nodes agree exactly with legacy node positions and kinds',()=>{
  const commands=[['M',0,0],['C',2,4,5,6,8,0],['C',9,-4,12,-3,15,1],['Z'],
    ['M',20,20],['L',25,30]];
  const path={kind:'vector',closed:false,offset:[3,5],artwork:'<path d="M0 0"/>',
    commands,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))};
  const actual=curveNodesTyped(path),expected=curveNodes(path);
  assert.equal(actual.length,expected.length);
  actual.forEach((node,i)=>{
    assert.deepEqual([node.index,node.part,node.ordinal,node.point],
      [expected[i].index,expected[i].part,expected[i].ordinal,expected[i].point]);
    assert.equal(node.type,curveNodeType(path,node.index));
  });
  const many={points:Array.from({length:1500},(_,i)=>[i,Math.sin(i)]),closed:false};
  assert.equal(curveNodesTyped(many).length,1500);
});

test('Persistent EPS engine, transfer buffers and animation-frame rendering are wired',()=>{
  const worker=read('eps-worker.js'),app=read('app.js');
  assert.match(worker,/let enginesPromise=null/);
  assert.match(worker,/if\(enginesPromise\)return enginesPromise/);
  assert.match(worker,/const direct=pipeline\.recoverOutlineOnlyEps/);
  assert.match(app,/epsWorker\?\?=new Worker/);
  assert.match(app,/\[transfer\.buffer\]/);
  assert.match(app,/stopEps\(\{destroy:true\}\)/);
  assert.match(app,/epsImportActive/);
  assert.match(app,/requestAnimationFrame/);
  assert.match(app,/curveNodesTyped\(p\)/);
  assert.match(app,/eps-import-time/);
  assert.doesNotMatch(worker,/createGhostscriptCore\(\{wasmBinary\}\)/);
});
