import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeferredCurveEditor} from '../web/deferred-curve-editor.js';

const fixture=(count=7545)=>{
 const commands=[['M',0,0]],points=[[0,0]];
 for(let i=1;i<=count;i++){
  const p=[i*.012,Math.sin(i*.035)];
  commands.push(['C',(i-.67)*.012,Math.sin((i-.67)*.035),
    (i-.33)*.012,Math.sin((i-.33)*.035),...p]);
  points.push(p);
 }
 return {kind:'vector',closed:false,offset:[0,0],
   artwork:'<path d="M0 0L1 0" stroke="#123456" fill="none"/>',
   commands,points};
};
test('7545 C: 120 completed local drags never modify the large original figure',()=>{
 const path=fixture(),frozen=JSON.stringify(path),editor=createDeferredCurveEditor(path);
 assert.equal(editor.nodeList().length,7546);
 const base=editor.nodePosition(3750);
 for(let n=0;n<120;n++){
  const delta=(n+1)*.0001;
  const changed=editor.moveAnchor(3750,[base[0]+delta,base[1]+delta]);
  assert.ok(changed.length<=3&&changed.length>0);
  assert.equal(JSON.stringify(path),frozen,'no document or SVG write in manual mode');
 }
 const result=editor.finish();
 assert.equal(result.commands.length,path.commands.length);
 assert.equal(result.commands[3750][0],'C');
 assert.notDeepEqual(result.commands[3750],path.commands[3750]);
 assert.deepEqual(result.commands[100],path.commands[100]);
 assert.ok(editor.affectedSVG().length<=3,'only neighbouring segments get display overlays');
 assert.equal(editor.historySize(),120);
 assert.equal(editor.undoLocal(),true);
 assert.equal(editor.redoLocal(),true);
 assert.deepEqual(editor.finish().commands,result.commands);
});

test('control handles remain local, with preserved cubic geometry and Undo',()=>{
 const original=fixture(50),before=JSON.stringify(original);
 const e=createDeferredCurveEditor(original),p=e.nodePosition(18);
 const change=e.moveHandle(18,'out',[p[0]+.05,p[1]+.10]);
 assert.ok(change.includes(19));
 assert.equal(e.finish().commands.length,original.commands.length);
 assert.notDeepEqual(e.finish().commands[19],original.commands[19]);
 assert.equal(e.undoLocal(),true);
 assert.deepEqual(e.finish().commands,original.commands);
 assert.equal(e.redoLocal(),true);
 assert.equal(JSON.stringify(original),before);
});
test('local add/delete, type conversion, closure and structural Undo use command buffer',()=>{
 const original=fixture(30),frozen=JSON.stringify(original);
 const e=createDeferredCurveEditor(original);
 const near=e.nearestSegment([.06,.1],.3);
 assert.ok(near&&near.t>0&&near.t<1);
 const initial=e.finish().commands.length;
 const inserted=e.addSegment(near.index,.4);
 assert.equal(e.finish().commands.length,initial+1);
 assert.ok(e.nodePosition(inserted));
 assert.equal(e.undoLocal(),true);
 assert.equal(e.finish().commands.length,initial);
 assert.equal(e.redoLocal(),true);
 assert.equal(e.finish().commands.length,initial+1);
 assert.equal(e.removeAnchor(inserted),true);
 assert.equal(e.finish().commands.length,initial);
 assert.equal(JSON.stringify(original),frozen);
});
test('unsaved local edits after undo report no pending source change',()=>{
 const original=fixture(100),e=createDeferredCurveEditor(original),
  before=e.nodePosition(50);
 e.moveAnchor(50,[before[0]+.3,before[1]]);
 assert.equal(e.modified(),true);
 e.undoLocal();
 assert.equal(e.modified(),false);
 assert.deepEqual(e.finish().commands,original.commands);
});

test('7545 cubic controls are spatially bucketed for cursor-local add and context menu',()=>{
 const original=fixture(7545),editor=createDeferredCurveEditor(original);
 const point=editor.nodePosition(3750),radius=.035;
 const before=editor.nearestSegment(point,radius);
 const stats=editor.segmentIndexStats();
 assert.ok(before,'the cursor is on an existing cubic endpoint');
 assert.equal(stats.segments,7545);
 assert.ok(stats.lastNearestCandidates<250,
   'local segment query should avoid 7545 per-gesture checks: '+stats.lastNearestCandidates);
 const moved=[point[0]+.5,point[1]+.4];
 const affected=editor.moveAnchor(3750,moved);
 assert.ok(affected.length>0&&affected.length<=3);
 const after=editor.nearestSegment(moved,radius);
 assert.ok(after,'moving a node must refresh its incident segment index');
 assert.ok(editor.segmentIndexStats().lastNearestCandidates<250);
 assert.deepEqual(original.points[3750],point,'source vector is still immutable');
});

