import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.80';
import {nativeParts} from './native-bezier.js?v=0.2.0-alpha.80';

// Combining paths is distinct from Boolean Union: disconnected subpaths must
// also belong to one editable object. Never merge incompatible paint or a
// rejected Boolean group merely to make the object counter say "1".
export function combineWorkingCopy(source,indices,{rejectedGroups=0,unionFilled=null,skipFilledUnion=false}={}){
  const document=structuredClone(source),scope=new Set(indices);
  const paths=indices.map(i=>document.paths[i]);
  const stats={inputObjects:paths.length,outputObjects:paths.length,combined:false,reason:null};
  const keep=reason=>({document,indices:[...indices],stats:{...stats,reason}});
  if(paths.length<2)return keep(null);
  if(rejectedGroups)return keep('unverified-union');
  if(paths.some(p=>!p||p.kind==='image'||p.artwork&&!p.paint||
    /clip-path|mask=|filter=|url\(|<image\b/i.test(p.artwork||'')))return keep('unsupported-appearance');
  const paint=p=>p.paint||{fill:'none',stroke:'#34465b',strokeWidthMm:.07,opacity:1,fillRule:'nonzero'};
  const allFilled=paths.every(p=>nativeParts(p).every(part=>part.closed)&&
    paint(p).fill!=='none'&&paint(p).stroke==='none');
  if(paths.some(p=>paint(p).fill!=='none')&&!allFilled)return keep('unsupported-appearance');
  if(allFilled&&skipFilledUnion)return keep('union-disabled');
  const key=p=>{const s=paint(p);return JSON.stringify([
    s.fill,s.stroke,s.strokeWidthMm??.1,s.opacity??1,
    allFilled&&unionFilled?'native-union':s.fillRule||'nonzero',s.unsupported||null]);};
  if(paths.some(p=>key(p)!==key(paths[0])||Number(paint(p).opacity??1)!==1||paint(p).unsupported))
    return keep('incompatible-paint');
  let commands=paths.flatMap(geometryCommands);
  const style=structuredClone(paint(paths[0]));
  let native=null;
  // A different winding rule cannot be concatenated safely: normalize with
  // the exact same source-provenance/silhouette guarded native Union kernel.
  if(allFilled&&new Set(paths.map(p=>paint(p).fillRule||'nonzero')).size>1){
    if(!unionFilled)return keep('incompatible-paint');
    try{
      native=unionFilled(paths);
      if(!native.quality)return keep('unverified-union');
      commands=native.commands;style.fillRule='evenodd';
    }catch{return keep('unverified-union');}
  }
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const compound={kind:'vector',commands,offset:[0,0],paint:style,
    points:commands.filter(c=>c[0]!=='Z').map(c=>c.slice(-2)),
    closed:commands.at(-1)?.[0]==='Z',
    artwork:'<path d="'+commands.map(c=>c.join(' ')).join(' ')+
      '" fill="'+escape(style.fill)+'" stroke="'+escape(style.stroke)+
      '" stroke-width="'+(style.strokeWidthMm??.1)+'" fill-rule="'+escape(style.fillRule||'nonzero')+'"/>'};
  if(native){compound.nativeUnionProof=native.proof;compound.nativeUnionQuality=native.quality;}
  const first=Math.min(...indices),result=[];let index;
  document.paths.forEach((p,i)=>{
    if(i===first){index=result.length;result.push(compound);}
    else if(!scope.has(i))result.push(p);
  });
  document.paths=result;
  return {document,indices:[index],stats:{...stats,outputObjects:1,combined:true}};
}

// Diagnose the exact combined copy BEFORE any point repair/refit/smoothing.
// Dependency injection makes the order and cancellation independently testable.
export async function prepareAfterCopy(source,indices,{union,diagnose,combine=combineWorkingCopy,onPrepared=()=>{},
  cancelled=()=>false}={}){
  const check=()=>{if(cancelled())throw Error('Подготовка копии отменена');};
  const before=structuredClone(source);check();
  const merged=await union(structuredClone(before),[...indices]);check();
  const combined=await combine(merged.document,merged.selectedIndices,merged.stats);check();
  await onPrepared(combined);check();
  const report=await diagnose(structuredClone(combined.document));check();
  if(!report)throw Error('Диагностика объединённой копии не завершена');
  return {before,document:combined.document,indices:combined.indices,
    merged,compound:{...combined.stats,inputObjects:indices.length,
      combined:combined.stats.combined||indices.length>1&&combined.indices.length===1},report};
}
