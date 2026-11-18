import {curveNodesTyped} from './curve-edit.js?v=0.2.0-alpha.55';

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
  let {parts,byIndex}=indexCommands(commands);
  let nodes=curveNodesTyped(path).map(n=>({...n,point:[...n.point]}));
  let nodeMap=new Map(nodes.map(n=>[n.index,n]));
  let kinds={...(path.nodeKinds||{})},dirty=false;
  const touched=new Set(),undo=[],redo=[];
  const command=i=>commands[i];
  const anchor=i=>{const c=command(i);return c?shifted(endpoint(c),offset):null;};
  function segment(index){
    const c=command(index);if(!c||!['L','Q','C'].includes(c[0]))return null;
    const item=[...parts].find(p=>p.segments.includes(index));if(!item)return null;
    const ordinal=item.segments.indexOf(index),prev=ordinal?item.segments[ordinal-1]:item.start;
    return {index,start:prev,controls:[endpoint(command(prev)),...Array.from({length:(c.length-1)/2},(_,j)=>c.slice(1+j*2,3+j*2))].map(p=>shifted(p,offset))};
  }
  function getNode(index){return nodeMap.get(index)||null;}
  function incident(index){
    const entry=byIndex.get(index);if(!entry)return null;
    const p=parts[entry.part],n=entry.ordinal;
    return {inbound:n?p.segments[n-1]:p.closed?p.segments.at(-1):null,
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
    kinds={...frame.kinds};dirty=frame.dirty;
    for(const [i,p] of frame.positions){const node=nodeMap.get(i);if(node)node.point=[...p];}
    for(const i of frame.touched)touched.add(i);
  }
  function capture(ids){
    const entries=new Map(ids.filter(i=>i!==null&&i!==undefined&&commands[i]).map(i=>[i,cp(commands[i])]));
    const positions=new Map();
    for(const node of nodes)if(entries.has(node.index))positions.set(node.index,[...node.point]);
    return {entries,positions,kinds:{...kinds},dirty,touched:[...ids]};
  }
  function perform(ids,operation){
    const prior=capture(ids);operation();
    const changed=ids.some(i=>i!==null&&JSON.stringify(prior.entries.get(i))!==JSON.stringify(commands[i]))||
      JSON.stringify(prior.kinds)!==JSON.stringify(kinds);
    if(!changed)return [];
    undo.push({before:prior,after:capture(ids)});redo.length=0;dirty=true;
    for(const i of ids)if(i!==null&&i!==undefined)touched.add(i);
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
    const around=incident(index);if(!around)throw Error('Не найден узел');
    const ids=[around.inbound,around.outbound].filter(x=>x!==null);
    return perform(ids,()=>{kinds[index]=kind;const n=getNode(index);if(n)n.type=kind;});
  }
  function affectedSVG(){
    const paths=[];
    for(const i of touched){
      const c=segment(i);
      if(c)paths.push({key:i,d:svgSegment(c.controls)});
    }
    return paths;
  }
  function nodePosition(index){return getNode(index)?.point?.slice()||null;}
  function nodeList(){return nodes;}
  function modified(){return dirty;}
  function undoLocal(){
    const op=undo.pop();if(!op)return false;
    restore(op.before);redo.push(op);dirty=undo.length>0;
    return true;
  }
  function redoLocal(){
    const op=redo.pop();if(!op)return false;
    restore(op.after);undo.push(op);dirty=true;
    return true;
  }
  function historySize(){return undo.length;}
  function finish(){
    // Never serialize the customer's SVG artwork in the editing hot path.
    return {commands:commands.map(cp),nodeKinds:{...kinds},dirty};
  }
  return {moveAnchor,moveHandle,setKind,viewPatch,affectedSVG,nodePosition,nodeList,
    modified,undoLocal,redoLocal,historySize,finish,getNode,incident};
}
