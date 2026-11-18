import test from 'node:test';
import assert from 'node:assert/strict';
import {sampledContours} from '../web/rich-svg.js';

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
