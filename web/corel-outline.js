// Recover narrowly defined CorelDRAW and Relief Forge EPS outlines containing
// literal path-building commands and a final N (newpath), with no paint operator.
// CorelDRAW EPS may intermix 'c' and 'C': both alias PostScript curveto.
// Preserve their exact six controls and endpoint as editable SVG cubic C.
// Regular Ghostscript/MuPDF interpretation ALWAYS takes priority.
// This is not a general-purpose PostScript parser.
const NUM='[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const move=new RegExp('^('+NUM+')\\s+('+NUM+')\\s+m$');
const line=new RegExp('^('+NUM+')\\s+('+NUM+')\\s+L$');
const curve=new RegExp('^('+NUM+')(?:\\s+('+NUM+'))(?:\\s+('+NUM+'))(?:\\s+('+NUM+'))(?:\\s+('+NUM+'))(?:\\s+('+NUM+'))\\s+[Cc]
const valid=values=>values.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e7);

export function recoverUnpaintedCorelOutlines(program,metadata){
  const source=new TextDecoder('latin1').decode(program);
  const corel=/^%%Creator:\s*CorelDRAW[^\r\n]*/mi.test(source);
  const own=/^%%Creator:\s*Relief Forge\s*$/mi.test(source)&&/^%%RF-OutlinePaths:\s*1\s*$/mi.test(source);
  if((!corel&&!own)||!source.includes('/N/newpath ld'))return null;
  const pages=[...source.matchAll(/^%%Page:\s+/gm)];
  if(pages.length!==1)return null;
  const setup=source.indexOf('%%EndPageSetup',pages[0].index);
  const trailer=source.indexOf('%%PageTrailer',setup);
  if(setup<0||trailer<0)return null;
  const lines=source.slice(setup+'%%EndPageSetup'.length,trailer).split(/\r\n|\n|\r/);
  const paths=[];let current='',started=false,cleared=false,operations=0;
  for(const raw of lines){
    const token=raw.trim();if(!token||token.startsWith('%'))continue;
    // Only allow the known Corel page prelude BEFORE the first path; refuse
    // unsupported operators inside the geometry rather than inventing objects.
    if(!started){if(!move.test(token))continue;started=true;}
    if(cleared||++operations>200000)return null;
    const m=move.exec(token),l=line.exec(token),c=curve.exec(token);
    if(m){
      const xy=m.slice(1).map(Number);
      if(!valid(xy))return null;
      // EPS supports multiple open subpaths without painting; retain them
      // independently instead of conflating or dropping their endpoints.
      if(current)paths.push(current);
      current='M '+xy.join(' ');
    }else if(l||c){
      const values=(l||c).slice(1).map(Number);
      if(!current||!valid(values))return null;
      current+=' '+(l?'L':'C')+' '+values.join(' ');
    }else if(token==='@c'){
      if(!current)return null;
      paths.push(current+' Z');current='';
    }else if(token==='N'){
      if(current)paths.push(current);
      current='';cleared=true;
    }else return null;
  }
  if(!started||!cleared||!paths.length||paths.length>200000)return null;
  const box=metadata?.boundingBox;
  if(!Array.isArray(box)||box.length!==4||!valid(box)||box[2]<=box[0]||box[3]<=box[1])return null;
  const [x0,y0,x1,y1]=box,width=x1-x0,height=y1-y0;
  // Raw PostScript coordinates and cubic control points stay intact (points).
  // The stroke is a display-only convention, not a real print-line width.
  const svgPaths=paths.map(d=>'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.25"/>').join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'pt" height="'+height+
    'pt" viewBox="0 0 '+width+' '+height+'"><g transform="translate('+
    (-x0)+' '+y1+') scale(1 -1)">'+svgPaths+'</g></svg>';
  return {svg,count:paths.length,source:own?'relief-forge-outline-paths':'coreldraw-unpainted-paths',previewStrokePt:0.25};
}
);
const valid=values=>values.every(v=>Number.isFinite(v)&&Math.abs(v)<=1e7);

export function recoverUnpaintedCorelOutlines(program,metadata){
  const source=new TextDecoder('latin1').decode(program);
  const corel=/^%%Creator:\s*CorelDRAW[^\r\n]*/mi.test(source);
  const own=/^%%Creator:\s*Relief Forge\s*$/mi.test(source)&&/^%%RF-OutlinePaths:\s*1\s*$/mi.test(source);
  if((!corel&&!own)||!source.includes('/N/newpath ld'))return null;
  const pages=[...source.matchAll(/^%%Page:\s+/gm)];
  if(pages.length!==1)return null;
  const setup=source.indexOf('%%EndPageSetup',pages[0].index);
  const trailer=source.indexOf('%%PageTrailer',setup);
  if(setup<0||trailer<0)return null;
  const lines=source.slice(setup+'%%EndPageSetup'.length,trailer).split(/\r\n|\n|\r/);
  const paths=[];let current='',started=false,cleared=false,operations=0;
  for(const raw of lines){
    const token=raw.trim();if(!token||token.startsWith('%'))continue;
    // Only allow the known Corel page prelude BEFORE the first path; refuse
    // unsupported operators inside the geometry rather than inventing objects.
    if(!started){if(!move.test(token))continue;started=true;}
    if(cleared||++operations>200000)return null;
    const m=move.exec(token),l=line.exec(token),c=curve.exec(token);
    if(m){
      const xy=m.slice(1).map(Number);
      if(!valid(xy))return null;
      // EPS supports multiple open subpaths without painting; retain them
      // independently instead of conflating or dropping their endpoints.
      if(current)paths.push(current);
      current='M '+xy.join(' ');
    }else if(l||c){
      const values=(l||c).slice(1).map(Number);
      if(!current||!valid(values))return null;
      current+=' '+(l?'L':'C')+' '+values.join(' ');
    }else if(token==='@c'){
      if(!current)return null;
      paths.push(current+' Z');current='';
    }else if(token==='N'){
      if(current)paths.push(current);
      current='';cleared=true;
    }else return null;
  }
  if(!started||!cleared||!paths.length||paths.length>200000)return null;
  const box=metadata?.boundingBox;
  if(!Array.isArray(box)||box.length!==4||!valid(box)||box[2]<=box[0]||box[3]<=box[1])return null;
  const [x0,y0,x1,y1]=box,width=x1-x0,height=y1-y0;
  // Raw PostScript coordinates and cubic control points stay intact (points).
  // The stroke is a display-only convention, not a real print-line width.
  const svgPaths=paths.map(d=>'<path d="'+d+'" fill="none" stroke="#34465b" stroke-width="0.25"/>').join('');
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'pt" height="'+height+
    'pt" viewBox="0 0 '+width+' '+height+'"><g transform="translate('+
    (-x0)+' '+y1+') scale(1 -1)">'+svgPaths+'</g></svg>';
  return {svg,count:paths.length,source:own?'relief-forge-outline-paths':'coreldraw-unpainted-paths',previewStrokePt:0.25};
}
