// Investigation fixtures, not a repair and not a clean-geometry certificate.
// Run on any revision to see whether the alpha.41 limitations still reproduce.
// No private input or geometry is used.
import {sampledContours} from '../web/rich-svg.js';
import {curveDistance} from '../web/curve-clearance.js';
import {planDiagnosticBatches} from '../web/large-file-support.js';
import {repairVectorPoints} from '../web/point-repair.js';
import {protectPreviewNodeBudget} from '../web/preview-node-budget.js';
import {validateDocumentCurveChange} from '../web/curve-quality.js';
const curve={kind:'vector',artwork:'<path/>',offset:[0,0],commands:[['M',0,0],['C',1,.01,2,.01,3,0]],points:[[0,0],[3,0]],closed:false};
const chord=sampledContours(curve,.01)[0].points;
const actual=curveDistance([[0,0],[1,.01],[2,.01],[3,0]],[[1.5,-.001],[1.5,.001]],{threshold:.1,epsilon:1e-9});
const line={points:[[0,0],[1,0]],closed:false};
const plan=planDiagnosticBatches([line,{points:[[10,10],[11,10]],closed:false},structuredClone(line)],[0,1,2],4);
const tiny={kind:'vector',artwork:'<path/>',offset:[0,0],commands:[['M',0,0],['L',.001,0],['L',0,.001],['Z']],points:[[0,0],[.001,0],[0,.001]],closed:true,paint:{fill:'#000000',stroke:'none',opacity:1,fillRule:'nonzero'}};
const repaired=repairVectorPoints({paths:[tiny]},[0],.01);
const source={paths:[structuredClone(tiny),structuredClone(tiny),structuredClone(tiny)]};
const inflated={paths:[structuredClone(tiny),{points:Array.from({length:20},(_,i)=>[i,1]),closed:false}]};
const budget=protectPreviewNodeBudget(source,source,inflated);
const aggregate={paths:Array.from({length:3},(_,j)=>({points:Array.from({length:7001},(_,i)=>[i*.1,j*10]),closed:false}))};
const quality=validateDocumentCurveChange(aggregate,aggregate,{tolerance:.07,nodeTolerance:.01});
console.log(JSON.stringify({
 chordIntersection:{sampledChord:chord,proxyCrossing:[1.5,0],nativeDistanceLower:actual.lower,nativeDistanceUpper:actual.distance,solverComplete:actual.complete,
  limitationReproduced:chord.length===2&&chord[0][1]===0&&chord[1][1]===0&&actual.lower>0},
 missedCrossBatchDuplicate:{batches:plan.batches.map(b=>b.scope),partial:plan.partial,limitationReproduced:!plan.batches.some(b=>b.scope.includes(0)&&b.scope.includes(2))},
 wholeTinyContourProtection:{retained:JSON.stringify(repaired.document.paths[0])===JSON.stringify(tiny),removedNodes:repaired.stats.removedNodes},
 wholeUnionRollback:{reason:budget.reason,retainedObjects:budget.document.paths.length,duplicateSubrepairAlsoRolledBack:budget.reason==='union-node-growth'&&budget.document.paths.length===3},
 aggregateQualityBudget:{accepted:quality.accepted,reason:quality.reason,identicalInput:true,limitationReproduced:quality.accepted===false}
},null,2));
