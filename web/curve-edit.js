import svgpath from './vendor/svgpath.mjs';

const end=c=>c.slice(-2),same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const offset=p=>p.offset||[0,0];
const data=commands=>commands.map(c=>c.join(' ')).join(' ');
function read(path){
  if(path.kind==='image')throw Error('Изображение не содержит редактируемых узлов');
  const commands=path.artwork?structuredClone(path.commands):
    path.points.map((p,i)=>[i?'L':'M',...p]).concat(path.closed?[['Z']]:[]);
  const parts=[];let part,pen;
  commands.forEach((c,index)=>{
    if(c[0]==='M'){
      part={start:end(c),startIndex:index,segments:[],closed:false};parts.push(part);pen=part.start;
    }else if(c[0]==='Z'){
      if(!part)throw Error('Некорректное замыкание');part.closed=true;
      if(!same(pen,part.start))part.segments.push({p0:pen,c:['L',...part.start],index,closing:true});
      pen=part.start;
    }else{
      if(!part||!['L','C','Q'].includes(c[0]))throw Error('Неподдерживаемая команда кривой');
      part.segments.push({p0:pen,c,index});pen=end(c);
    }
  });
  return {commands,parts};
}
export function curveNodes(path){
  const {parts}=read(path),shift=offset(path),nodes=[];
  parts.forEach((part,partIndex)=>{
    const push=(point,index,ordinal)=>nodes.push({index,part:partIndex,ordinal,point:point.map((v,i)=>v+shift[i])});
    push(part.start,part.startIndex,0);
    part.segments.forEach((s,i)=>{
      if(part.closed&&i===part.segments.length-1&&same(end(s.c),part.start))return;
      push(end(s.c),s.index,i+1);
    });
  });return nodes;
}

