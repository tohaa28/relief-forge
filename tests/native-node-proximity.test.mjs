import test from 'node:test';
import assert from 'node:assert/strict';
import {refineNativeDiagnostics} from '../web/native-diagnostic-refinement.js';
import {visibleHealthyAnchors} from '../web/vector-points.js';

const line=(...points)=>({points,closed:false});
const vector=(commands,offset=[0,0])=>({kind:'vector',artwork:'<path/>',commands,offset});
const pointIssues=(paths,tol=.01,raw=[])=>refineNativeDiagnostics({paths},raw,null,tol).issues
 .filter(x=>['coincident','near_node','short'].includes(x.kind));

test('separate contours with a .006 mm clearance do not have coincident nodes',()=>{
 const paths=[line([0,0],[5,0]),line([0,.006],[5,.006])];
 const raw=[{kind:'coincident',path:0,other:1,point:[0,0]}];
 assert.deepEqual(pointIssues(paths,.01,raw),[]);
 const [coincidence]=pointIssues([paths[0],line([0,0],[0,5])]);
 assert.equal(coincidence.kind,'coincident');
 assert.equal(coincidence.distanceMm,0);
 assert.deepEqual(coincidence.nodePoints,[[0,0],[0,0]]);
});

test('dense runs and closed seams do not also report branch proximity',()=>{
 const dense=line([0,0],[.002,0],[.004,0],[5,0]);
 assert.deepEqual(pointIssues([dense]).map(i=>i.kind),['short','short']);
 const closed={closed:true,points:[[0,0],[.003,0],[5,0],[5,5],[0,5],[0,.003]]};
 assert.deepEqual(pointIssues([closed]).map(i=>i.kind),['short','short']);
});

test('actual near anchors on separate branches of one curve keep precise witnesses at threshold',()=>{
 const tol=1/128,below=tol-2**-30,above=tol+2**-30;
 const branch=gap=>vector([['M',0,0],['C',2,-3,5,-2,6,0],['L',7,4],['Q',2,2,0,gap],['L',-1,2]],[24,16]);
 const [hit]=pointIssues([branch(below)],tol);
 assert.equal(hit.kind,'near_node');
 assert.equal(hit.distanceMm,below);
 assert.deepEqual(hit.nodePoints,[[24,16+below],[24,16]]);
 assert.equal(pointIssues([branch(tol)],tol)[0].distanceMm,tol);
 assert.deepEqual(pointIssues([branch(above)],tol),[]);
 const [exact]=pointIssues([branch(0)],tol);
 assert.equal(exact.kind,'coincident');
});

test('native pair markers leave all nonparticipating nodes visible',()=>{
 const paths=[line([0,0],[6,0],[6,4],[0,.006],[-1,2]),line([0,.003],[-2,.003])];
 const issues=pointIssues(paths);
 assert.equal(issues.length,1);
 assert.deepEqual(visibleHealthyAnchors({paths},issues,.01).map(({point})=>point),
  [[6,0],[6,4],[-1,2],[0,.003],[-2,.003]]);
});
