import test from 'node:test';
import assert from 'node:assert/strict';
import {curveDistance,findCurveClearances} from '../web/curve-clearance.js';
const line=(y)=>({points:[[0,y],[10,y]],closed:false});
const native=(commands,offset=[0,0])=>({artwork:'<path/>',commands,offset,points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2))});
test('strict mm threshold: below, equal, above; real closest witnesses',()=>{
 for(const [y,count] of [[.0999,1],[.1,0],[.1001,0]]){const r=findCurveClearances({paths:[line(0),line(y)]});assert.equal(r.markers.length,count);assert.equal(r.complete,true);if(count)assert.equal(r.markers[0].distance,y);}
});
test('line crossing, endpoints, degenerate segment and symmetry',()=>{
 for(const [a,b,want] of [[[[0,0],[1,1]],[[0,1],[1,0]],0],[[[0,0],[1,0]],[[2,1],[2,2]],Math.SQRT2],[[[0,0],[0,0]],[[1,0],[2,0]],1]]){
  assert.ok(Math.abs(curveDistance(a,b,{threshold:3}).distance-want)<1e-12);assert.equal(curveDistance(a,b).distance,curveDistance(b,a).distance);
 }
});
test('quadratic internal minimum between endpoints is found analytically',()=>{
 const r=curveDistance([[0,1],[1,-.9],[2,1]],[[-1,0],[3,0]]);
 assert.ok(Math.abs(r.distance-.05)<1e-8);assert.equal(r.complete,true);assert.ok(r.lower<=.05+1e-10);
});
test('cubic interior extremum and large controls do not use anchor distance',()=>{
 const r=curveDistance([[0,1],[1,-.28],[2,-.28],[3,1]],[[-1,0],[4,0]]);
 assert.ok(Math.abs(r.distance-.04)<1e-8);assert.equal(r.complete,true);
 const far=curveDistance([[0,1],[1,.2],[2,.2],[3,1]],[[-1,0],[4,0]]);assert.ok(far.lower>=.1);assert.equal(far.complete,true);
});
test('two genuine cubic curves: internal minimum, reversal and translation',()=>{
 const a=[[0,0],[1,.4],[2,.4],[3,0]],b=[[0,1],[1,.12],[2,.12],[3,1]];
 for(const [x,y] of [[a,b],[b,a],[a.toReversed(),b],[a.map(p=>[p[0]+1000,p[1]+2000]),b.map(p=>[p[0]+1000,p[1]+2000])]]){
  const r=curveDistance(x,y);assert.ok(Math.abs(r.distance-.04)<1e-8);assert.equal(r.complete,true);assert.ok(r.distance-r.lower<=1e-5+1e-10);
 }
});
test('subdivision finds an off-grid cubic minimum using independent derivative roots',()=>{
 const y=[1,-.3,-.1,1],a=-y[0]+3*y[1]-3*y[2]+y[3],b=3*y[0]-6*y[1]+3*y[2],c=-3*y[0]+3*y[1];
 const t=(-2*b+Math.sqrt(4*b*b-12*a*c))/(6*a),minimum=(1-t)**3*y[0]+3*(1-t)**2*t*y[1]+3*(1-t)*t*t*y[2]+t**3*y[3];
 assert.ok(Math.abs(t-.5)>.01);
 const r=curveDistance([[0,y[0]],[1,y[1]],[2,y[2]],[3,y[3]]],[[-1,0],[4,0]],{threshold:.2,epsilon:1e-7});
 assert.equal(r.complete,true);assert.ok(Math.abs(r.distance-minimum)<1e-7);assert.ok(r.lower<=minimum+1e-12);assert.ok(r.distance-r.lower<=1e-7);
});
test('curved approach close to threshold never becomes a false positive from its chord',()=>{
 for(const clearance of [.09999,.10001]){
  const a=[[0,0],[1,.4],[2,.4],[3,0]],b=[[0,1],[1,(clearance+.05)/.75],[2,(clearance+.05)/.75],[3,1]];
  const r=curveDistance(a,b,{epsilon:1e-7});assert.ok(Math.abs(r.distance-clearance)<1e-8);assert.equal(r.distance<.1,clearance<.1);assert.equal(r.complete,true);
 }
});
test('compound subpaths and world offsets participate; original stays byte-identical',()=>{
 const doc={paths:[native([['M',0,0],['L',10,0],['M',0,.05],['Q',5,.05,10,.05]],[20,30])]};const before=JSON.stringify(doc),r=findCurveClearances(doc);
 assert.equal(r.markers.length,1);assert.equal(r.complete,true);assert.ok(Math.abs(r.markers[0].point[1]-30.025)<1e-9);assert.equal(JSON.stringify(doc),before);
});
test('open/closed adjacent joins suppressed, nonadjacent narrow contour retained',()=>{
 assert.equal(findCurveClearances({paths:[{points:[[0,0],[1,0],[1,1]],closed:false}]}).markers.length,0);
 assert.equal(findCurveClearances({paths:[{points:[[0,0],[1,0],[1,1],[0,1]],closed:true}]}).markers.length,0);
 assert.equal(findCurveClearances({paths:[{points:[[0,0],[1,0],[1,.05],[0,.05]],closed:true}]}).markers.length,1);
});
test('different objects with common endpoint are a real zero-distance pair; images excluded',()=>{
 assert.equal(findCurveClearances({paths:[line(0),line(0),{kind:'image'}]}).markers.length,1);
});
test('tiny budget and marker cap explicitly report incomplete',()=>{
 assert.equal(findCurveClearances({paths:[line(0),line(.05)]},{maxWork:0}).complete,false);
 assert.equal(findCurveClearances({paths:[line(0),line(.05),line(.07)]},{maxMarkers:1}).complete,false);
 assert.equal(curveDistance([[0,1],[1,-.9],[2,1]],[[0,0],[2,0]],{budget:{remaining:0}}).complete,false);
});
test('unsupported commands not silently certified and threshold validated',()=>{
 assert.equal(findCurveClearances({paths:[native([['M',0,0],['A',1,1,0,0,0,2,2]])]}).complete,false);
 assert.throws(()=>findCurveClearances({paths:[]},{threshold:0}));
});
test('sweep rejects 10000 widely separated segments without quadratic work',()=>{
 const paths=Array.from({length:10000},(_,i)=>({points:[[i*20,0],[i*20+1,0]]}));const r=findCurveClearances({paths});assert.equal(r.complete,true);assert.equal(r.comparisons,0);assert.equal(r.work,0);
});