// Preserve original SVG wrappers, paint, clipping and transforms. The model's
// commands are in mm; write them back through the inverse artwork transform.
// Unsupported multi-shape artwork is refused rather than silently discarded.
function replaceArtwork(path,commands,Parser){
  if(!Parser)throw Error('Редактору SVG требуется DOMParser');
  const root=new Parser().parseFromString('<svg xmlns="http://www.w3.org/2000/svg">'+path.artwork+'</svg>','image/svg+xml').documentElement;
  const shapes=Array.from(root.getElementsByTagName('*')).filter(e=>
    ['path','line','rect','circle','ellipse','polyline','polygon','image','use'].includes(e.localName));
  if(shapes.length!==1||['image','use'].includes(shapes[0].localName))throw Error('Это оформление нельзя редактировать без потери свойств');
  const leaf=shapes[0],chain=[];let element=leaf;
  while(element&&element!==root){chain.unshift(element.getAttribute('transform')||'');element=element.parentNode;}
  const basisPath=svgpath('M0 0L1 0L0 1').transform(chain.join(' '));
  basisPath.iterate(()=>{});
  const basis=basisPath.segments;
  const [x,y]=basis[0].slice(1),a=basis[1][1]-x,b=basis[1][2]-y,c=basis[2][1]-x,d=basis[2][2]-y;
  const determinant=a*d-b*c;
  if(!Number.isFinite(determinant)||Math.abs(determinant)<1e-20)throw Error('Вырожденное преобразование SVG');
  const inverse=[d/determinant,-b/determinant,-c/determinant,a/determinant,(c*y-d*x)/determinant,(b*x-a*y)/determinant];
  const local=svgpath(data(commands)).matrix(inverse).toString();
  const replacement=root.ownerDocument.createElementNS('http://www.w3.org/2000/svg','path');
  const geometry=new Set(['d','x','y','x1','y1','x2','y2','width','height','cx','cy','r','rx','ry','points']);
  for(const attr of Array.from(leaf.attributes))if(!geometry.has(attr.name))replacement.setAttribute(attr.name,attr.value);
  replacement.setAttribute('d',local);leaf.parentNode.replaceChild(replacement,leaf);
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const serialize=e=>e.nodeType===1?'<'+e.nodeName+Array.from(e.attributes).map(a=>' '+a.name+'="'+escape(a.value)+'"').join('')+'>'+Array.from(e.childNodes).map(serialize).join('')+'</'+e.nodeName+'>':e.nodeType===3?escape(e.nodeValue):'';
  return Array.from(root.childNodes).map(serialize).join('');
}
function write(path,commands,{Parser=globalThis.DOMParser}={}){
  const out=structuredClone(path);
  if(path.artwork){out.artwork=replaceArtwork(path,commands,Parser);out.commands=commands;}
  out.points=commands.filter(c=>c[0]!=='Z').map(end);out.closed=commands.at(-1)?.[0]==='Z';
  if(!path.artwork&&out.closed&&out.points.length>2&&same(out.points[0],out.points.at(-1)))out.points.pop();
  return out;
}
export function moveCurveNode(path,index,target,options){
  if(!Array.isArray(target)||target.length!==2||target.some(v=>!Number.isFinite(v)||Math.abs(v)>1e9))throw Error('Некорректная координата узла');
  const node=curveNodes(path).find(n=>n.index===index);if(!node)throw Error('Узел не найден');
  const {commands,parts}=read(path),part=parts[node.part],n=node.ordinal;
  const delta=target.map((v,i)=>v-node.point[i]),changed=new Set();
  const shift=(commandIndex,start)=>{
    const key=commandIndex+':'+start;if(changed.has(key))return;changed.add(key);
    commands[commandIndex][start]+=delta[0];commands[commandIndex][start+1]+=delta[1];
  };
  shift(index,commands[index].length-2);
  const incoming=n?part.segments[n-1]:part.closed?part.segments.at(-1):null;
  const outgoing=part.segments[n];
  if(n===0&&incoming&&!incoming.closing&&same(end(incoming.c),part.start))shift(incoming.index,incoming.c.length-2);
  if(incoming&&!incoming.closing){if(incoming.c[0]==='C')shift(incoming.index,3);if(incoming.c[0]==='Q')shift(incoming.index,1);}
  if(outgoing&&!outgoing.closing&&['C','Q'].includes(outgoing.c[0]))shift(outgoing.index,1);
  return write(path,commands,options);
}
function splitSegment(s,t){
  const c=s.c;
  if(c[0]==='L'){const m=mix(s.p0,end(c),t);return [['L',...m],['L',...end(c)]];}
  const a=mix(s.p0,c.slice(1,3),t);
  if(c[0]==='Q'){const b=mix(c.slice(1,3),end(c),t),m=mix(a,b,t);return [['Q',...a,...m],['Q',...b,...end(c)]];}
  const b=mix(c.slice(1,3),c.slice(3,5),t),cc=mix(c.slice(3,5),end(c),t),d=mix(a,b,t),e=mix(b,cc,t),m=mix(d,e,t);
  return [['C',...a,...d,...m],['C',...e,...cc,...end(c)]];
}
function at(s,t){return end(splitSegment(s,t)[0]);}
export function nearestCurveSegment(path,point){
  const {parts}=read(path),shift=offset(path),local=point.map((v,i)=>v-shift[i]);let best=null;
  for(const part of parts)for(const s of part.segments){
    let sample=0,error=Infinity;
    for(let i=0;i<=32;i++){const e=dist(at(s,i/32),local);if(e<error){error=e;sample=i/32;}}
    let lo=Math.max(0,sample-1/32),hi=Math.min(1,sample+1/32);
    for(let i=0;i<36;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(dist(at(s,a),local)<dist(at(s,b),local))hi=b;else lo=a;}
    const t=(lo+hi)/2,p=at(s,t),distance=dist(p,local);
    if(!best||distance<best.distance)best={index:s.index,t,point:p.map((v,i)=>v+shift[i]),distance};
  }return best;
}
export function addCurveNode(path,index,t,options){
  if(!Number.isFinite(t)||t<=1e-6||t>=1-1e-6)throw Error('Добавляйте точку между существующими узлами');
  const {commands,parts}=read(path),segment=parts.flatMap(p=>p.segments).find(s=>s.index===index);
  if(!segment)throw Error('Сегмент не найден');
  const pair=splitSegment(segment,t);
  if(segment.closing)commands.splice(index,0,pair[0]);else commands.splice(index,1,...pair);
  return write(path,commands,options);
}
function cubic(s){
  const endPoint=end(s.c);
  if(s.c[0]==='C')return s.c;
  if(s.c[0]==='Q')return ['C',...mix(s.p0,s.c.slice(1,3),2/3),...mix(endPoint,s.c.slice(1,3),2/3),...endPoint];
  return ['C',...mix(s.p0,endPoint,1/3),...mix(s.p0,endPoint,2/3),...endPoint];
}
function mergeSegments(incoming,outgoing){
  if(incoming.c[0]==='L'&&outgoing.c[0]==='L')return ['L',...end(outgoing.c)];
  const left=cubic(incoming),right=cubic(outgoing),join=end(left);
  const a=dist(join,left.slice(3,5)),b=dist(right.slice(1,3),join),t=a/(a+b);
  if(t>1e-6&&t<1-1e-6){
    const p0=incoming.p0,p3=end(right);
    const p1=p0.map((v,i)=>v+(left[i+1]-v)/t);
    const p2=p3.map((v,i)=>v+(right[i+3]-v)/(1-t));
    const candidate=['C',...p1,...p2,...p3],pair=splitSegment({p0,c:candidate},t);
    const scale=Math.max(1,...[...left,...right].slice(1).filter(Number.isFinite).map(Math.abs));
    const equals=(u,v)=>u.slice(1).every((x,i)=>Math.abs(x-v[i+1])<=scale*1e-10);
    if(equals(pair[0],left)&&equals(pair[1],right))return candidate;
  }
  return ['C',...left.slice(1,3),...right.slice(3,5),...end(right)];
}
export function deleteCurveNode(path,index,options){
  const node=curveNodes(path).find(n=>n.index===index);if(!node)throw Error('Узел не найден');
  const {parts}=read(path),part=parts[node.part],n=node.ordinal;
  const count=part.closed?part.segments.length:part.segments.length+1;
  if(count<=2)throw Error('В контуре должны остаться хотя бы два узла');
  const segments=part.segments;
  if(!part.closed&&n===0)segments.shift();
  else if(!part.closed&&n===count-1)segments.pop();
  else{
    const incoming=segments[(n-1+segments.length)%segments.length],outgoing=segments[n];
    const merged={p0:incoming.p0,c:mergeSegments(incoming,outgoing)};
    if(n===0){segments.shift();segments[segments.length-1]=merged;}
    else segments.splice(n-1,2,merged);
  }
  part.start=segments[0].p0;
  const commands=parts.flatMap(p=>[['M',...p.start],...p.segments.map(s=>s.c),...(p.closed?[['Z']]:[])]);
  return write(path,commands,options);
}
