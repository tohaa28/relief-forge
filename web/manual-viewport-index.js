import {geometryCommands} from './eps-export.js?v=0.2.0-alpha.60';

// Immutable spatial index of all native Bézier segments, made ONCE at editor
// entry. Zoom queries never traverse the source document or stringify its
// original SVG. Control-hull bounding boxes are conservative (no missed C/Q
// curve intersections), and output is bounded for every viewport.
const key=(x,y)=>x+':'+y;
const fmt=n=>Number(n.toPrecision(13));
const inside=(a,b)=>a.x1>=b.x0&&a.x0<=b.x1&&a.y1>=b.y0&&a.y0<=b.y1;
export function buildManualViewportIndex(document,{maxCellOccupancy=72}={}){
  const segments=[],groups=new Map();
  function add(path,from,cmd){
    if(!from)return;
    const op=cmd[0],params=cmd.slice(1);
    if(!['L','Q','C'].includes(op))return;
    const pts=[from];
    for(let j=0;j<params.length;j+=2)pts.push([params[j],params[j+1]]);
    const bounds={
      x0:Math.min(...pts.map(p=>p[0])),x1:Math.max(...pts.map(p=>p[0])),
      y0:Math.min(...pts.map(p=>p[1])),y1:Math.max(...pts.map(p=>p[1]))
    };
    if(!Object.values(bounds).every(Number.isFinite))return;
    const d='M'+from.map(fmt).join(' ')+op+params.map(fmt).join(' ');
    segments.push({path,bounds,d,ordinal:segments.length});
  }
  for(let path=0;path<document.paths.length;path++){
    const p=document.paths[path];
    if(p.kind==='image')continue;
    let from=null,start=null;
    const commands=geometryCommands(p);
    for(const cmd of commands){
      if(cmd[0]==='M'){from=[cmd[1],cmd[2]];start=from;}
      else if(cmd[0]==='Z'){
        if(from&&start&&(from[0]!==start[0]||from[1]!==start[1]))
          add(path,from,['L',...start]);
        from=start;
      }else if(from){
        add(path,from,cmd);
        from=cmd.slice(-2);
      }
    }
  }
  const area=Math.max(.001,(document.width||1)*(document.height||1));
  const cell=Math.max(.06,Math.sqrt(area/Math.max(1,segments.length))*3);
  const bins=new Map(),globals=[],limit=Math.max(1,maxCellOccupancy);
  for(let id=0;id<segments.length;id++){
    const b=segments[id].bounds,
      xa=Math.floor(b.x0/cell),xb=Math.floor(b.x1/cell),
      ya=Math.floor(b.y0/cell),yb=Math.floor(b.y1/cell);
    if((xb-xa+1)*(yb-ya+1)>limit){globals.push(id);continue;}
    for(let x=xa;x<=xb;x++)for(let y=ya;y<=yb;y++){
      const k=key(x,y);if(!bins.has(k))bins.set(k,[]);
      bins.get(k).push(id);
    }
  }
  let lastCandidateCount=0;
  function query(view,{limit=500,focusPath=null,padding=.28,excludePath=null}={}){
    const box={x0:view.x-view.width*padding,x1:view.x+view.width*(1+padding),
      y0:view.y-view.height*padding,y1:view.y+view.height*(1+padding)};
    const xa=Math.floor(box.x0/cell),xb=Math.floor(box.x1/cell),
      ya=Math.floor(box.y0/cell),yb=Math.floor(box.y1/cell);
    const found=new Set(globals);
    const cells=(xb-xa+1)*(yb-ya+1);
    if(!Number.isFinite(cells)||cells>12000){
      for(let id=0;id<segments.length;id++)found.add(id);
    }else{
      for(let x=xa;x<=xb;x++)for(let y=ya;y<=yb;y++)
        for(const id of bins.get(key(x,y))||[])found.add(id);
    }
    lastCandidateCount=found.size;
    const cx=view.x+view.width/2,cy=view.y+view.height/2,hits=[];
    for(const id of found){
      const seg=segments[id],bb=seg.bounds;
      if(seg.path===excludePath||!inside(bb,box))continue;
      const dx=Math.max(bb.x0-cx,0,cx-bb.x1),dy=Math.max(bb.y0-cy,0,cy-bb.y1);
      hits.push({seg,dist:dx*dx+dy*dy});
    }
    hits.sort((a,b)=>Number(b.seg.path===focusPath)-Number(a.seg.path===focusPath)||
      a.dist-b.dist||a.seg.ordinal-b.seg.ordinal);
    groups.clear();
    for(const {seg} of hits.slice(0,Math.max(1,Math.min(800,limit)))){
      if(!groups.has(seg.path))groups.set(seg.path,[]);
      groups.get(seg.path).push(seg);
    }
    return [...groups.entries()].map(([path,parts])=>({
      path,d:parts.sort((a,b)=>a.ordinal-b.ordinal).map(s=>s.d).join(' '),
      segments:parts.length
    }));
  }
  function stats(){return {total:segments.length,buckets:bins.size,
    global:globals.length,lastCandidates:lastCandidateCount};}
  return {query,stats};
}
