import svgpath from './vendor/svgpath.mjs?v=0.2.0-alpha.49';

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
// Corel-style cubic handles operate on actual Bézier commands. A native
// polyline is promoted to a single unpainted SVG path only when it gains a
// C/Q segment; this prevents losing the curve on the next editor gesture.
const finitePoint=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<1e9);
function saveEditedCurve(path,commands,options){
  let source=path;
  if(!path.artwork&&commands.some(c=>c[0]==='C'||c[0]==='Q')){
    const original=read(path).commands;
    source={...path,artwork:'<path d="'+data(original)+'" fill="none" stroke="#007e79"/>',
      commands:original,offset:[0,0]};
  }
  const result=write(source,commands,options);
  if(path.nodeKinds)result.nodeKinds={...path.nodeKinds};
  return result;
}
function nodeContext(path,index){
  const node=curveNodes(path).find(n=>n.index===index);
  if(!node)throw Error('Выберите существующий узел');
  const readout=read(path),part=readout.parts[node.part],n=node.ordinal;
  return {node,part,n,incoming:n?part.segments[n-1]:part.closed?part.segments.at(-1):null,
    outgoing:part.segments[n]||null,commands:readout.commands};
}
const magnitude=v=>Math.hypot(v[0],v[1]);
const normalized=v=>{const n=magnitude(v);return n>1e-12?v.map(x=>x/n):null;};
const incomingControl=s=>s?.c[0]==='C'?s.c.slice(3,5):s?.c[0]==='Q'?s.c.slice(1,3):null;
const outgoingControl=s=>s?.c[0]==='C'?s.c.slice(1,3):s?.c[0]==='Q'?s.c.slice(1,3):null;
function getKind(ctx,path){
  const saved=path.nodeKinds?.[ctx.node.index];
  if(['cusp','smooth','symmetric'].includes(saved))return saved;
  const a=incomingControl(ctx.incoming),b=outgoingControl(ctx.outgoing);
  if(!a||!b)return 'cusp';
  const p=ctx.part.segments[ctx.n-1]?.c?end(ctx.incoming.c):ctx.part.start;
  const v=a.map((n,i)=>n-p[i]),w=b.map((n,i)=>n-p[i]),av=magnitude(v),bv=magnitude(w);
  if(av<1e-10||bv<1e-10||Math.abs(v[0]*w[1]-v[1]*w[0])>av*bv*1e-5||v[0]*w[0]+v[1]*w[1]>=0)return 'cusp';
  return Math.abs(av-bv)<=Math.max(av,bv)*1e-5?'symmetric':'smooth';
}
export function curveNodeType(path,index){return getKind(nodeContext(path,index),path);}
// Resolve all anchor types in one parse. The old UI called curveNodeType()
// for every visible anchor, reparsing the whole path O(n²) during dragging.
export function curveNodesTyped(path){
  const {parts}=read(path),shift=offset(path),nodes=[];
  parts.forEach((part,partIndex)=>{
    const points=[{index:part.startIndex,point:part.start,ordinal:0}];
    part.segments.forEach((s,i)=>{
      if(!(part.closed&&i===part.segments.length-1&&same(end(s.c),part.start)))
        points.push({index:s.index,point:end(s.c),ordinal:i+1});
    });
    for(const item of points){
      const n=item.ordinal,context={node:{index:item.index},part,n,
        incoming:n?part.segments[n-1]:part.closed?part.segments.at(-1):null,
        outgoing:part.segments[n]||null};
      nodes.push({index:item.index,part:partIndex,ordinal:n,
        point:item.point.map((v,i)=>v+shift[i]),type:getKind(context,path)});
    }
  });
  return nodes;
}

