import test from 'node:test';
import assert from 'node:assert/strict';
import {sampledContours} from '../web/rich-svg.js';
import {planDiagnosticBatches} from '../web/large-file-support.js';

test('Compound EPS-like vector scans every contour even above old 20k aggregate ceiling',()=>{
  const commands=[];
  const totalContours=1000,perContour=26;
  for(let c=0;c<totalContours;c++){
    commands.push(['M',0,c]);
    for(let j=1;j<=perContour;j++)commands.push(['L',j,c]);
    commands.push(['Z']);
  }
  const original=JSON.stringify(commands);
  const parts=sampledContours({kind:'vector',artwork:'<path/>',commands,offset:[0,0]},.01);
  assert.equal(parts.length,totalContours);
  assert.equal(parts.reduce((n,p)=>n+p.points.length,0),totalContours*(perContour+1));
  assert.equal(parts[0].closed,true);assert.equal(parts.at(-1).closed,true);
  assert.deepEqual(parts[0].points[0],[0,0]);assert.deepEqual(parts.at(-1).points.at(-1),[perContour,totalContours-1]);
  assert.equal(JSON.stringify(commands),original,'sampling must not modify original Bézier commands');
});

test('1933 compound Corel-like subpaths and 12965 cubic segments all enter bounded Rust windows',()=>{
  const commands=[],contours=1933,curves=12965;
  let remaining=curves;
  for(let c=0;c<contours;c++){
    commands.push(['M',0,c]);const n=Math.floor(remaining/(contours-c));remaining-=n;
    for(let j=0;j<n;j++)commands.push(['C',j+1/3,c+.1,j+2/3,c-.1,j+1,c]);
    commands.push(['Z']);
  }
  assert.equal(remaining,0);
  assert.equal(commands.filter(c=>c[0]==='C').length,curves);
  const parts=sampledContours({kind:'vector',artwork:'<path/>',commands,offset:[0,0]},.01);
  assert.equal(parts.length,contours);
  const total=parts.reduce((n,p)=>n+p.points.length,0);
  assert.ok(total>20000,'previous global per-element ceiling must be exceeded');
  const plan=planDiagnosticBatches(parts,parts.map(()=>0));
  assert.equal(plan.skipped.length,0);
  assert.equal(plan.covered,contours);
  assert.ok(plan.batches.length>1);
  assert.equal(plan.totalPoints,total,'no vertices disappear between batches');
  assert.ok(plan.batches.every(batch=>batch.points<=2000));
});
