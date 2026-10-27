import {nativeParts} from './native-bezier.js?v=0.2.0-alpha.49';
import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.49';

// An opaque later copy fully covers the earlier identical solid fill. Remove
// only strict native-geometry + paint matches; never flatten a Bezier or alter
// the relative order of the retained (last) copy and other artwork.
function safeFill(p){
  const ink=p?.paint;
  return p?.kind==='vector' && nativeParts(p).length>0 && nativeParts(p).every(p=>p.closed) && ink &&
    !ink.unsupported && typeof ink.fill==='string' &&
    ink.fill.toLowerCase()!=='none' && !/url\s*\(/i.test(ink.fill) &&
    (!ink.stroke||ink.stroke.toLowerCase()==='none') &&
    Number(ink.opacity??1)===1 && Number(ink.fillOpacity??1)===1 &&
    (!p.artwork||!/(clip-path|mask=|filter=|<image\b|url\s*\()/i.test(p.artwork));
}
export function deduplicateExactVectors(document,{indices=null}={}){
  if(!Array.isArray(document?.paths))throw Error('Нет векторного документа');
  const selected=indices?new Set(indices):null;
  const last=new Map(),drop=new Set();
  document.paths.forEach((p,i)=>{
    if(selected&&!selected.has(i))return;
    if(!safeFill(p))return;
    let geometry;
    try{geometry=JSON.stringify(geometryCommands(p));}
    catch{return;}
    const key=JSON.stringify([p.paint,geometry]);
    const previous=last.get(key);
    if(previous!==undefined)drop.add(previous);
    last.set(key,i);
  });
  const keptOriginalIndices=document.paths.map((_,i)=>i).filter(i=>!drop.has(i));
  const paths=keptOriginalIndices.map(i=>structuredClone(document.paths[i]));
  return {
    document:{...structuredClone(document),paths},
    keptOriginalIndices,
    stats:{before:document.paths.length,after:paths.length,removed:drop.size,
      removedNodes:[...drop].reduce((sum,i)=>sum+
        (document.paths[i].commands
          ?document.paths[i].commands.filter(c=>['M','L','C','Q'].includes(c[0])).length
          :(document.paths[i].points?.length||0)),0)}
  };
}