export function curveHandles(path,index){
  const ctx=nodeContext(path,index),shift=offset(path),answer={type:getKind(ctx,path),anchor:ctx.node.point,handles:[]};
  for(const [side,segment,control]of [['in',ctx.incoming,incomingControl(ctx.incoming)],
                                       ['out',ctx.outgoing,outgoingControl(ctx.outgoing)]]){
    if(segment)answer.handles.push({side,point:(control||ctx.node.point.map((v,i)=>v-shift[i])).map((v,i)=>v+shift[i]),
      convertible:segment.c[0]!=='C'});
  }
  return answer;
}
function cubicFor(s){return cubic(s);}
function editableContext(path,index){
  // Materialize an implicit Z closing line as an explicit L before turning
  // it into a cubic. Z remains in place and the contour stays closed.
  const base=nodeContext(path,index),commands=base.commands;
  if(base.incoming?.closing)commands.splice(base.incoming.index,0,['L',...base.part.start]);
  const virtual={...path,artwork:'<path/>',commands};
  const parts=read(virtual).parts,part=parts[base.node.part],n=base.n;
  return {commands,part,n,anchor:n?end(part.segments[n-1].c):part.start,
    incoming:n?part.segments[n-1]:part.closed?part.segments.at(-1):null,
    outgoing:part.segments[n]||null};
}
function assureCubic(ctx,side){
  const s=side==='in'?ctx.incoming:ctx.outgoing;
  if(!s)throw Error('На конце открытой кривой нет второй ручки');
  if(s.c[0]!=='C')ctx.commands[s.index]=cubicFor(s);
  return ctx.commands[s.index];
}
function saveKinds(path,next,index,type){
  // Command indices may shift when a closing Z is materialized. Re-associate
  // previously explicit node types by position/contour rather than by index.
  const oldNodes=curveNodes(path),newNodes=curveNodes(next),kinds={};
  for(const old of oldNodes){
    const kind=path.nodeKinds?.[old.index];if(!kind)continue;
    const match=newNodes.find(n=>n.part===old.part&&dist(n.point,old.point)<1e-8);
    if(match)kinds[match.index]=kind;
  }
  if(type){const old=oldNodes.find(n=>n.index===index);
    const node=newNodes.find(n=>n.part===old.part&&dist(n.point,old.point)<1e-8);
    if(node)kinds[node.index]=type;
  }
  next.nodeKinds=kinds;
  return next;
}
export function setCurveNodeType(path,index,type,options){
  if(!['cusp','smooth','symmetric'].includes(type))throw Error('Неизвестный тип узла');
  if(type==='cusp'){
    const result=structuredClone(path);return saveKinds(path,result,index,type);
  }
  const ctx=editableContext(path,index);
  if(!ctx.incoming||!ctx.outgoing)throw Error('Сглаженный или симметричный узел требует два смежных сегмента');
  const left=assureCubic(ctx,'in'),right=assureCubic(ctx,'out'),anchor=ctx.anchor;
  const inVec=left.slice(3,5).map((v,i)=>v-anchor[i]),outVec=right.slice(1,3).map((v,i)=>v-anchor[i]);
  const lenIn=magnitude(inVec),lenOut=magnitude(outVec);
  const direction=normalized(outVec)||normalized(inVec)?.map(x=>-x)||
    normalized(end(right).map((v,i)=>v-ctx.incoming.p0[i]))||[1,0];
  const leftLen=type==='symmetric'?(lenIn+lenOut)/2:lenIn;
  const rightLen=type==='symmetric'?leftLen:lenOut;
  for(let i=0;i<2;i++){left[3+i]=anchor[i]-direction[i]*leftLen;right[1+i]=anchor[i]+direction[i]*rightLen;}
  const result=saveEditedCurve(path,ctx.commands,options);
  return saveKinds(path,result,index,type);
}
export function moveCurveHandle(path,index,side,target,options){
  if(!['in','out'].includes(side)||!finitePoint(target))throw Error('Некорректная координата управляющей ручки');
  const type=curveNodeType(path,index),ctx=editableContext(path,index);
  const handle=assureCubic(ctx,side),shift=offset(path),local=target.map((v,i)=>v-shift[i]);
  const start=side==='in'?3:1,otherSide=side==='in'?'out':'in';
  for(let i=0;i<2;i++)handle[start+i]=local[i];
  if(type!=='cusp'&&ctx.incoming&&ctx.outgoing){
    const other=assureCubic(ctx,otherSide),o=otherSide==='in'?3:1;
    const vec=local.map((v,i)=>v-ctx.anchor[i]),unit=normalized(vec);
    const old=other.slice(o,o+2).map((v,i)=>v-ctx.anchor[i]);
    const length=type==='symmetric'?magnitude(vec):magnitude(old);
    for(let i=0;i<2;i++)other[o+i]=ctx.anchor[i]-(unit?.[i]||0)*length;
  }
  const result=saveEditedCurve(path,ctx.commands,options);
  return saveKinds(path,result,index,type);
}
export function setCurveSegmentType(path,index,type,options){
  if(!['line','curve'].includes(type))throw Error('Неизвестный тип сегмента');
  const ctx=editableContext(path,index),s=ctx.outgoing||ctx.incoming;
  if(!s)throw Error('Не найден смежный сегмент');
  ctx.commands[s.index]=type==='line'?['L',...end(s.c)]:cubicFor(s);
  return saveKinds(path,saveEditedCurve(path,ctx.commands,options),index);
}
export function reverseCurveDirection(path,options){
  const {parts}=read(path),commands=[];
  for(const p of parts){
    const segments=p.segments;
    if(!segments.length){commands.push(['M',...p.start]);continue;}
    // For closed paths, the last segment (possibly an implicit Z edge)
    // returns to M: reversing that edge first preserves M as start.
    const start=p.closed?p.start:end(segments.at(-1).c);
    commands.push(['M',...start]);
    for(const s of [...segments].reverse()){
      const c=s.c;
      commands.push(c[0]==='C'?['C',...c.slice(3,5),...c.slice(1,3),...s.p0]:
        c[0]==='Q'?['Q',...c.slice(1,3),...s.p0]:['L',...s.p0]);
    }
    if(p.closed)commands.push(['Z']);
  }
  return saveKinds(path,saveEditedCurve(path,commands,options),null);
}
export function closeCurveAtNode(path,index,options){
  const ctx=nodeContext(path,index);
  if(ctx.part.closed)throw Error('Этот контур уже замкнут');
  const all=read(path).parts,commands=[];
  all.forEach((p,i)=>{
    commands.push(['M',...p.start],...p.segments.map(s=>s.c));
    if(p.closed||i===ctx.node.part)commands.push(['Z']);
  });
  return saveKinds(path,saveEditedCurve(path,commands,options),null);
}
export function breakCurveAtNode(path,index,options){
  const ctx=nodeContext(path,index),all=read(path).parts,commands=[];
  for(let i=0;i<all.length;i++){
    const p=all[i];
    if(i!==ctx.node.part){commands.push(['M',...p.start],...p.segments.map(s=>s.c),...(p.closed?[['Z']]:[]));continue;}
    if(p.closed){
      const seq=p.segments;
      const n=ctx.n;const count=seq.length;
      // Rotate contour to selected anchor, retaining a closing explicit
      // segment but dropping the Z operator.
      const start=n?end(seq[n-1].c):p.start;
      commands.push(['M',...start]);
      for(let k=0;k<count;k++)commands.push(seq[(n+k)%count].c);
    }else{
      if(ctx.n===0||ctx.n===p.segments.length)throw Error('Выберите внутренний узел для разъединения');
      const cut=end(p.segments[ctx.n-1].c);
      commands.push(['M',...p.start],...p.segments.slice(0,ctx.n).map(s=>s.c),
        ['M',...cut],...p.segments.slice(ctx.n).map(s=>s.c));
    }
  }
  return saveEditedCurve(path,commands,options);
}