test('a reverted command no longer needs a staged visual segment',()=>{
 const e=createDeferredCurveEditor(fixture(20)),p=e.nodePosition(9);
 e.moveAnchor(9,[p[0]+.2,p[1]+.15]);
 assert.ok(e.affectedSVG().length>0);
 e.moveAnchor(9,p);
 assert.equal(e.affectedSVG().length,0);
});
test('closure is previewed using only a local Z edge before full-document commit',()=>{
 const original=fixture(30),editor=createDeferredCurveEditor(original);
 editor.closeAt(1);
 const pieces=editor.affectedSVG();
 assert.ok(pieces.some(p=>p.key==='z0'&&p.d.includes('L')),
   'newly closed contour must be visible locally without changing the source');
 assert.equal(original.closed,false);
 assert.equal(original.commands.at(-1)[0],'C');
 assert.equal(editor.finish().commands.at(-1)[0],'Z');
});
test('local smooth/symmetric type edits restore anchor geometry and kind with Undo',()=>{
 const original=fixture(40),editor=createDeferredCurveEditor(original);
 const typeBefore=editor.getNode(18).type;
 const choose=typeBefore==='symmetric'?'cusp':'symmetric';
 editor.setKind(18,choose);
 assert.equal(editor.getNode(18).type,choose);
 assert.equal(editor.undoLocal(),true);
 assert.equal(editor.getNode(18).type,typeBefore);
 assert.deepEqual(editor.finish().commands,original.commands);
});

test('breaking a closed contour rotates exactly at the selected anchor, preserving its Bezier silhouette',()=>{
 const path={kind:'vector',closed:true,offset:[0,0],artwork:'<path/>',
  commands:[['M',0,0],['L',10,0],['L',10,10],['L',0,10],['Z'],
    ['M',20,20],['C',22,20,28,30,30,30]],
  points:[[0,0],[10,0],[10,10],[0,10],[20,20],[30,30]],
  nodeKinds:{2:'cusp',6:'smooth'}};
 const before=structuredClone(path),e=createDeferredCurveEditor(path);
 e.breakAt(2);
 const result=e.finish();
 assert.deepEqual(result.commands[0],['M',10,10],
  'opened contour must begin at the chosen node, not at the old contour start');
 assert.deepEqual(result.commands[4],['L',10,10],
  'closed edge becomes the final open segment at the chosen node');
 assert.ok(!result.commands.slice(0,5).some(c=>c[0]==='Z'));
 assert.deepEqual(result.commands.slice(-2),path.commands.slice(-2),
  'another compound subpath must remain geometrically untouched');
 assert.equal(result.nodeKinds[2],undefined,'a moved node label must follow the point, not an obsolete command ID');
 assert.equal(result.nodeKinds[0],'cusp');
 assert.equal(result.nodeKinds[6],'smooth');
 assert.deepEqual(path,before);
 assert.equal(e.undoLocal(),true);
 assert.deepEqual(e.finish().commands,path.commands);
 assert.equal(e.redoLocal(),true);
 assert.deepEqual(e.finish().commands,result.commands);
});

test('reversing one compound subpath retains other subpaths and restores exact geometry on undo',()=>{
 const path=fixture(80);
 const commands=path.commands.concat([['M',200,200],['L',205,205]]);
 const compound={...path,commands,points:[...path.points,[200,200],[205,205]]};
 const e=createDeferredCurveEditor(compound);
 const original=structuredClone(compound.commands);
 e.reversePart(42);
 const reversed=e.finish().commands;
 assert.deepEqual(reversed.slice(-2),original.slice(-2));
 assert.deepEqual(reversed[0].slice(1),original[80].slice(-2));
 assert.equal(e.undoLocal(),true);
 assert.deepEqual(e.finish().commands,original);
 assert.equal(e.redoLocal(),true);
 assert.deepEqual(e.finish().commands,reversed);
});

test('closing the first of two open subpaths remaps later saved node types without modifying source',()=>{
 const path={kind:'vector',closed:false,offset:[0,0],artwork:'<path/>',
   commands:[['M',0,0],['L',5,0],['M',20,20],['C',22,20,28,25,30,25]],
   points:[[0,0],[5,0],[20,20],[30,25]],nodeKinds:{3:'smooth'}};
 const e=createDeferredCurveEditor(path);
 e.closeAt(1);
 assert.deepEqual(e.finish().commands[2],['Z']);
 assert.equal(e.finish().nodeKinds[4],'smooth');
 assert.equal(e.undoLocal(),true);
 assert.equal(e.finish().nodeKinds[3],'smooth');
 assert.deepEqual(path.commands[2],['M',20,20]);
});
