import {geometryCommands} from './eps-export.js';
export const pointDistance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export const lerpPoint=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
export function evaluateBezier(controls,t){let q=controls;while(q.length>1)q=q.slice(1).map((p,i)=>lerpPoint(q[i],p,t));return q[0];}
export function splitBezier(controls,t){let q=controls,left=[q[0]],right=[q.at(-1)];while(q.length>1){q=q.slice(1).map((p,i)=>lerpPoint(q[i],p,t));left.push(q[0]);right.unshift(q.at(-1));}return [left,right];}
export function bezierPart(controls,from,to){
 if(from>to)return bezierPart(controls,to,from).toReversed();
 let out=controls;if(to<1)out=splitBezier(out,to)[0];if(from>0)out=splitBezier(out,from/to)[1];return out.map(p=>[...p]);
}
export function cubicControls(p){if(p.length===4)return p;if(p.length===2)return [p[0],p[0],p[1],p[1]];return [p[0],lerpPoint(p[0],p[1],2/3),lerpPoint(p[2],p[1],2/3),p[2]];}
export const cubicValues=p=>cubicControls(p).flat();
export function nativeParts(path){
 if(path.kind==='image')return [];
 const parts=[];let part,pen;
 for(const [index,c] of geometryCommands(path).entries()){
  if(c[0]==='M'){part={start:c.slice(-2),segments:[],closed:false};parts.push(part);pen=part.start;continue;}
  if(!part)throw Error('Нативная кривая не имеет начала');
  const end=c[0]==='Z'?part.start:c.slice(-2),controls=[pen];
  if(c[0]==='Z'){
   part.closed=true;
   const roundoff=32*Number.EPSILON*Math.max(1,...pen.map(Math.abs),...end.map(Math.abs));
   if(pointDistance(pen,end)>roundoff)controls.push(end);
  }
  else for(let j=1;j<c.length;j+=2)controls.push(c.slice(j,j+2));
  if(controls.length>1)part.segments.push({controls,command:index,part:parts.length-1,ordinal:part.segments.length});pen=end;
 }
 for(const p of parts)if(p.segments.length&&pointDistance(p.start,p.segments.at(-1).controls.at(-1))===0)p.closed=true;
 return parts;
}
export function controlsBounds(controls){const b=[Infinity,Infinity,-Infinity,-Infinity];for(const p of controls){b[0]=Math.min(b[0],p[0]);b[1]=Math.min(b[1],p[1]);b[2]=Math.max(b[2],p[0]);b[3]=Math.max(b[3],p[1]);}return b;}
export function createNativeIndex(segments,epsilon=1e-8){
 const all=segments.flatMap(s=>s.controls),box=controlsBounds(all),side=Math.max(1,Math.ceil(Math.sqrt(segments.length))),dx=Math.max(1e-8,(box[2]-box[0])/side),dy=Math.max(1e-8,(box[3]-box[1])/side),cells=new Map(),large=[];
 const cell=p=>[Math.floor((p[0]-box[0])/dx),Math.floor((p[1]-box[1])/dy)];
 for(const s of segments){const b=controlsBounds(s.controls),lo=cell([b[0]-epsilon,b[1]-epsilon]),hi=cell([b[2]+epsilon,b[3]+epsilon]);s.bounds=b;
  if((hi[0]-lo[0]+1)*(hi[1]-lo[1]+1)>1024){large.push(s);continue;}
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++){const k=x+':'+y;if(!cells.has(k))cells.set(k,[]);cells.get(k).push(s);}
 }
 return point=>{const [x,y]=cell(point);return [...(cells.get(x+':'+y)||[]),...large].filter(s=>point[0]>=s.bounds[0]-epsilon&&point[0]<=s.bounds[2]+epsilon&&point[1]>=s.bounds[1]-epsilon&&point[1]<=s.bounds[3]+epsilon);};
}
// Independent, finite-chord-bounded sampling for verification only. Storage
// and Boolean output always retain the native controls.
export function sampleNativeParts(path,tolerance=.001,{maxPoints=500000}={}){
 let count=0;
 return nativeParts(path).map(part=>{
  const points=[[...part.start]];
  const sample=(p,depth=0)=>{
   const a=p[0],b=p.at(-1),dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
   const error=Math.max(...p.map(q=>{const t=length?Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dy)/length)):0;return pointDistance(q,lerpPoint(a,b,t));}));
   if(p.length===2||error<=tolerance||depth>=24){if(++count>maxPoints)throw Error('native-verification-budget');points.push([...b]);return;}
   const [left,right]=splitBezier(p,.5);sample(left,depth+1);sample(right,depth+1);
  };
  part.segments.forEach(s=>sample(s.controls));
  if(part.closed&&points.length>2&&pointDistance(points[0],points.at(-1))===0)points.pop();
  return {points,closed:part.closed};
 });
}
