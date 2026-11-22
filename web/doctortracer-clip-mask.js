const NS='http://www.w3.org/2000/svg';
const shapeTags=new Set(['path','rect','circle','ellipse','polygon','polyline','g']);
const prop=(e,name)=>e.style?.getPropertyValue(name)?.trim()||e.getAttribute(name)||'';
const fragment=value=>/^url\(\s*['"]?#([\w.:-]+)['"]?\s*\)$/.exec(value.trim())?.[1];
const active=(e,name)=>{const v=prop(e,name);return v&&v!=='none';};
// The input has already passed safeFragment. Only this private raster SVG is
// changed; the imported SVG, its paint, real opacity and editable data are not.
export function hardenClipMasks(markup,{Parser=globalThis.DOMParser,Serializer=globalThis.XMLSerializer}={}){
  const doc=new Parser().parseFromString(markup,'image/svg+xml'),root=doc.documentElement;
  const elements=[root,...root.querySelectorAll('*')],ids=new Set(elements.map(e=>e.id).filter(Boolean));
  let sequence=0;
  const fresh=()=>{let id;do{id='rf-crisp-clip-'+sequence++;}while(ids.has(id));ids.add(id);return id;};
  const create=(tag,attrs={})=>{const e=doc.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e;};
  const clips=new Map(elements.filter(e=>e.localName==='clipPath'&&e.id).map(e=>[e.id,e]));
  const targets=elements.filter(e=>active(e,'clip-path')&&!e.closest('clipPath'));
  if(!targets.length)return {markup,converted:0,unsupported:0};
  const defs=create('defs'),filterId=fresh();
  const filter=create('filter',{id:filterId,x:'-5%',y:'-5%',width:'110%',height:'110%','color-interpolation-filters':'sRGB'});
  const transfer=create('feComponentTransfer');
  transfer.append(create('feFuncA',{type:'discrete',tableValues:'0 1'}));filter.append(transfer);defs.append(filter);
  const masks=new Map();let converted=0,unsupported=0;
  function shape(source,parentRule){
    if(!shapeTags.has(source.localName)||active(source,'clip-path')||active(source,'mask')||active(source,'filter'))throw Error('unsupported-clip-geometry');
    const own=prop(source,'clip-rule'),rule=own==='evenodd'||own==='nonzero'?own:parentRule;
    const el=source.cloneNode(false);el.removeAttribute('id');
    // SVG clipping uses geometric fill, never the paint opacity or stroke of
    // the clip definition. The filter quantizes its coverage, not artwork.
    for(const [k,v] of Object.entries({fill:'white','fill-rule':rule,stroke:'none',opacity:'1','fill-opacity':'1','stroke-opacity':'1','mix-blend-mode':'normal','shape-rendering':'crispEdges'}))el.style.setProperty(k,v,'important');
    for(const child of source.children)el.append(shape(child,rule));
    return el;
  }
  // Bounding-box masks cannot safely replace clips on zero-area strokes or
  // on a target whose paint extends beyond its geometric bounding box.
  function unsafeTarget(target){
    if(!shapeTags.has(target.localName)||target.closest('mask,pattern'))return true;
    for(let e=target;e;e=e.parentElement)if(active(e,'stroke')||active(e,'filter'))return true;
    return [...target.querySelectorAll('*')].some(e=>active(e,'stroke')||active(e,'filter')||['line','use','image'].includes(e.localName));
  }
  for(const target of targets){
    const key=fragment(prop(target,'clip-path')),clip=clips.get(key);
    // Combining an existing soft mask with a hard clip requires a separate
    // compositing layer. Retain the original in unsupported cases.
    if(!clip||active(target,'mask')||active(clip,'clip-path')||active(clip,'mask')||active(clip,'filter')||unsafeTarget(target)) {unsupported++;continue;}
    try{
      let id=masks.get(key);
      if(!id){
        const units=clip.getAttribute('clipPathUnits')||'userSpaceOnUse';
        if(!['userSpaceOnUse','objectBoundingBox'].includes(units))throw Error('unsupported-clip-units');
        id=fresh();
        const mask=create('mask',{id,maskUnits:'objectBoundingBox',maskContentUnits:units,x:'-100%',y:'-100%',width:'300%',height:'300%',style:'mask-type:alpha'});
        const filtered=create('g',{filter:'url(#'+filterId+')'}),geometry=create('g');
        const transform=clip.getAttribute('transform');if(transform)geometry.setAttribute('transform',transform);
        const cssTransform=clip.style?.getPropertyValue('transform');if(cssTransform)geometry.style.setProperty('transform',cssTransform);
        let rule='nonzero';for(let node=clip;node;node=node.parentElement){const r=prop(node,'clip-rule');if(r==='evenodd'||r==='nonzero'){rule=r;break;}}
        for(const child of clip.children)geometry.append(shape(child,rule));
        filtered.append(geometry);mask.append(filtered);defs.append(mask);masks.set(key,id);
      }
      target.removeAttribute('clip-path');target.style.removeProperty('clip-path');
      target.style.setProperty('mask','url(#'+id+')','important');converted++;
    }catch{unsupported++;}
  }
  if(converted)root.prepend(defs);
  return {markup:converted?new Serializer().serializeToString(root):markup,converted,unsupported};
}
