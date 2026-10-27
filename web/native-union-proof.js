import {geometryCommands} from './eps-export.js';
import {nativeParts,bezierPart,pointDistance,createNativeIndex} from './native-bezier.js';
const EPS=2e-8;
export function commandsFromNativeRings(rings){
 const commands=[];
 for(const ring of rings){
  if(!ring.length)throw Error('empty-native-ring');
  const start=ring[0].controls[0];commands.push(['M',...start]);
  ring.forEach((p,i)=>{const c=p.controls;if(c.length===2&&i===ring.length-1&&pointDistance(c.at(-1),start)<=EPS)return;commands.push([({2:'L',3:'Q',4:'C'})[c.length],...c.slice(1).flat()]);});
  commands.push(['Z']);
 }
 return commands;
}
// Reconstruct from source data, never trust an editable metadata flag. This
// verifies provenance and necessary cuts, not the Boolean fill operation.
export function verifyNativeUnionProof(path,availableInputs){
 try{
  const proof=path.nativeUnionProof;
  if(proof?.kind!=='native-bezier-union-v1'||!Array.isArray(proof.input)||!proof.input.length)return false;
  if(availableInputs&&proof.input.some(input=>!availableInputs.has(JSON.stringify(input))))return false;
  const sources=proof.input.flatMap(commands=>nativeParts({artwork:'<path/>',commands,offset:[0,0]}).flatMap(p=>p.segments));
  const anchors=createNativeIndex(sources.map(s=>({controls:[s.controls[0],s.controls.at(-1)]})),EPS);
  let junctions=0;
  const rings=proof.rings.map(r=>r.map(p=>{
   if(p.spans){
    if(!Array.isArray(p.spans)||!p.spans.length)throw Error('empty-line-provenance');
    const pieces=p.spans.map(s=>{if(!Number.isInteger(s.source)||sources[s.source]?.controls.length!==2||![s.from,s.to].every(t=>Number.isFinite(t)&&t>=0&&t<=1))throw Error('invalid-line-provenance');return bezierPart(sources[s.source].controls,s.from,s.to);});
    const a=pieces[0][0],b=pieces.at(-1).at(-1),dx=b[0]-a[0],dy=b[1]-a[1],len=dx*dx+dy*dy;
    if(!len)throw Error('zero-line');let covered=0;
    for(const c of pieces){const t=c.map(q=>{if(Math.abs(dx*(q[1]-a[1])-dy*(q[0]-a[0]))/Math.sqrt(len)>EPS)throw Error('bent-line');return ((q[0]-a[0])*dx+(q[1]-a[1])*dy)/len;});if(t[0]>covered+1e-10||t[1]<=t[0])throw Error('uncovered-line');covered=Math.max(covered,t[1]);}
    if(covered<1-1e-10)throw Error('uncovered-line');return {source:null,controls:[a,b]};
   }
   if(!Number.isInteger(p.source)||!sources[p.source]||!Number.isFinite(p.from)||!Number.isFinite(p.to)||Math.min(p.from,p.to)<0||Math.max(p.from,p.to)>1||Math.abs(p.from-p.to)<1e-13)throw Error('invalid-native-interval');
   return {...p,controls:bezierPart(sources[p.source].controls,p.from,p.to)};
  }));
  for(const ring of rings)for(let i=0;i<ring.length;i++){
   const p=ring[i],prev=ring[(i+ring.length-1)%ring.length],a=p.controls[0];
   if(pointDistance(a,prev.controls.at(-1))>EPS)return false;
   if(prev.source===p.source&&Math.abs(prev.to-p.from)<1e-10)return false;
   if(!anchors(a).some(s=>s.controls.some(q=>pointDistance(a,q)<=EPS)))junctions++;
  }
  return junctions===proof.newJunctions&&JSON.stringify(commandsFromNativeRings(rings))===JSON.stringify(geometryCommands(path));
 }catch{return false;}
}
