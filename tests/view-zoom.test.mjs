import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheViewDecorations} from '../web/view-zoom.js';
const element=attributes=>({attributes:{...attributes},writes:0,
 getAttribute(key){return String(this.attributes[key]);},hasAttribute(key){return key in this.attributes;},
 setAttribute(key,value){this.attributes[key]=value;this.writes++;}});
const root=nodes=>({queries:0,querySelectorAll(selector){this.queries++;return nodes.filter(n=>selector.includes('text')?n.text:!n.text);}});
test('view zoom cache resizes decorations without changing world positions or querying geometry again',()=>{
 const node=element({cx:2,cy:3,r:.31}),ring=element({cx:5,cy:6,r:.7}),label=element({x:6,y:5.1,'font-size':1.2});
 label.text=true;label.parentNode={querySelector:()=>ring};
 const geometry=root([node]),markers=root([ring,label]),clearance=root([]),refresh=cacheViewDecorations(geometry,markers,clearance,.1);
 const queries=[geometry.queries,markers.queries,clearance.queries];refresh(.02);
 assert.ok(Math.abs(node.attributes.r-.062)<1e-12);assert.ok(Math.abs(ring.attributes.r-.14)<1e-12);
 assert.equal(ring.attributes.cx,5);assert.equal(ring.attributes.cy,6);
 assert.equal(label.attributes.x,5.2);assert.equal(label.attributes.y,5.82);assert.equal(label.attributes['font-size'],.24);
 assert.deepEqual([geometry.queries,markers.queries,clearance.queries],queries);
 const writes=ring.writes;refresh(.02);refresh(NaN);assert.equal(ring.writes,writes,'pan/invalid scale does no decoration writes');
});
test('clearance radius retains physical threshold while maintaining a seven-pixel minimum',()=>{
 const mark=element({cx:1,cy:2,r:.7,'data-distance-mm':.15}),refresh=cacheViewDecorations(root([]),root([]),root([mark]),.1,null,.2);
 refresh(.05);assert.ok(Math.abs(mark.attributes.r-.35)<1e-12,'do not retain the previous screen-size radius as a physical floor');
 refresh(.001);assert.equal(mark.attributes.r,.2);
});
test('healthy anchor decoration changes radius around exact cached positions',()=>{
 const path=element({d:''}),points=[[10,20],[30,40]],refresh=cacheViewDecorations(root([]),root([]),root([]),.1,{element:path,points});
 refresh(.01);const moves=[...path.attributes.d.matchAll(/M ([\d.]+) ([\d.]+) a ([\d.]+)/g)];
 assert.equal(moves.length,2);moves.forEach((m,i)=>{assert.ok(Math.abs(Number(m[1])+Number(m[3])-points[i][0])<1e-12);assert.equal(Number(m[2]),points[i][1]);});
 assert.deepEqual(points,[[10,20],[30,40]]);
});
