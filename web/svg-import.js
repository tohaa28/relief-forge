// Deliberately strict initial importer. Unsupported data is rejected, never silently discarded.
export function parseLinearPath(d){
  const tokens=d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[];
  if(d.replace(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?|[\s,]/g,''))throw Error('Некорректные данные SVG path');
  let i=0,cmd='',x=0,y=0,start=[0,0],path=null;const paths=[];
  const num=()=>{if(i>=tokens.length||/^[a-z]$/i.test(tokens[i]))throw Error('Неполная команда SVG');return Number(tokens[i++]);};
  while(i<tokens.length){
    if(/^[a-z]$/i.test(tokens[i]))cmd=tokens[i++];
    if(!/^[MLHVZ]$/i.test(cmd))throw Error(`SVG: команда ${cmd||'?'} пока не поддерживается. Экспортируйте кривые в полилинии.`);
    const rel=cmd===cmd.toLowerCase(),op=cmd.toUpperCase();
    if(op==='Z'){if(!path)throw Error('Z без M');path.closed=true;x=start[0];y=start[1];path=null;cmd='';continue;}
    if(op==='M'||op==='L'){let a=num(),b=num();if(rel){a+=x;b+=y;}x=a;y=b;
      if(op==='M'){path={closed:false,points:[]};paths.push(path);start=[x,y];cmd=rel?'l':'L';}
    }else if(op==='H'){const a=num();x=rel?x+a:a;}else {const a=num();y=rel?y+a:a;}
    if(!path)throw Error('Команда рисования вне подконтура');path.points.push([x,y]);
  }
  return paths;
}
export function importSvg(text){
  const doc=new DOMParser().parseFromString(text,'image/svg+xml');
  if(doc.querySelector('parsererror'))throw Error('Ошибка XML SVG');
  const root=doc.documentElement;if(root.localName!=='svg')throw Error('Это не SVG');
  // Refuse semantics that would change shape or visibility under a simplified import.
  const allowed=new Set(['svg','g','path','polyline','polygon','rect','line','title','desc','metadata']);
  for(const e of [root,...root.querySelectorAll('*')]){
    if(!allowed.has(e.localName))throw Error(`SVG: элемент ${e.localName} пока не поддерживается.`);
    for(const a of ['transform','clip-path','mask','filter','style','display','visibility','class','id'])if(e.hasAttribute(a)&&!(a==='id'))throw Error(`SVG: ${a} пока не поддерживается. Нужен простой SVG без оформления/преобразований.`);
    if(e!==root&&e.localName==='svg')throw Error('Вложенный SVG пока не поддерживается');
  }
  const number=(e,k,fallback)=>{const v=e.getAttribute(k);if(v===null)return fallback;if(!/^[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?$/i.test(v.trim()))throw Error(`SVG: ${k} должен быть числом в координатах документа`);return Number(v);};
  const dim=(s,fallback)=>{if(s===null)return fallback;const m=s.trim().match(/^([\d.]+)(mm|cm|in|px|pt)?$/);if(!m)throw Error('Неизвестные единицы SVG');return Number(m[1])*({mm:1,cm:10,in:25.4,px:25.4/96,pt:25.4/72}[m[2]||'px']);};
  const raw=root.getAttribute('viewBox');const vb=raw?raw.trim().split(/[\s,]+/).map(Number):null;
  if(vb&&(vb.length!==4||vb.some(v=>!Number.isFinite(v))||vb[2]<=0||vb[3]<=0))throw Error('Неверный viewBox');
  const width=dim(root.getAttribute('width'),vb?vb[2]*25.4/96:300),height=dim(root.getAttribute('height'),vb?vb[3]*25.4/96:200);
  if(width<=0||height<=0)throw Error('Неверные размеры SVG');
  let sx=25.4/96,sy=sx,ox=0,oy=0;
  if(vb){sx=width/vb[2];sy=height/vb[3];if(Math.abs(sx-sy)>1e-8)throw Error('Для alpha отношение viewBox должно совпадать с физическими размерами.');ox=-vb[0];oy=-vb[1];}
  const paths=[];
  for(const e of root.querySelectorAll('path,polyline,polygon,line,rect')){
    let p=[];
    if(e.localName==='path')p=parseLinearPath(e.getAttribute('d')||'');
    if(e.localName==='polyline'||e.localName==='polygon'){
      const nums=(e.getAttribute('points')||'').trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if(nums.length%2||nums.some(v=>!Number.isFinite(v)))throw Error('Неверные точки SVG');
      p=[{closed:e.localName==='polygon',points:Array.from({length:nums.length/2},(_,i)=>[nums[2*i],nums[2*i+1]])}];
    }
    if(e.localName==='line')p=[{closed:false,points:[[number(e,'x1',0),number(e,'y1',0)],[number(e,'x2',0),number(e,'y2',0)]]}];
    if(e.localName==='rect'){
      if(number(e,'rx',0)||number(e,'ry',0))throw Error('Скруглённый прямоугольник пока не поддерживается');
      const x=number(e,'x',0),y=number(e,'y',0),w=number(e,'width',0),h=number(e,'height',0);
      if(w<=0||h<=0)throw Error('Пустой прямоугольник');p=[{closed:true,points:[[x,y],[x+w,y],[x+w,y+h],[x,y+h]]}];
    }
    for(const item of p){item.points=item.points.map(([x,y])=>[(x+ox)*sx,(y+oy)*sy]);paths.push(item);}
  }
  return {format:'relief-forge',version:1,width,height,paths,sourceSvg:text};
}
