import {curveNodesTyped} from './curve-edit.js?v=0.2.0-alpha.72';

// A command-buffer transaction for one compound vector. During manual mode the
// full document, original SVG artwork and EPS geometry are immutable. All
// interactive edits touch at most the two incident commands in this buffer.
// Materialization/serialization is explicitly postponed until editor exit.
const endpoint=c=>c.slice(-2);
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*t);
const finite=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<1e9);
const cp=c=>c.slice();
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1];
// Adding a drag displacement and its inverse changes the last floating
// bits. Ignore sub-nanometre roundoff in display/dirty comparisons; the
// stored native command numbers are never rounded or quantized here.
const equivalentCommands=(a,b)=>Boolean(a&&b&&a[0]===b[0]&&a.length===b.length&&
  a.slice(1).every((v,i)=>Math.abs(v-b[i+1])<=
    Math.max(1e-10,16*Number.EPSILON*Math.max(Math.abs(v),Math.abs(b[i+1])))));
function indexCommands(commands){
  const parts=[],byIndex=new Map();let part=null;
  for(let index=0;index<commands.length;index++){
    const c=commands[index];
    if(c[0]==='M'){part={start:index,segments:[],closed:false};parts.push(part);}
    else if(c[0]==='Z'){if(part)part.closed=true;}
    else if(part)part.segments.push(index);
  }
  parts.forEach((p,partId)=>{
    byIndex.set(p.start,{part:partId,ordinal:0});
    p.segments.forEach((index,i)=>{
      const isClose=p.closed&&i===p.segments.length-1&&same(endpoint(commands[index]),endpoint(commands[p.start]));
      if(!isClose)byIndex.set(index,{part:partId,ordinal:i+1});
    });
  });
  return {parts,byIndex};
}
const shifted=(a,off)=>[a[0]+off[0],a[1]+off[1]];
const svgSegment=controls=>{
  if(!controls||controls.length<2)return '';
  const pts=controls.slice(1).map(p=>p.join(' ')).join(' ');
  return 'M'+controls[0].join(' ')+(controls.length===4?'C':controls.length===3?'Q':'L')+pts;
};
const split=(points,t)=>{
  let work=points.map(p=>p.slice()),left=[work[0]],right=[work.at(-1)];
  while(work.length>1){
    work=work.slice(1).map((p,i)=>lerp(work[i],p,t));
    left.push(work[0]);right.unshift(work.at(-1));
  }
  return [left,right];
};
const toCommand=c=>[({2:'L',3:'Q',4:'C'})[c.length],...c.slice(1).flat()];
const cubic=(controls)=>{
  if(controls.length===4)return controls;
  const a=controls[0],z=controls.at(-1);
  if(controls.length===3){
    const q=controls[1];return [a,lerp(a,q,2/3),lerp(z,q,2/3),z];
  }
  return [a,lerp(a,z,1/3),lerp(a,z,2/3),z];
};
export function createDeferredCurveEditor(path){
  if(path.kind==='image')throw Error('Нельзя редактировать растровый объект');
  const offset=path.offset||[0,0];
  // One O(N) copy at entry per path, never on mousemove or mouseup.
  let commands=(path.artwork?path.commands:
    path.points.map((p,i)=>[i?'L':'M',...p]).concat(path.closed?[['Z']]:[])).map(cp);
  const initialCommands=commands.map(cp);
  let {parts,byIndex}=indexCommands(commands);
  let segmentPart=new Map(),partByStart=new Map();
  function updatePartIndex(){
    ({parts,byIndex}=indexCommands(commands));
    segmentPart=new Map();partByStart=new Map();
    parts.forEach(p=>{
      partByStart.set(p.start,p);
      p.segments.forEach((index,ordinal)=>
        segmentPart.set(index,{part:p,ordinal}));
    });
  }
  updatePartIndex();
  let nodes=curveNodesTyped(path).map(n=>({...n,point:[...n.point]}));
  let nodeMap=new Map(nodes.map(n=>[n.index,n]));
  let kinds={...(path.nodeKinds||{})},dirty=false;
  const touched=new Set(),undo=[],redo=[];
  const command=i=>commands[i];
  const anchor=i=>{const c=command(i);return c?shifted(endpoint(c),offset):null;};
  function segment(index){
    const c=command(index);if(!c||!['L','Q','C'].includes(c[0]))return null;
    const metadata=segmentPart.get(index);if(!metadata)return null;
    const {part:item,ordinal}=metadata,prev=ordinal?item.segments[ordinal-1]:item.start;
    return {index,start:prev,controls:[endpoint(command(prev)),...Array.from({length:(c.length-1)/2},(_,j)=>c.slice(1+j*2,3+j*2))].map(p=>shifted(p,offset))};
  }
  function getNode(index){return nodeMap.get(index)||null;}
  function rebuildNodeIndex(){
    updatePartIndex();
    const pathView={kind:'vector',artwork:'<path/>',commands,offset,
      nodeKinds:kinds};
    nodes=curveNodesTyped(pathView).map(n=>({...n,point:[...n.point]}));
    nodeMap=new Map(nodes.map(n=>[n.index,n]));
    rebuildSegmentIndex();
  }
  function incident(index){
    const entry=byIndex.get(index);if(!entry)return null;
    const p=parts[entry.part],n=entry.ordinal;
    const last=p.segments.at(-1),start=endpoint(commands[p.start]);
    // An implicit Z edge is not the last actual Bézier command. Moving its
    // start must not silently bend the unrelated last real segment.
    const seam=p.closed&&last!==undefined&&same(endpoint(commands[last]),start);
    return {inbound:n?p.segments[n-1]:p.closed&&seam?last:null,
      outbound:p.segments[n]??null,part:p};
  }
  function viewPatch(index,side=null){
    const node=getNode(index),neighbour=incident(index);
    if(!node||!neighbour)return null;
    const a=neighbour.inbound?segment(neighbour.inbound)?.controls:null,
      b=neighbour.outbound?segment(neighbour.outbound)?.controls:null;
    return {point:[...node.point],incoming:a||null,outgoing:b||null,
      handle:side,type:kinds[index]||node.type||'cusp',commandIndex:index};
  }
  function restore(frame){
    for(const [i,c] of frame.entries)commands[i]=cp(c);
    for(const [i,k] of frame.kindValues){
      if(k===undefined)delete kinds[i];else kinds[i]=k;
    }
    for(const [i,p] of frame.positions){
      const node=nodeMap.get(i);if(node)node.point=[...p];
    }
    for(const [i,type] of frame.nodeTypes){
      const node=nodeMap.get(i);if(node)node.type=type;
    }
    dirty=frame.dirty;
    for(const i of frame.touched)touched.add(i);
  }
  function capture(ids,additionalNodeIds=[]){
    const entries=new Map(ids.filter(i=>i!==null&&i!==undefined&&commands[i])
      .map(i=>[i,cp(commands[i])]));
    const positions=new Map(),nodeTypes=new Map(),kindValues=new Map();
    // Per gesture: at most 1-3 SVG commands and directly affected anchors.
    // Do not clone a full 7k-node array or nodeKinds map for each Undo step.
    const watched=new Set([...entries.keys(),...additionalNodeIds]);
    for(const i of watched){
      const node=nodeMap.get(i);
      if(node){positions.set(i,[...node.point]);nodeTypes.set(i,node.type);}
      kindValues.set(i,kinds[i]);
    }
    return {entries,positions,nodeTypes,kindValues,dirty,touched:[...ids]};
  }
  function perform(ids,operation,extraIds=[]){
    const prior=capture(ids,extraIds);operation();
    const changed=ids.some(i=>i!==null&&
      JSON.stringify(prior.entries.get(i))!==JSON.stringify(commands[i]))||
      [...prior.kindValues].some(([i,k])=>kinds[i]!==k);
    if(!changed)return [];
    undo.push({before:prior,after:capture(ids,extraIds)});
    redo.length=0;dirty=true;
    for(const i of ids)if(i!==null&&i!==undefined)touched.add(i);
    updateIndexedSegments(ids);
    return ids;
  }
  function moveAnchor(index,target){
    if(!finite(target))throw Error('Недопустимая координата узла');
    const n=getNode(index),around=incident(index);
    if(!n||!around)throw Error('Не найден узел в локальной транзакции');
    const delta=target.map((v,i)=>v-n.point[i]);
    if(Math.hypot(...delta)<1e-10)return [];
    const ids=[index,around.inbound,around.outbound].filter((x,i,a)=>x!==null&&a.indexOf(x)===i);
    return perform(ids,()=>{
      const shiftedKeys=new Set();
      const change=(id,at)=>{
        if(id===null||!command(id))return;
        const key=id+':'+at;if(shiftedKeys.has(key))return;shiftedKeys.add(key);
        const c=command(id);c[at]+=delta[0];c[at+1]+=delta[1];
      };
      change(index,command(index).length-2);
      const incoming=around.inbound===null?null:command(around.inbound);
      const outgoing=around.outbound===null?null:command(around.outbound);
      if(index===around.part.start&&incoming&&same(endpoint(incoming),n.point.map((v,i)=>v-offset[i])))
        change(around.inbound,incoming.length-2);
      if(incoming?.[0]==='C')change(around.inbound,3);
      if(incoming?.[0]==='Q')change(around.inbound,1);
      if(outgoing?.[0]==='C'||outgoing?.[0]==='Q')change(around.outbound,1);
      n.point=[...target];
    });
  }
  function moveHandle(index,side,target){
    if(!['in','out'].includes(side)||!finite(target))throw Error('Некорректная ручка');
    const n=getNode(index),around=incident(index);
    if(!n||!around)throw Error('Не найден узел для правки ручки');
    const focus=side==='in'?around.inbound:around.outbound;
    const opposing=side==='in'?around.outbound:around.inbound;
    if(focus===null)throw Error('Узловая ручка отсутствует');
    const ids=[focus,opposing].filter((x,i,a)=>x!==null&&a.indexOf(x)===i);
    return perform(ids,()=>{
      const ensure=id=>{
        const seg=segment(id);if(!seg)throw Error('Не найден сегмент');
        if(command(id)[0]!=='C')commands[id]=toCommand(cubic(seg.controls.map(p=>p.map((v,i)=>v-offset[i]))));
        return commands[id];
      };
      const cmd=ensure(focus),loc=target.map((v,i)=>v-offset[i]);
      const at=side==='in'?3:1;cmd[at]=loc[0];cmd[at+1]=loc[1];
      const kind=kinds[index]||n.type||'cusp';
      if(kind!=='cusp'&&opposing!==null){
        const other=ensure(opposing),atOther=side==='in'?1:3;
        const v=target.map((w,i)=>w-n.point[i]),mag=Math.hypot(...v);
        const old=other.slice(atOther,atOther+2).map((w,i)=>w+offset[i]);
        const length=kind==='symmetric'?mag:distance(old,n.point);
        if(mag>1e-12){
          other[atOther]=n.point[0]-offset[0]-v[0]/mag*length;
          other[atOther+1]=n.point[1]-offset[1]-v[1]/mag*length;
        }
      }
    });
  }
  function setKind(index,kind){
    if(!['cusp','smooth','symmetric'].includes(kind))throw Error('Недопустимый тип узла');
    const around=incident(index),node=getNode(index);
    if(!around||!node)throw Error('Не найден узел');
    const ids=[around.inbound,around.outbound].filter(x=>x!==null);
    if(kind!=='cusp'&&ids.length<2)throw Error('Сглаживание требует два смежных сегмента');
    return perform(ids,()=>{
      if(kind!=='cusp'){
        const ensure=id=>{
          const data=segment(id);
          if(command(id)[0]!=='C')commands[id]=toCommand(cubic(
            data.controls.map(p=>p.map((v,i)=>v-offset[i]))));
          return command(id);
        };
        const left=ensure(around.inbound),right=ensure(around.outbound);
        const at=node.point.map((v,i)=>v-offset[i]);
        const vin=[left[3]-at[0],left[4]-at[1]],
          vout=[right[1]-at[0],right[2]-at[1]];
        const m1=Math.hypot(...vin),m2=Math.hypot(...vout);
        const dir=m2>1e-12?vout.map(v=>v/m2):
          m1>1e-12?vin.map(v=>-v/m1):[1,0];
        const lin=kind==='symmetric'?(m1+m2)/2:m1,
          lout=kind==='symmetric'?lin:m2;
        left[3]=at[0]-dir[0]*lin;left[4]=at[1]-dir[1]*lin;
        right[1]=at[0]+dir[0]*lout;right[2]=at[1]+dir[1]*lout;
      }
      kinds[index]=kind;node.type=kind;
    },[index]);
  }
  function affectedSVG(indices=null){
    if(!dirty)return [];
    const paths=[];
    for(const i of indices??touched){
      const part=partByStart.get(i);
      if(part?.closed&&part.segments.length){
        // A newly closed contour needs a real visible closing segment in
        // draft mode, but the 7,545-curve original stays untouched until exit.
        const endIndex=part.segments.at(-1),start=anchor(i),end=anchor(endIndex),
          priorZ=initialCommands[endIndex+1]?.[0]==='Z',
          changedStart=JSON.stringify(commands[i])!==JSON.stringify(initialCommands[i]),
          changedEnd=JSON.stringify(commands[endIndex])!==JSON.stringify(initialCommands[endIndex]);
        if(start&&end&&!same(start,end)&&(!priorZ||changedStart||changedEnd))
          paths.push({key:'z'+i,d:'M'+end.join(' ')+'L'+start.join(' ')});
      }
      if(equivalentCommands(commands[i],initialCommands[i]))continue;
      const c=segment(i);
      if(c)paths.push({key:i,d:svgSegment(c.controls)});
    }
    return paths;
  }
  function nodePosition(index){return getNode(index)?.point?.slice()||null;}
  // Index conservative control-polygon bounding boxes once on entry.
  // Dragging one node updates at most its incident control hulls.
  let segmentCell=1,segmentBins=new Map(),segmentMembership=new Map(),
    globalSegments=new Set(),lastNearestCandidates=0;
  const binKey=(x,y)=>x+':'+y;
  function removeIndexedSegment(index){
    for(const key of segmentMembership.get(index)||[]){
      const group=segmentBins.get(key);
      if(group){group.delete(index);if(!group.size)segmentBins.delete(key);}
    }
    segmentMembership.delete(index);globalSegments.delete(index);
  }
  function indexSegment(index){
    removeIndexedSegment(index);
    const points=segment(index)?.controls;
    if(!points)return;
    const x0=Math.min(...points.map(p=>p[0])),x1=Math.max(...points.map(p=>p[0])),
      y0=Math.min(...points.map(p=>p[1])),y1=Math.max(...points.map(p=>p[1]));
    const xa=Math.floor(x0/segmentCell),xb=Math.floor(x1/segmentCell),
      ya=Math.floor(y0/segmentCell),yb=Math.floor(y1/segmentCell),
      count=(xb-xa+1)*(yb-ya+1);
    if(!Number.isFinite(count)||count>64){globalSegments.add(index);return;}
    const keys=[];
    for(let x=xa;x<=xb;x++)for(let y=ya;y<=yb;y++){
      const key=binKey(x,y);
      if(!segmentBins.has(key))segmentBins.set(key,new Set());
      segmentBins.get(key).add(index);keys.push(key);
    }
    segmentMembership.set(index,keys);
  }
  function rebuildSegmentIndex(){
    segmentBins=new Map();segmentMembership=new Map();globalSegments=new Set();
    let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    for(const node of nodes){
      const p=node.point;
      x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);
      x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);
    }
    const area=Math.max(.01,(x1-x0)*(y1-y0));
    segmentCell=Math.max(.05,Math.sqrt(area/Math.max(1,segmentPart.size))*2.5);
    for(const index of segmentPart.keys())indexSegment(index);
  }
  function updateIndexedSegments(ids){
    for(const id of new Set(ids))
      if(id!==null&&id!==undefined&&segmentPart.has(id))
        indexSegment(id);
  }
  function localSegmentCandidates(point,radius){
    if(!Number.isFinite(radius))return [...segmentPart.keys()];
    const xa=Math.floor((point[0]-radius)/segmentCell),
      xb=Math.floor((point[0]+radius)/segmentCell),
      ya=Math.floor((point[1]-radius)/segmentCell),
      yb=Math.floor((point[1]+radius)/segmentCell),
      candidates=new Set(globalSegments),count=(xb-xa+1)*(yb-ya+1);
    if(!Number.isFinite(count)||count>15000)return [...segmentPart.keys()];
    for(let x=xa;x<=xb;x++)for(let y=ya;y<=yb;y++)
      for(const index of segmentBins.get(binKey(x,y))||[])candidates.add(index);
    return [...candidates];
  }
  rebuildSegmentIndex();
  // High-zoom view-dependent Bézier geometry. Never parse or serialize the
  // original compound artwork; query indexed local control hulls and make
  // at most maxSegments small SVG subpaths. Safe to call on wheel / pan.
  function visibleSegmentSVG(center,radius,{limit=600}={}){
    if(!finite(center)||!Number.isFinite(radius)||radius<=0)return [];
    const found=[];
    const xmin=center[0]-radius,xmax=center[0]+radius,
      ymin=center[1]-radius,ymax=center[1]+radius;
    for(const index of localSegmentCandidates(center,radius)){
      const part=segment(index);
      if(!part)continue;
      const pts=part.controls;
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(const p of pts){
        x0=Math.min(x0,p[0]);y0=Math.min(y0,p[1]);
        x1=Math.max(x1,p[0]);y1=Math.max(y1,p[1]);
      }
      if(x1<xmin||x0>xmax||y1<ymin||y0>ymax)continue;
      const dx=Math.max(x0-center[0],0,center[0]-x1),
        dy=Math.max(y0-center[1],0,center[1]-y1);
      found.push({index,proximity:dx*dx+dy*dy,
        d:svgSegment(pts)});
    }
    found.sort((a,b)=>a.proximity-b.proximity||a.index-b.index);
    return found.slice(0,Math.max(1,Math.min(1000,limit))).map(({index,d})=>({index,d}));
  }
  function segmentIndexStats(){return {segments:segmentPart.size,bins:segmentBins.size,
    global:globalSegments.size,lastNearestCandidates};}
  function nearestSegment(point,threshold=Infinity){
    if(!finite(point))return null;
    let best=null;
    const world=point.map((v,i)=>v-offset[i]);
    const square=threshold*threshold;
    const candidates=localSegmentCandidates(point,threshold);
    lastNearestCandidates=candidates.length;
    for(const index of candidates){
      const data=segment(index);if(!data)continue;
      const pts=data.controls.map(p=>p.map((v,i)=>v-offset[i]));
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(const q of pts){x0=Math.min(x0,q[0]);y0=Math.min(y0,q[1]);
        x1=Math.max(x1,q[0]);y1=Math.max(y1,q[1]);}
      const dx=Math.max(x0-world[0],0,world[0]-x1),dy=Math.max(y0-world[1],0,world[1]-y1);
      if(dx*dx+dy*dy>square||best&&dx*dx+dy*dy>best.distance*best.distance)continue;
      const evalAt=t=>{let q=pts;while(q.length>1)
        q=q.slice(1).map((p,i)=>lerp(q[i],p,t));return q[0];};
      let localBest={t:0,distance:Infinity};
      for(let k=0;k<=12;k++){const t=k/12,d=distance(evalAt(t),world);
        if(d<localBest.distance)localBest={t,distance:d};}
      let a=Math.max(0,localBest.t-1/12),z=Math.min(1,localBest.t+1/12);
      for(let i=0;i<12;i++){
        const t1=a+(z-a)/3,t2=z-(z-a)/3;
        if(distance(evalAt(t1),world)<distance(evalAt(t2),world))z=t2;else a=t1;
      }
      const t=(a+z)/2,d=distance(evalAt(t),world);
      if(d<=threshold&&(!best||d<best.distance))best={index,t,distance:d};
    }
    return best;
  }
  function changedStructural(before){
    const after=commands.map(cp);
    undo.push({structure:true,before,after,kindsAfter:{...kinds}});redo.length=0;
    dirty=true;rebuildNodeIndex();
    touched.clear();
    return true;
  }
  function snapshotStructure(){return {commands:commands.map(cp),kinds:{...kinds}};}
  function addSegment(index,t){
    if(!Number.isFinite(t)||t<=1e-6||t>=1-1e-6)throw Error('Добавляйте узел между существующими точками');
    const data=segment(index);if(!data)throw Error('Нужный сегмент не найден');
    const before=snapshotStructure(),controls=data.controls.map(p=>p.map((v,i)=>v-offset[i]));
    const [left,right]=split(controls,t);
    commands.splice(index,1,toCommand(left),toCommand(right));
    // Preserve the old segment's end node identity at the shifted index.
    const nextKinds={};
    for(const [key,val] of Object.entries(kinds)){
      const i=Number(key);nextKinds[i>index?i+1:i===index?i+1:i]=val;
    }
    kinds=nextKinds;
    changedStructural(before);
    touched.add(index);touched.add(index+1);
    return index;
  }
  function removeAnchor(index){
    const entry=byIndex.get(index);if(!entry)throw Error('Узел не найден');
    const p=parts[entry.part],n=entry.ordinal,count=p.segments.length+(p.closed?0:1);
    if(count<=2)throw Error('В кривой должны остаться минимум два узла');
    const before=snapshotStructure();
    if(p.closed&&n===p.segments.length){
      // This node is followed by an implicit Z edge rather than a native
      // Bézier segment. A simple two-curve merge would delete the wrong edge.
      throw Error('Удаление узла перед неявным замыканием Z требует отдельной топологической операции');
    }
    if(!p.closed&&n===0){
      const first=p.segments[0];
      commands[p.start]=['M',...endpoint(commands[first])];commands.splice(first,1);
    }else if(!p.closed&&n===p.segments.length){
      commands.splice(p.segments.at(-1),1);
    }else{
      const incoming=n?p.segments[n-1]:p.segments.at(-1),
        outgoing=p.segments[n]??p.segments[0];
      const left=segment(incoming),right=segment(outgoing);
      if(!left||!right)throw Error('Нельзя удалить узел в этом составном контуре');
      const a=left.controls.map(v=>v.map((x,i)=>x-offset[i])),
        z=right.controls.map(v=>v.map((x,i)=>x-offset[i]));
      let replacement;
      if(a.length===2&&z.length===2)replacement=['L',...z.at(-1)];
      else{
        const ac=cubic(a),bc=cubic(z);
        replacement=['C',...ac[1],...bc[2],...bc[3]];
      }
      if(n===0){
        // The contour's start is moved to the next real anchor. Its final
        // command becomes the joined closing segment; preserve Z closure.
        const start=endpoint(commands[outgoing]),last=commands[incoming];
        commands[p.start]=['M',...start];commands.splice(outgoing,1);
        const lastIndex=commands.indexOf(last);
        if(lastIndex>=0)commands[lastIndex]=replacement;
      }else{
        commands[incoming]=replacement;commands.splice(outgoing,1);
      }
    }
    const nextKinds={};
    for(const [key,val] of Object.entries(kinds)){
      const i=Number(key);if(i===index)continue;
      nextKinds[i>index?i-1:i]=val;
    }
    kinds=nextKinds;changedStructural(before);
    touched.add(Math.max(1,index-1));
    return true;
  }
  function shiftKinds(from,delta){
    const adjusted={};
    for(const [raw,kind] of Object.entries(kinds)){
      const id=Number(raw);
      adjusted[id>=from?id+delta:id]=kind;
    }
    kinds=adjusted;
  }
  function relocateKindsByPosition(){
    // Reversing/rotating a subpath changes command IDs without moving any
    // anchors. Keep explicit cusp/smooth/symmetric labels on the same real
    // coordinates, not on unrelated command indices in later subpaths.
    const oldTypes=new Map();
    const key=n=>n.part+':'+n.point.map(v=>Math.round(v*1e9)).join(':');
    for(const n of nodes){
      const kind=kinds[n.index];if(!kind)continue;
      const k=key(n);if(!oldTypes.has(k))oldTypes.set(k,[]);
      oldTypes.get(k).push(kind);
    }
    const next=curveNodesTyped({kind:'vector',artwork:'<path/>',
      commands,offset,nodeKinds:{}});
    const result={};
    for(const n of next){
      const candidates=oldTypes.get(key(n));
      if(candidates?.length)result[n.index]=candidates.shift();
    }
    kinds=result;
  }
  function reversePart(index){
    const entry=byIndex.get(index);if(!entry)throw Error('Узел не найден');
    const p=parts[entry.part],before=snapshotStructure();
    const last=p.segments.at(-1),start=p.start,
      hasZ=commands[last+1]?.[0]==='Z';
    const originals=p.segments.map(id=>segment(id).controls.map(q=>q.map((v,i)=>v-offset[i])));
    if(!originals.length)throw Error('Пустой контур');
    const closing=p.closed&&!same(originals.at(-1).at(-1),endpoint(commands[start]))
      ?[[...originals.at(-1).at(-1)],[...endpoint(commands[start])]]:null;
    if(closing)originals.push(closing);
    const newStart=p.closed?endpoint(commands[start]):originals.at(-1).at(-1);
    const reversed=[['M',...newStart],...originals.reverse().map(item=>
      toCommand(item.toReversed())),...(p.closed?[['Z']]:[])];
    commands.splice(start,last-start+1+Number(hasZ),...reversed);
    relocateKindsByPosition();
    changedStructural(before);return true;
  }
  function closeAt(index){
    const entry=byIndex.get(index);if(!entry)throw Error('Узел не найден');
    const part=parts[entry.part];if(part.closed)throw Error('Контур уже замкнут');
    const before=snapshotStructure(),at=part.segments.at(-1)+1;
    commands.splice(at,0,['Z']);
    shiftKinds(at,1);
    changedStructural(before);
    touched.add(part.start);touched.add(part.segments.at(-1));
    return true;
  }
  function breakAt(index){
    const entry=byIndex.get(index);if(!entry)throw Error('Узел не найден');
    const part=parts[entry.part],n=entry.ordinal;
    const before=snapshotStructure();
    if(!part.closed){
      if(n===0||n===part.segments.length)throw Error('Нужен внутренний узел');
      commands.splice(index+1,0,['M',...endpoint(commands[index])]);
      shiftKinds(index+1,1);
    }else{
      const last=part.segments.at(-1),z=last+1;
      if(commands[z]?.[0]!=='Z')throw Error('Нет завершающего Z');
      const full=part.segments.map(id=>segment(id).controls.map(p=>
        p.map((v,i)=>v-offset[i])));
      const start=endpoint(commands[part.start]),end=full.at(-1).at(-1);
      if(!same(end,start))full.push([end,start]);
      // Break AT the selected real anchor. Rotating the segment sequence
      // makes that node both endpoints, exactly as the previous Corel editor.
      const origin=n?full[n-1].at(-1):start;
      const rotated=[...full.slice(n),...full.slice(0,n)];
      commands.splice(part.start,z-part.start+1,
        ['M',...origin],...rotated.map(toCommand));
      relocateKindsByPosition();
    }
    changedStructural(before);return true;
  }
  function setSegment(index,type){
    const around=incident(index);if(!around)throw Error('Узел не найден');
    const id=around.outbound??around.inbound;if(id===null)throw Error('Нет сегмента');
    return perform([id],()=>{
      const c=segment(id);if(!c)throw Error('Сегмент не найден');
      const local=c.controls.map(p=>p.map((v,i)=>v-offset[i]));
      commands[id]=type==='line'?['L',...local.at(-1)]:toCommand(cubic(local));
    });
  }

  function nodeList(){return nodes;}
  function modified(){
    if(!dirty)return false;
    if(commands.length!==initialCommands.length)return true;
    if(JSON.stringify(kinds)!==JSON.stringify(path.nodeKinds||{}))return true;
    // Full comparison is allowed ONLY on explicit session exit. It saves
    // unnecessary global serialization if all local edits cancel each other.
    return commands.some((cmd,i)=>!equivalentCommands(cmd,initialCommands[i]));
  }
  function undoLocal(){
    const op=undo.pop();if(!op)return false;
    if(op.structure){
      commands=op.before.commands.map(cp);kinds={...op.before.kinds};
      rebuildNodeIndex();touched.clear();
    }else{restore(op.before);updateIndexedSegments([...op.before.entries.keys()]);}
    redo.push(op);dirty=undo.length>0;return true;
  }
  function redoLocal(){
    const op=redo.pop();if(!op)return false;
    if(op.structure){
      commands=op.after.map(cp);kinds={...op.kindsAfter};rebuildNodeIndex();touched.clear();
    }else{restore(op.after);updateIndexedSegments([...op.after.entries.keys()]);}
    undo.push(op);dirty=true;return true;
  }
  function historySize(){return undo.length;}
  function finish(){
    // Never serialize the customer's SVG artwork in the editing hot path.
    return {commands:commands.map(cp),nodeKinds:{...kinds},dirty};
  }
  return {moveAnchor,moveHandle,setKind,setSegment,viewPatch,affectedSVG,nodePosition,nodeList,
    addSegment,removeAnchor,closeAt,breakAt,reversePart,nearestSegment,visibleSegmentSVG,segmentIndexStats,
    modified,undoLocal,redoLocal,historySize,finish,getNode,incident};
}
