/**
 * Observable SVG workspace health checks. No proprietary/browser-specific API.
 * Imported geometry is never rewritten: repairs affect only layout/visibility
 * and viewBox. No zoom changes during ordinary edits or manual navigation.
 */
const finitePositive=n=>Number.isFinite(n)&&n>0;
export function validBox(b){
  return b&&Number.isFinite(b.x)&&Number.isFinite(b.y)&&finitePositive(b.width)&&finitePositive(b.height);
}
export function boxesOverlap(a,b){
  if(!validBox(a)||!validBox(b))return false;
  return Math.min(a.x+a.width,b.x+b.width)>Math.max(a.x,b.x)&&
    Math.min(a.y+a.height,b.y+b.height)>Math.max(a.y,b.y);
}
export function fittedViewBox(bounds,padding=.06){
  if(!validBox(bounds))return null;
  const p=Math.max(bounds.width,bounds.height,1)*padding;
  return {x:bounds.x-p,y:bounds.y-p,width:bounds.width+2*p,height:bounds.height+2*p};
}
const number=n=>Number.isFinite(n)?Math.round(n*1000)/1000:null;
const snapshotRect=r=>r?{x:number(r.x),y:number(r.y),width:number(r.width),height:number(r.height)}:null;
const minimalStyle=(element,styleOf)=>{
  if(!element)return null;
  try{
    const css=styleOf(element);
    return {display:css.display,visibility:css.visibility,opacity:css.opacity,
      width:css.width,height:css.height};
  }catch{return null;}
};
function hiddenStyle(style){
  return style&&(style.display==='none'||style.visibility==='hidden'||
    style.visibility==='collapse'||Number(style.opacity)===0);
}
export function inspectWorkspace({canvas,workspace,geometry,mascot,documentPaths=0,
  documentLoaded=false,styleOf=e=>getComputedStyle(e),
  bounding=()=>geometry.getBBox(),overlay=null}={}){
  const issues=[];
  const rect=snapshotRect(canvas?.getBoundingClientRect?.());
  const parentRect=snapshotRect(workspace?.getBoundingClientRect?.());
  const canvasStyle=minimalStyle(canvas,styleOf),parentStyle=minimalStyle(workspace,styleOf);
  const geometryStyle=minimalStyle(geometry,styleOf);
  const viewBox=canvas?.viewBox?.baseVal;
  const view=viewBox?{x:number(viewBox.x),y:number(viewBox.y),
    width:number(viewBox.width),height:number(viewBox.height)}:null;
  const expected=Boolean(documentPaths||documentLoaded);
  const elementCount=geometry?.childElementCount||0;
  let geometryBox=null,bboxError=null;
  if(elementCount&&expected){
    try{const box=bounding();geometryBox=snapshotRect(box);}
    catch(error){bboxError=String(error?.message||error);}
  }
  if(!canvas||!geometry||!workspace)issues.push('missing-elements');
  if(hiddenStyle(parentStyle))issues.push('workspace-hidden');
  if(hiddenStyle(canvasStyle))issues.push('canvas-hidden');
  if(hiddenStyle(geometryStyle))issues.push('geometry-hidden');
  if(!rect||rect.width<32||rect.height<32||!parentRect||parentRect.height<32)
    issues.push('zero-size');
  if(!validBox(view))issues.push('invalid-viewbox');
  if(expected&&documentPaths>0&&!elementCount)issues.push('empty-svg');
  if(expected&&documentPaths>0&&elementCount&&geometryBox&&validBox(geometryBox)&&
    validBox(view)&&!boxesOverlap(view,geometryBox))issues.push('out-of-view');
  if(expected&&documentPaths>0&&geometryBox&&!validBox(geometryBox))issues.push('invalid-geometry-bounds');
  if(expected&&mascot&&!mascot.hidden)issues.push('mascot-visible');
  if(expected&&overlay&&!overlay.hidden)issues.push('overlay-visible');
  return {ok:issues.length===0,issues,expected,documentPaths,elementCount,
    canvasRect:rect,workspaceRect:parentRect,viewBox:view,
    geometryBox,canvasStyle,parentStyle,geometryStyle,
    mascotHidden:mascot?.hidden??null,overlayHidden:overlay?.hidden??null,
    bboxError};
}
function forceDisplayed(element,display){
  if(!element)return;
  element.hidden=false;
  element.style?.setProperty?.('display',display,'important');
  element.style?.setProperty?.('visibility','visible','important');
  element.style?.setProperty?.('opacity','1','important');
}
export function recoverWorkspace(view,{
  canvas,workspace,geometry,mascot,overlay,
  viewportHeight=()=>typeof window!=='undefined'?window.innerHeight:700,
  preserveView=false
}={}){
  const attempts=[];
  if(!view?.issues?.length)return attempts;
  if(view.issues.includes('mascot-visible')&&mascot){
    mascot.hidden=true;mascot.style?.setProperty?.('display','none','important');
    mascot.style?.setProperty?.('visibility','hidden','important');
    attempts.push('mascot-hidden');
  }
  if(view.issues.includes('overlay-visible')&&overlay){
    overlay.hidden=true;overlay.style?.setProperty?.('display','none','important');
    attempts.push('overlay-hidden');
  }
  if(view.issues.includes('workspace-hidden')||view.issues.includes('zero-size')){
    forceDisplayed(workspace,'block');
    if(workspace?.style?.setProperty){
      const height=Math.max(260,Math.min(900,Math.round(viewportHeight()*0.55)));
      if(!view.workspaceRect||view.workspaceRect.height<32)
        workspace.style.setProperty('min-height',height+'px','important');
    }
    attempts.push('workspace-layout');
  }
  if(view.issues.includes('canvas-hidden')||view.issues.includes('zero-size')){
    forceDisplayed(canvas,'block');
    canvas?.style?.setProperty?.('min-height','240px','important');
    canvas?.style?.setProperty?.('width','100%','important');
    canvas?.style?.setProperty?.('height','100%','important');
    attempts.push('canvas-layout');
  }
  if(view.issues.includes('geometry-hidden')){
    forceDisplayed(geometry,'inline');
    attempts.push('geometry-visibility');
  }
  if(!preserveView&&(view.issues.includes('out-of-view')||view.issues.includes('invalid-viewbox'))){
    const target=fittedViewBox(view.geometryBox);
    if(target&&canvas?.setAttribute){
      canvas.setAttribute('viewBox',[target.x,target.y,target.width,target.height].join(' '));
      attempts.push('geometry-fit');
    }
  }
  return attempts;
}
export function shortWorkspaceDiagnosis(health){
  const messages={
    'missing-elements':'не найдены элементы SVG',
    'workspace-hidden':'рабочая область скрыта стилями',
    'canvas-hidden':'SVG скрыт стилями',
    'geometry-hidden':'слой геометрии скрыт',
    'zero-size':'размер рабочего поля слишком мал или равен нулю',
    'invalid-viewbox':'неверный масштаб/viewBox',
    'empty-svg':'контуры не построены в SVG',
    'out-of-view':'контуры вне видимого поля',
    'invalid-geometry-bounds':'SVG не смог вычислить границы контуров',
    'mascot-visible':'маскот закрывает загруженный документ',
    'overlay-visible':'слой перетаскивания перекрывает документ'
  };
  return health.ok?'Рабочее поле доступно':
    health.issues.map(k=>messages[k]||k).join('; ');
}
export function safeWorkspaceReport(health,{version='',source='',errors=[]}={}){
  return JSON.stringify({version,source,at:new Date().toISOString(),
    userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown',
    devicePixelRatio:typeof window!=='undefined'?window.devicePixelRatio:null,
    ...health,errors:errors.slice(-15)},null,2);
}
