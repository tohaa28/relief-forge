import {cacheViewDecorations} from './view-zoom.js?v=0.2.0-alpha.75';
import {prepareAfterCopy} from './after-preparation.js?v=0.2.0-alpha.75';
import {prepareNativeIntersections} from './native-intersections.js?v=0.2.0-alpha.75';
import {validateDocumentCurveChange} from './curve-quality.js?v=0.2.0-alpha.75';
import {importRichSvg,worldData,artworkMarkup,safeFragment,sampledContours,exportDocument} from './rich-svg.js?v=0.2.0-alpha.75';
import {issueViewBox} from './issue-focus.js?v=0.2.0-alpha.75';
import {visibleHealthyAnchors,circlePath} from './vector-points.js?v=0.2.0-alpha.75';
import {issueDistanceLabel,screenUnitsPerPixel,renderIssueMarkers,createIssueBoundsValidator} from './issue-markers.js?v=0.2.0-alpha.75';
import {issuesForManualEditor,resolveManualIssues,retainsIssuesDuringManualChange} from './manual-issue-state.js?v=0.2.0-alpha.75';
import {diagnoseLocalNodeArea,localNodeRadius} from './local-node-diagnostics.js?v=0.2.0-alpha.75';
import {buildAnchorIndex,nearbyAnchors,createLiveCurvePatch,drawLiveCurvePatch} from './manual-edit-performance.js?v=0.2.0-alpha.75';
import {heavyManualScene,screenToDocumentPoint,manualVectorBounds} from './manual-viewport-performance.js?v=0.2.0-alpha.75';
import {createDeferredCurveEditor} from './deferred-curve-editor.js?v=0.2.0-alpha.75';
import {exportEps,exportColoredEps} from './eps-export.js?v=0.2.0-alpha.75';
import {geometryStamp} from './eps-paint.js?v=0.2.0-alpha.75';
import {packedInput} from './auto-repair.js?v=0.2.0-alpha.75';
import {mappedComparison,activeComparisonFrame,zoomBox} from './central-comparison.js?v=0.2.0-alpha.75';
import {removeTinyClosedSubpaths} from './cnc-microfilter.js?v=0.2.0-alpha.75';
import {beginImportBefore,captureImportBefore,importedComparison} from './import-before.js?v=0.2.0-alpha.75';
import {basename,epsResultFilename,readHistory,persistHistory,createHistoryEntry,updateHistoryEntry,formatHistoryStatus,formatHistoryDate} from './file-history.js?v=0.2.0-alpha.75';
import {selectedVectorIndices,smoothAndOptimizePaths,smoothVectorPath,optimizeVectorPath} from './curve-optimizer.js?v=0.2.0-alpha.75';
import {repairVectorPoints} from './point-repair.js?v=0.2.0-alpha.75';
import {separateCoincidentNonadjacentNodes} from './coincident-node-separation.js?v=0.2.0-alpha.75';
import {repairSelfIntersections} from './self-intersection-repair.js?v=0.2.0-alpha.75';
import {mergeNearbyGeometry} from './nearby-curve-merge.js?v=0.2.0-alpha.75';
import {needsDoctorTracer,rasterPlan,rasterizeDocument,rasterizeDocumentAlpha,traceDocumentWithNodeBudget,maskSimilarity,acceptRetracing} from './doctortracer-fallback.js?v=0.2.0-alpha.75';
import {createDoctorTracerMaskCache,preparedRasterPlan,boundedWorkerRasterPlan,workerRasterFromPreparedMask,PREPARED_RASTER_DPI} from './doctortracer-prepared.js?v=0.2.0-alpha.75';
import {curveNodes,curveNodesTyped,moveCurveNode,nearestCurveSegment,addCurveNode,deleteCurveNode,curveHandles,curveNodeType,moveCurveHandle,setCurveNodeType,setCurveSegmentType,reverseCurveDirection,closeCurveAtNode,breakCurveAtNode,finishDeferredCurveCommands} from './curve-edit.js?v=0.2.0-alpha.75';
import {keyboardAction} from './doctor-shortcuts.js?v=0.2.0-alpha.75';
import {planDiagnosticBatches,mapDiagnosticIssue,isSupportedDrop,droppedFiles} from './large-file-support.js?v=0.2.0-alpha.75';
import {inspectDocumentComplexity,largeFileWarning} from './complexity-preflight.js?v=0.2.0-alpha.75';
import {syncWorkspaceMascot} from './mascot-visibility.js?v=0.2.0-alpha.75';
import {assessImportedGeometry} from './import-integrity.js?v=0.2.0-alpha.75';
import {inspectWorkspace,recoverWorkspace,shortWorkspaceDiagnosis,safeWorkspaceReport} from './workspace-health.js?v=0.2.0-alpha.75';
import {chooseAfterSnapshot,afterSaveDecision,afterSaveMessage} from './after-result.js?v=0.2.0-alpha.75';
import {diagnoseAfterDocument} from './after-diagnostics.js?v=0.2.0-alpha.75';
import {runNativeJob,cancelNativeJobs} from './native-jobs.js?v=0.2.0-alpha.75';
const mergeOverlappingObjects=(document,options)=>runNativeJob({action:'union',document,options});
import {gpuBroadphase} from './gpu-broadphase.js?v=0.2.0-alpha.75';
import {refitBooleanUnion} from './union-refit.js?v=0.2.0-alpha.75';
import {protectPreviewNodeBudget,previewBudgetMessage} from './preview-node-budget.js?v=0.2.0-alpha.75';
import {verifyEpsOutputGeometry} from './eps-export.js?v=0.2.0-alpha.75';
let nodeTool='move',activeCurveNode=null,contextHit=null;
let clearanceKey='',clearanceJob=0,clearanceTimer=null,clearanceWorker=null,clearanceReport=null;
function updateClearance(document,unit){
  const layer=$('clearance-markers'),label=$('clearance-status'),raw=settingNumber('clearance-threshold');
  const threshold=Number.isFinite(raw)&&raw>0&&raw<=1000?raw:null;
  if(manualReviewPending||manualClearancePaused){
    layer.replaceChildren();
    label.textContent='Зазоры после ручной правки не проверялись. Нажмите «Проверить дефекты», если нужна новая диагностика.';
    return;
  }
  if(curveEditing()){
    // Manual edits must never launch a full-document clearance Worker.
    layer.replaceChildren();
    label.textContent='Редактор узлов: повторная проверка только вокруг курсора; общий анализ зазоров приостановлен.';
    return;
  }
  const key=JSON.stringify([threshold,document.paths.map(p=>[p.kind,p.artwork?p.commands:p.points,p.closed,p.offset])]);
  if(key!==clearanceKey){
    clearanceKey=key;clearanceReport=null;clearanceJob++;clearTimeout(clearanceTimer);clearanceWorker?.terminate();clearanceWorker=null;
    label.textContent=threshold?'Измерение расстояний…':'Укажите расстояние больше 0 и не больше 1000 мм.';
    if(threshold&&document.paths.length){const id=clearanceJob;clearanceTimer=setTimeout(()=>{
      clearanceWorker=new Worker(new URL('./clearance-worker.js?v=0.2.0-alpha.75',import.meta.url),{type:'module'});
      clearanceWorker.onmessage=({data})=>{if(data.id!==clearanceJob)return;clearanceReport=data.report||null;label.textContent=data.error||('Узкие места < '+threshold+' мм: '+data.report.markers.length+(data.report.complete?' · проверка завершена':' · проверка неполная (лимит или пограничная точность)'));clearanceWorker?.terminate();clearanceWorker=null;render();};
      clearanceWorker.onerror=()=>{if(id!==clearanceJob)return;label.textContent='Измерение расстояний не завершено: ошибка вычисления.';clearanceWorker?.terminate();clearanceWorker=null;};
      clearanceWorker.postMessage({id,document:{paths:document.paths.map(p=>({kind:p.kind,artwork:Boolean(p.artwork),commands:p.commands,points:p.points,closed:p.closed,offset:p.offset}))},threshold});
    },120);}else if(threshold)label.textContent='Откройте макет для измерения расстояний.';
  }
  layer.replaceChildren();
  if(clearanceReport&&markersVisible&&!curveEditing())for(const marker of clearanceReport.markers){
    const circle=el('circle',{cx:marker.point[0],cy:marker.point[1],r:Math.max(threshold,unit*7),fill:'#ff79bb','fill-opacity':'.38','data-distance-mm':marker.distance},layer);
    const title=el('title',{},circle);title.textContent='Кратчайшее расстояние ≤ '+marker.distance.toFixed(6)+' мм';
  }
}
// Real crosshair target (hotspot at the exact central pixel); no text glyph
// whose rendering varies between Windows/Firefox and Chromium.
const nodeCursor=kind=>{
  const arms='<path d="M16 1V7 M16 25V31 M1 16H7 M25 16H31" stroke="#173946" stroke-width="1.7"/>';
  const mark=kind==='remove'
    ?'<path d="M12 12L20 20 M20 12L12 20" stroke="#d83b42" stroke-width="2.5" stroke-linecap="round"/>'
    :'<path d="M16 11V21 M11 16H21" stroke="#008c82" stroke-width="2.5" stroke-linecap="round"/>';
  const svg=kind==='remove'
    ?'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">'+mark+'</svg>'
    :'<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="8.5" fill="white" fill-opacity=".92" stroke="#173946" stroke-width="1.6"/>'+arms+mark+'</svg>';
  return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'") 16 16, crosshair';
};
const plusCursor=nodeCursor('add'),minusCursor=nodeCursor('remove');
const curveEditing=()=>mode==='nodes';
const $=id=>document.getElementById(id),ns='http://www.w3.org/2000/svg';

const settingIds=['tolerance','clearance-threshold','selection-only','smoothing-amount',
  'optimization-tolerance','merge-overlaps','separate-coincident','remove-micro','micro-width','micro-height',
  'doctortracer-enabled','repair-self-intersections','self-intersection-mode','self-intersection-size','self-intersection-preserve','merge-nearby','merge-nearby-distance','merge-nearby-strict'];
const settingChecks=new Set(['selection-only','merge-overlaps','separate-coincident','remove-micro',
  'doctortracer-enabled','repair-self-intersections','self-intersection-preserve',
  'merge-nearby','merge-nearby-strict']);
const settingSelects=new Set(['self-intersection-mode','self-intersection-size']);
const settingOptions={'self-intersection-mode':['hybrid','handles','loops','separate'],
  'self-intersection-size':['micro','small','all']};
const readSettingsForm=()=>Object.fromEntries(settingIds.map(id=>
  [id,settingChecks.has(id)?$(id).checked:settingSelects.has(id)?$(id).value:Number($(id).value)]));
// HTML defaults are the single source for both first launch and reset.
const defaultSettings=Object.freeze(Object.fromEntries(settingIds.map(id=>{
  const field=$(id);
  return [id,settingChecks.has(id)?field.defaultChecked:settingSelects.has(id)?
    [...field.options].find(option=>option.defaultSelected)?.value||field.options[0].value:Number(field.defaultValue)];
})));
let appliedSettings=readSettingsForm(),settingsDirty=false,pendingSettingsApply=false;
const settingNumber=id=>Number(appliedSettings[id]);
const settingChecked=id=>Boolean(appliedSettings[id]);
const settingValue=id=>appliedSettings[id];
function validateSettingsDraft(draft){
  for(const id of settingIds){
    if(settingChecks.has(id))continue;
    if(settingSelects.has(id)){
      if(!settingOptions[id].includes(draft[id]))return 'Неверный режим исправления пересечений';
      continue;
    }
    const field=$(id),value=draft[id];
    if(!Number.isFinite(value)||field.value.trim()===''||
       value<Number(field.min||-Infinity)||value>Number(field.max||Infinity))
      return 'Неверный параметр: '+field.closest('label')?.textContent.trim();
  }
  return null;
}
function markSettingsDirty(){
  settingsDirty=settingIds.some(id=>
    settingChecks.has(id)?$(id).checked!==appliedSettings[id]:
      settingSelects.has(id)?$(id).value!==appliedSettings[id]:
      Number($(id).value)!==appliedSettings[id]);
  $('settings-pending').textContent=settingsDirty?
    'Параметры изменены, но не применены. Пересчёт начнётся только по кнопке.':
    'Параметры действуют. Ввод не запускает пересчёт.';
  $('settings-pending').classList.toggle('unsaved',settingsDirty);
  $('apply-changes').disabled=busy||!ready||!doc.paths.some(p=>p.kind!=='image')||
    (!settingsDirty&&(!curvePreview||!curvePreview.hasGeometryChange));
}
function finalizePendingSettingsApply(preview){
  if(!pendingSettingsApply||preview!==curvePreview)return;
  pendingSettingsApply=false;
  if(preview.hasGeometryChange){
    if(applyUnifiedChanges())
      $('settings-pending').textContent='Параметры применены; геометрия обновлена. Ctrl+Z — отмена.';
    else status('Результат рассчитан, но не применён. Проверьте параметры.');
  }else{
    $('settings-pending').textContent='Параметры применены; форма кривых не изменилась.';
    status('Настройки применены без изменения геометрии.');
    render();
  }
}

const names={open:'Открытый контур',coincident:'Совпадающие узлы',near_node:'Сближенные узлы',short:'Короткий отрезок',duplicate:'Дубликат',overlap:'Наложение отрезков',self_intersection:'Самопересечение',intersection:'Пересечение объектов'};
let diagnosticComplete=true,markersVisible=true,pointsVisible=true,appliedComparison=null,compareStage='before',displayedIssues=[],curvePreview=null,settingsTimeout=null,manualDiagnosticsPending=false,manualReviewPending=false,manualClearancePaused=false;
let doctorTracerAbort=null;
// Temporary, RAM-only preimport raster. Never store it in doc, history or
// exported EPS, and never share its transferable buffer with the Worker.
const doctorMaskCache=createDoctorTracerMaskCache();
let importMaskAbort=null,importMaskActive=false;
let manualFocus=null,manualLocalTimer=null,manualLocalGeneration=0;

let localEditors=new Map(),localEditUndo=[],localEditRedo=[],localEditCount=0;
let localEditorIndexes=new Map(),localPatchElements=new Map();
let manualGlyphBuildUnit=0,manualZoomFrame=0,manualZoomRegion=null,manualZoomDirty=true;
let manualPendingView=null,manualGlyphScaleUnit=0;
let manualPathBounds=null,manualSceneHeavy=null,manualGlyphCenter=null,
  manualViewportCenter=null,manualScreenRect=null;
const localPatchKey=(path,segment)=>path+':'+segment;
function syncLocalPatches({path=null,segments=null,reset=false}={}){
  const layer=$('manual-patches');
  if(reset){
    layer.replaceChildren();localPatchElements.clear();
    for(const [p,editor] of localEditors)
      for(const piece of editor.affectedSVG()){
        const elNode=el('path',{class:'manual-staged-segment',d:piece.d,
          'data-path':p,'data-local-segment':piece.key},layer);
        localPatchElements.set(localPatchKey(p,piece.key),elNode);
      }
    return;
  }
  if(path===null)return;
  const editor=localEditors.get(path);
  if(!editor)return;
  const visible=editor.affectedSVG(segments),keep=new Set();
  for(const piece of visible){
    const key=localPatchKey(path,piece.key);
    keep.add(key);
    let node=localPatchElements.get(key);
    if(node)node.setAttribute('d',piece.d);
    else{
      node=el('path',{class:'manual-staged-segment',d:piece.d,
        'data-path':path,'data-local-segment':piece.key},layer);
      localPatchElements.set(key,node);
    }
  }
  // A move returning a segment to its original coordinates removes the
  // now-unnecessary overlay without touching the underlying source figure.
  for(const segment of segments||[]){
    const key=localPatchKey(path,segment);
    if(keep.has(key))continue;
    const stale=localPatchElements.get(key);
    if(stale){stale.remove();localPatchElements.delete(key);}
  }
}
function localEditor(path){
  if(!doc.paths[path]||doc.paths[path].kind==='image')return null;
  if(!localEditors.has(path)){
    const editor=createDeferredCurveEditor(doc.paths[path]);
    localEditors.set(path,editor);
    localEditorIndexes.set(path,buildAnchorIndex(editor.nodeList()));
  }
  return localEditors.get(path);
}
function resetLocalEditors(){
  localEditors.clear();localEditorIndexes.clear();localPatchElements.clear();
  localEditUndo=[];localEditRedo=[];localEditCount=0;
  $('manual-patches').replaceChildren();
  $('manual-glyphs').replaceChildren();
  $('manual-local-geometry').replaceChildren();
  if(manualZoomFrame)cancelAnimationFrame(manualZoomFrame);
  manualZoomFrame=0;manualGlyphBuildUnit=0;manualZoomRegion=null;
  manualPendingView=null;manualGlyphScaleUnit=0;
  manualZoomDirty=true;manualPathBounds=null;manualSceneHeavy=null;
  manualGlyphCenter=null;manualViewportCenter=null;manualScreenRect=null;
  document.body.classList.remove('local-editor-active','manual-local-zoom');
}
function localEditorToolbar(){
  const active=curveEditing()&&activeCurveNode;
  for(const name of ['move','add','remove','handles'])
    $('node-'+name).classList.toggle('active',nodeTool===name);
  $('canvas').dataset.nodeTool=curveEditing()?nodeTool:'';
  $('canvas').style.cursor=curveEditing()?
    (nodeTool==='add'?plusCursor:nodeTool==='remove'?minusCursor:nodeTool==='handles'?'crosshair':''):'';
  for(const name of ['cusp','smooth','symmetric','line','curve','break','close','reverse'])
    $('node-'+name).disabled=busy||!active;
  $('undo').disabled=busy||!(localEditUndo.length||past.length);
  $('redo').disabled=busy||!(localEditRedo.length||future.length);
  $('node-hint').textContent=active?
    'Локальное редактирование узла '+(active.index+1)+' · изменения фигуры и диагностика после выхода.':
    'Локальный режим: выберите узел. Исходная фигура не изменяется до кнопки «Готово».';
}
// On deep zoom, hide the original compound Béziers from painting and show
// ONLY native segments intersecting the current viewport; no source rewrite.
function nearbyManualPaths(center,radius){
  // Compute once per editor session, not once per wheel/animation frame.
  if(!manualPathBounds)manualPathBounds=doc.paths.map((p,i)=>{
    const bounds=manualVectorBounds(p);
    return bounds?{path:i,...bounds}:null;
  }).filter(Boolean);
  return manualPathBounds.filter(b=>b.x1>=center[0]-radius&&b.x0<=center[0]+radius&&
    b.y1>=center[1]-radius&&b.y0<=center[1]+radius)
    .sort((a,b)=>{
      const distance=v=>Math.hypot(Math.max(v.x0-center[0],0,center[0]-v.x1),
        Math.max(v.y0-center[1],0,center[1]-v.y1));
      return distance(a)-distance(b);
    });
}
function refreshLocalZoomGeometry(){
  const layer=$('manual-local-geometry'),view=$('canvas').viewBox.baseVal;
  // A single imported 7k-command compound path is as expensive as hundreds
  // of objects. Cache scene complexity once per editor session, never per wheel.
  if(manualSceneHeavy===null)manualSceneHeavy=heavyManualScene(doc.paths);
  const active=curveEditing()&&manualSceneHeavy&&
    view.width<doc.width*1.13&&view.height<doc.height*1.13;
  if(!active){
    document.body.classList.remove('manual-local-zoom');
    if(layer.childElementCount)layer.replaceChildren();
    manualZoomRegion=null;return;
  }
  const center=[view.x+view.width/2,view.y+view.height/2];
  const span=Math.hypot(view.width,view.height);
  // Keep the previous Bézier viewport margin while it still encompasses
  // all visible pixels. Wheel events no longer rebuild the SVG d attribute.
  const cached=manualZoomRegion;
  if(!manualZoomDirty&&cached&&
    (!cached.limited||Math.max(span/cached.span,cached.span/span)<1.35&&
      Math.hypot(center[0]-cached.center[0],center[1]-cached.center[1])<span*.2)&&
    Math.hypot(center[0]-cached.center[0],center[1]-cached.center[1])+
    span*.51<=cached.radius){
    document.body.classList.add('manual-local-zoom');return;
  }
  const desired=span*1.65;
  const focus=manualFocus?.path;
  const neighbors=nearbyManualPaths(center,desired);
  const chosen=neighbors.slice(0,24);
  if(Number.isInteger(focus)&&doc.paths[focus]&&!chosen.some(v=>v.path===focus))
    chosen.unshift({path:focus});
  const fragments=[],hitPaths=[];
  let available=600;
  for(const {path} of chosen){
    if(available<=0)break;
    const editor=localEditor(path);
    if(!editor)continue;
    const segments=editor.visibleSegmentSVG(center,desired,{limit:available});
    if(!segments.length)continue;
    const d=segments.map(s=>s.d).join(' ');
    fragments.push(d);available-=segments.length;
    hitPaths.push({path,d});
  }
  if(!fragments.length){
    // Nothing nearby: avoid resurrecting the 1975-vector SVG. Keep
    // a deliberately empty local layer; the source remains untouched.
    layer.replaceChildren();
    manualZoomRegion={center,radius:desired,span,limited:false};
    manualZoomDirty=false;
    document.body.classList.add('manual-local-zoom');return;
  }
  // One bounded SVG polyline for everything near the viewport (not the
  // imported artwork). Individual transparent hit paths retain path ids.
  layer.replaceChildren();
  for(const {path,d} of hitPaths)
    el('path',{class:'manual-local-hit','data-path':path,d},layer);
  el('path',{class:'manual-local-stroke',d:fragments.join(' ')},layer);
  const unit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  const marks=issues.filter(q=>q?.point&&q.point[0]>=center[0]-view.width*.65&&
    q.point[0]<=center[0]+view.width*.65&&q.point[1]>=center[1]-view.height*.65&&
    q.point[1]<=center[1]+view.height*.65).slice(0,80);
  for(const mark of marks)el('circle',{cx:mark.point[0],cy:mark.point[1],
    r:unit*6,class:'manual-local-issue'},layer);
  manualZoomRegion={center,radius:desired,span,limited:available===0||neighbors.length>chosen.length};
  manualZoomDirty=false;
  document.body.classList.add('manual-local-zoom');
}
function rescaleLocalEditorGlyphs(unit){
  manualGlyphScaleUnit=unit;
  const glyphs=$('manual-glyphs');
  for(const item of glyphs.children){
    if(!item.hasAttribute('data-mm-x'))continue;
    const x=Number(item.getAttribute('data-mm-x')),y=Number(item.getAttribute('data-mm-y'));
    if(item.localName==='rect'){
      item.setAttribute('x',x-unit*4.2);item.setAttribute('y',y-unit*4.2);
      item.setAttribute('width',unit*8.4);item.setAttribute('height',unit*8.4);
    }else if(item.localName==='circle')item.setAttribute('r',unit*4.5);
    else if(item.localName==='polygon')item.setAttribute('points',
      [[x,y-unit*5.2],[x+unit*5.2,y],[x,y+unit*5.2],[x-unit*5.2,y]]
        .map(p=>p.join(',')).join(' '));
  }
}
function scheduleManualZoomRefresh(){
  if(!curveEditing()||manualZoomFrame)return;
  manualZoomFrame=requestAnimationFrame(()=>{
    manualZoomFrame=0;
    if(!curveEditing())return;
    if(manualPendingView){
      const {x,y,width,height}=manualPendingView;manualPendingView=null;
      $('canvas').setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
    }
    const view=$('canvas').viewBox.baseVal,
      unit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
    if(!manualFocus){
      const path=[...selected].find(i=>doc.paths[i]?.kind!=='image');
      if(Number.isInteger(path))manualFocus={path,
        point:[view.x+view.width/2,view.y+view.height/2]};
    }
    const center=[view.x+view.width/2,view.y+view.height/2];
    const glyphRadius=Math.max(unit*90,settingNumber('tolerance')*2);
    const moved=manualViewportCenter&&Math.hypot(center[0]-manualViewportCenter[0],
      center[1]-manualViewportCenter[1])>glyphRadius;
    // Rebuild nearby anchors when panning outside the glyph neighbourhood.
    // Glyph icons are re-created only after a significant zoom change;
    // the native Bézier layer is recycled across many wheel frames.
    if(!manualGlyphBuildUnit||moved||Math.max(unit/manualGlyphBuildUnit,
      manualGlyphBuildUnit/unit)>1.8)drawLocalEditorOverlay();
    else {
      if(!manualGlyphScaleUnit||Math.max(unit/manualGlyphScaleUnit,manualGlyphScaleUnit/unit)>1.12)
        rescaleLocalEditorGlyphs(unit);
      refreshLocalZoomGeometry();
    }
  });
}
function drawLocalEditorOverlay(){
  if(!curveEditing()||!localEditors.size)return;
  document.body.classList.add('local-editor-active');
  // The staged segments stay mounted across clicks, panning and mouseup.
  // Only the <=200 nearby glyphs are replaced, never all accumulated patches.
  const glyphs=$('manual-glyphs');glyphs.replaceChildren();
  if(!manualFocus)return;
  const path=manualFocus.path,editor=localEditor(path);
  if(!editor)return;
  let indexed=localEditorIndexes.get(path);
  if(!indexed){indexed=buildAnchorIndex(editor.nodeList());localEditorIndexes.set(path,indexed);}
  const view=$('canvas').viewBox.baseVal,
    unit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  manualGlyphBuildUnit=unit;
  manualGlyphScaleUnit=unit;
  const focus=manualFocus.point;
  const center=[view.x+view.width/2,view.y+view.height/2];
  const glyphCenter=Math.abs(focus[0]-center[0])<=view.width*.65&&
    Math.abs(focus[1]-center[1])<=view.height*.65?focus:center;
  manualGlyphCenter=glyphCenter;manualViewportCenter=center;
  const near=nearbyAnchors(indexed,glyphCenter,Math.max(unit*135,settingNumber('tolerance')*3),
    {limit:200,includeIndex:activeCurveNode?.path===path?activeCurveNode.index:null});
  const seen=new Set();
  for(const n of near){
    const pos=editor.nodePosition(n.index)||n.point;
    seen.add(n.index);
    const selected=activeCurveNode?.path===path&&activeCurveNode.index===n.index,
      kind=editor.getNode(n.index)?.type||n.type;
    const attrs={'data-path':path,'data-curve-node':n.index,
      'data-mm-x':pos[0],'data-mm-y':pos[1],
      class:'curve-node'+(selected?' chosen':'')};
    if(kind==='smooth')el('circle',{...attrs,cx:pos[0],cy:pos[1],r:unit*4.5},glyphs);
    else if(kind==='symmetric')el('polygon',{...attrs,
      points:[[pos[0],pos[1]-unit*5.2],[pos[0]+unit*5.2,pos[1]],
        [pos[0],pos[1]+unit*5.2],[pos[0]-unit*5.2,pos[1]]]
        .map(p=>p.join(',')).join(' ')},glyphs);
    else el('rect',{...attrs,x:pos[0]-unit*4.2,y:pos[1]-unit*4.2,
      width:unit*8.4,height:unit*8.4},glyphs);
  }
  if(activeCurveNode?.path===path){
    const patch=editor.viewPatch(activeCurveNode.index);
    if(patch){
      for(const [side,points] of [['in',patch.incoming],['out',patch.outgoing]]){
        if(!points||points.length<2)continue;
        const control=side==='in'?points.at(-2):points[1],anchor=patch.point;
        el('path',{d:'M'+anchor.join(' ')+'L'+control.join(' '),
          class:'curve-tangent-guide'},glyphs);
        el('circle',{cx:control[0],cy:control[1],r:unit*4.5,
          'data-mm-x':control[0],'data-mm-y':control[1],
          class:'curve-control-handle','data-path':path,
          'data-curve-node':activeCurveNode.index,'data-curve-handle':side},glyphs);
      }
    }
  }
  localEditorToolbar();
  refreshLocalZoomGeometry();
}
function localEditorModified(path,action,changedSegments=null){
  if(!curveEditing())return;
  localEditUndo.push(path);localEditRedo=[];localEditCount++;
  manualDiagnosticsPending=true;diagnosticComplete=false;
  record('manual-staged-'+action,{path,edits:localEditCount,
    geometryCommitted:false,fullDiagnosticDeferred:false,diagnosticOnDemand:true});
  // Keep the original spatial index during repeated point moves; rebuilding
  // thousands of anchors here was the last O(N) cost on every mouseup.
  // A move or handle drag touches only 1..3 native segments. Structural
  // changes can renumber commands, so rebuild their overlay just once.
  if(changedSegments)syncLocalPatches({path,segments:changedSegments});
  else syncLocalPatches({reset:true});
  manualZoomDirty=true;
  drawLocalEditorOverlay();
  status('Локальная правка сохранена в редакторе ('+localEditCount+
    '). После «Готово» поиск дефектов не запускается.');
}
function exitDeferredCurveEditor(){
  clearTimeout(manualLocalTimer);++manualLocalGeneration;
  clearTimeout(clearanceTimer);clearanceWorker?.terminate();clearanceWorker=null;
  ++clearanceJob;clearanceKey='';
  const updated=new Map();
  try{
    for(const [path,editor] of localEditors){
      if(!editor.modified())continue;
      const snapshot=editor.finish();
      updated.set(path,finishDeferredCurveCommands(
        doc.paths[path],snapshot.commands,snapshot.nodeKinds));
    }
  }catch(error){
    status('Не удалось сохранить локальные изменения: '+error.message+
      '. Режим редактора сохранён, исходная фигура не тронута.');
    return false;
  }
  const operations=localEditCount;
  suppressNextDiagnostic=true;manualClearancePaused=true;
  clearTimeout(settingsTimeout);
  if(updated.size)checkpoint();
  for(const [path,vector] of updated)doc.paths[path]=vector;
  mode='select';activeCurveNode=null;manualFocus=null;resetLocalEditors();
  if(updated.size){
    record('manual-batch-commit',{paths:[...updated.keys()],operations});
    changed('curve-session-commit',{skipDiagnostics:true});
  }else render();
  status(updated.size?'Локальные изменения применены без повторного поиска дефектов. Для проверки нажмите «Проверить дефекты».':
    'Редактор закрыт без изменений. Диагностика не запускалась.');
  return true;
}

let anchorViewportCache=new WeakMap();
function editorAnchorCache(path){
  let indexed=anchorViewportCache.get(path);
  if(!indexed){indexed=buildAnchorIndex(curveNodesTyped(path));anchorViewportCache.set(path,indexed);}
  return indexed;
}
let importedBefore=null;
let comparisonSelectionExplicit=false; // user choice wins over automated re-diagnosis
let doc={format:'relief-forge',version:1,width:300,height:200,paths:[]},selected=new Set(),issues=[],metrics=[],past=[],future=[],mode='select',draft=[],drag=null,pan=null,worker,ready=false,pending=null,sequence=0,busy=false;
let epsWorker=null,epsTimer=null,epsImportActive=false;let importFonts=[];
let diagnosticGeneration=0,readGeneration=0,readActive=false,openingFile=false,previewGeneration=0,previewActive=false,suppressNextDiagnostic=false,afterDiagnosticGeneration=0;
const historyStorage=(()=>{try{return window.localStorage}catch{return null}})();
let fileHistory=readHistory(historyStorage),activeHistoryId=null;
const journal=[];const clone=v=>structuredClone(v);
let workspaceHealth=null,workspaceChecks=0,workspaceCheckTimer=null,forceWireframe=false;
let lastImportAttempt=null,lastImportFailure=null;
const displayErrors=[];
window.addEventListener('error',e=>{displayErrors.push(String(e.message||'Unknown error'));if(displayErrors.length>25)displayErrors.shift();});
window.addEventListener('unhandledrejection',e=>{displayErrors.push(String(e.reason?.message||e.reason||'Unhandled rejection'));if(displayErrors.length>25)displayErrors.shift();});
function record(action,detail={}){journal.push({at:new Date().toISOString(),action,detail});}
function status(s){$('status').textContent=String(s).split('\n')[0];$('status').title=s;}
function progressStage(stage,percent,detail=''){
  const n=Math.max(0,Math.min(100,Math.round(percent)));
  $('task-status').hidden=false;
  $('task-progress').value=n;$('import-progress').value=n;
  $('task-stage').textContent=stage;$('busy-label').textContent=stage;
  $('task-percent').textContent=n+'%';$('task-count').textContent=detail;
}
function endProgress(){if(!busy)$('task-status').hidden=true;}
function showLargeFileNotice(report){
  const node=$('large-file-warning');
  const message=largeFileWarning(report);
  node.hidden=!message;
  node.textContent=message;
  if(message)record('large-file-warning',{contours:report.contours||0,segments:(report.curves||0)+(report.lines||0),points:report.totalPoints||0});
}
const yieldForUi=()=>new Promise(resolve=>setTimeout(resolve,0));
function checkpoint(before=doc){past.push(clone(before));if(past.length>100)past.shift();future=[];}
function renderFileHistory(){
  const rows=$('file-history-rows');rows.replaceChildren();
  $('file-history-count').textContent=fileHistory.length;
  if(!fileHistory.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=3;td.textContent='Файлы пока не открывались';tr.append(td);rows.append(tr);return;}
  for(const entry of fileHistory){
    const tr=document.createElement('tr');
    for(const [value,cls] of [[formatHistoryDate(entry.openedAt),'date'],[entry.filename,'filename'],[formatHistoryStatus(entry),'result']]){
      const td=document.createElement('td');td.textContent=value;td.className=cls;td.title=value;tr.append(td);
    }
    rows.append(tr);
  }
}
function updateFileHistory(patch){
  if(!activeHistoryId)return;
  fileHistory=updateHistoryEntry(fileHistory,activeHistoryId,patch);
  if(!persistHistory(historyStorage,fileHistory))$('file-history-note').textContent='Сохранение истории недоступно в этом браузере.';
  renderFileHistory();
}
function beginFileHistory(filename){
  const name=basename(filename);
  activeHistoryId=new Date().toISOString()+'-'+Math.random().toString(36).slice(2,12);
  fileHistory=createHistoryEntry(fileHistory,{id:activeHistoryId,filename:name,openedAt:new Date().toISOString()});
  if(!persistHistory(historyStorage,fileHistory))$('file-history-note').textContent='Сохранение истории недоступно в этом браузере.';
  renderFileHistory();
  return activeHistoryId;
}
function changed(action,{skipDiagnostics=false}={}){
  // A cached 600dpi silhouette is valid ONLY for the exact imported geometry.
  // Any committed edit invalidates it before another preview can reference it.
  if(!action.startsWith('import-'))doctorMaskCache.invalidate();
  suppressNextDiagnostic=skipDiagnostics;comparisonSelectionExplicit=false;
  manualReviewPending=skipDiagnostics;
  manualClearancePaused=skipDiagnostics;
  if(skipDiagnostics){
    // After a committed manual session only repaint the stored vectors.
    // Clear queued whole-document work and do not silently treat zero
    // displayed markers as a clean diagnostics result.
    clearTimeout(settingsTimeout);clearTimeout(clearanceTimer);
    clearanceWorker?.terminate();clearanceWorker=null;
    ++clearanceJob;clearanceKey='';clearanceReport=null;
  }
  if(importedBefore&&!action.startsWith('import-'))importedBefore.pending=false;
  if(!action.startsWith('curve-node')&&action!=='move-nodes')activeCurveNode=null;
  // During manual Bézier editing, the previous witnessed defects remain visible
  // while the changed geometry is rechecked. Only a successful new scan may
  // remove them; clearing here falsely makes an unhealed point look healthy.
  if(skipDiagnostics){
    issues=[];metrics=[];diagnosticComplete=false;manualDiagnosticsPending=false;
  }else if(retainsIssuesDuringManualChange(mode,action)){
    manualDiagnosticsPending=true;
    diagnosticComplete=false;
  }else{
    issues=[];metrics=[];diagnosticComplete=true;manualDiagnosticsPending=false;
  }
  markersVisible=true;preparingComparison=null;appliedComparison=null;curvePreview=null;compareStage='before';
  if(activeHistoryId&&!action.startsWith('import-')&&action!=='auto-apply')
    updateFileHistory({status:'Изменён · требуется повторная проверка',diagnosis:null,repair:null});
  record(action,{paths:doc.paths.length,nodes:doc.paths.reduce((n,p)=>n+p.points.length,0),
    diagnosticOnDemand:skipDiagnostics});
  render();
  if(skipDiagnostics)return;
  if(retainsIssuesDuringManualChange(mode,action))scheduleManualLocalRecheck();
  else if(!action.startsWith('import-')&&action!=='unified-apply')requestRecalculation();
}
function scheduleManualLocalRecheck(){
  if(!curveEditing()||!manualFocus)return;
  clearTimeout(manualLocalTimer);
  const generation=++manualLocalGeneration;
  const focus={...manualFocus,point:[...manualFocus.point]};
  const view=$('canvas').viewBox.baseVal,unit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  const tolerance=settingNumber('tolerance');
  manualLocalTimer=setTimeout(()=>{
    if(generation!==manualLocalGeneration||!curveEditing()||busy)return;
    const radius=localNodeRadius(unit,tolerance);
    const report=diagnoseLocalNodeArea(doc,issues,{...focus,radius,tolerance});
    if(generation!==manualLocalGeneration)return;
    if(report.verified)issues=report.issues;
    manualDiagnosticsPending=false;
    // A local success cannot certify that untouched EPS sections are healthy.
    diagnosticComplete=false;
    record('manual-local-diagnosis',{path:focus.path,point:focus.point,radius,
      localCount:report.localCount,examined:report.examined,verified:report.verified,reason:report.reason});
    render();
    status(report.verified?
      'Локально перепроверена область '+Math.round(radius/unit)+' пикселей вокруг курсора. Остальной документ не пересчитывался.':
      'Локальная проверка не подтверждена ('+report.reason+'). Прежние маркеры сохранены.');
  },50);
}
let viewPendingBox=null,viewZoomFrame=0,refreshViewDecorations=null;
function cancelViewZoom(){
  if(viewZoomFrame)cancelAnimationFrame(viewZoomFrame);
  viewZoomFrame=0;viewPendingBox=null;
}
function scheduleViewZoomRefresh(){
  if(curveEditing()||viewZoomFrame)return;
  viewZoomFrame=requestAnimationFrame(()=>{
    viewZoomFrame=0;
    if(curveEditing()){viewPendingBox=null;return;}
    const canvas=$('canvas');
    if(viewPendingBox){
      const {x,y,width,height}=viewPendingBox;viewPendingBox=null;
      canvas.setAttribute('viewBox',`${x} ${y} ${width} ${height}`);
    }
    refreshViewDecorations?.(screenUnitsPerPixel(canvas.viewBox.baseVal,canvas.clientWidth,canvas.clientHeight));
  });
}
function fit(){cancelViewZoom();const pad=Math.max(doc.width,doc.height)*.07;
  manualPendingView=null;
  $('canvas').setAttribute('viewBox',`${-pad} ${-pad} ${doc.width+pad*2} ${doc.height+pad*2}`);
  if(curveEditing()){refreshLocalZoomGeometry();scheduleManualZoomRefresh();}
  else if(refreshViewDecorations)scheduleViewZoomRefresh();else render();
}
let preparingComparison=null;
const currentComparison=()=>curvePreview?.comparisonData||preparingComparison||appliedComparison;
function zoom(factor,center){
  const box=(curveEditing()?manualPendingView:viewPendingBox)||$('canvas').viewBox.baseVal,
    view=zoomBox({x:box.x,y:box.y,width:box.width,height:box.height},factor,center);
  if(!view)return;
  if(curveEditing()){
    // Accumulate cursor-anchored wheel transforms without touching SVG or
    // querying native geometry for each event. One RAF commits the final view
    // and isolates heavy artwork before that frame can paint.
    manualPendingView=view;
    scheduleManualZoomRefresh();
  }else{
    viewPendingBox=view;
    scheduleViewZoomRefresh();
  }
}
function focusIssue(issue){
  cancelViewZoom();manualPendingView=null;
  const canvas=$('canvas'),view=canvas.viewBox.baseVal;
  const rawTolerance=settingNumber('tolerance');
  const tolerance=Number.isFinite(rawTolerance)&&rawTolerance>0?rawTolerance:0.01;
  const next=issueViewBox({x:view.x,y:view.y,width:view.width,height:view.height},issue.point,doc,tolerance);
  if(!next){status('Невозможно перейти к замечанию: неверные координаты.');return;}
  if(!currentComparison())selected=new Set([issue.path,issue.other].filter(i=>Number.isInteger(i)&&i>=0&&i<doc.paths.length));
  canvas.setAttribute('viewBox',`${next.x} ${next.y} ${next.width} ${next.height}`);
  record('focus-issue',{kind:issue.kind,path:issue.path,other:issue.other,point:issue.point});
  if(curveEditing()){manualFocus={path:issue.path,point:[...issue.point]};drawLocalEditorOverlay();}
  else render();
}
function el(tag,attrs,parent){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
const pathData=worldData;
const svgMarkupCache=new Map();
function appendMarkup(parent,text){
  // Reuse parsed XML on pan/zoom and pointer drags; keep the cache small to
  // avoid retaining huge EPS/SVG trees after opening another document.
  let parsed=svgMarkupCache.get(text);
  if(!parsed){parsed=new DOMParser().parseFromString('<svg xmlns="'+ns+'" xmlns:xlink="http://www.w3.org/1999/xlink">'+text+'</svg>','image/svg+xml');
    if(text.length<250000){if(svgMarkupCache.size>=24)svgMarkupCache.delete(svgMarkupCache.keys().next().value);svgMarkupCache.set(text,parsed);}
  }
  for(const child of parsed.documentElement.children)parent.append(document.importNode(child,true));
}
function workspaceScan({attemptRepair=false,manual=false}={}){
  if(!lastImportFailure&&!doc.paths.length&&!doc.sourceFileName&&!doc.pdfImport&&!doc.epsImport){
    // Initial empty canvas is not an import failure.
    if(manual)status('Документ ещё не открыт. Рабочее поле готово к импорту.');
    return null;
  }
  const parts={canvas:$('canvas'),workspace:$('drop-target'),geometry:$('geometry'),
    mascot:$('mascot-welcome'),overlay:$('drop-overlay'),
    documentPaths:doc.paths.length,
    documentLoaded:Boolean(doc.paths.length||doc.sourceFileName||doc.pdfImport||doc.epsImport),
    documentType:doc.epsImport?'eps':doc.pdfImport?'pdf':
      /\.svg$/i.test(doc.sourceFileName||'')?'svg':'project',
    importFailure:lastImportFailure};
  let health=inspectWorkspace(parts),repairs=[];
  if(attemptRepair&&!health.ok){
    repairs=recoverWorkspace(health,parts);
    if(health.issues.includes('empty-svg')||health.issues.includes('invalid-geometry-bounds')){
      // Rebuild only from existing document geometry, never re-import.
      render();
      repairs.push('redraw');
    }
    health=inspectWorkspace(parts);
  }
  workspaceHealth=health;
  workspaceChecks++;
  const state=$('workspace-health-state');
  state.textContent=health.ok?'Рабочее поле: проверено':'Рабочее поле: '+shortWorkspaceDiagnosis(health);
  state.hidden=health.ok&&!manual;
  state.dataset.health=health.ok?'ok':'warning';
  $('workspace-health-report').value=safeWorkspaceReport(health,{
    version:'0.2.0-alpha.75',source:lastImportFailure?.source||doc.sourceFileName||'',
    errors:displayErrors});
  record('workspace-health',{ok:health.ok,issues:health.issues,forceWireframe,attempts:repairs,
    count:health.elementCount,rect:health.canvasRect,bbox:health.geometryBox});
  if(!health.ok)status('Проверка рабочего поля: '+shortWorkspaceDiagnosis(health)+
    (repairs.length?' · выполнено: '+repairs.join(', '):'')+
    '. Откройте «Проверка рабочего поля» для отчёта.');
  else if(repairs.length)status('Отображение рабочего поля восстановлено: '+repairs.join(', '));
  if(manual&&health.ok&&forceWireframe)status('Контурный режим включён: отображаются исходные векторные команды без оформления.');
  return health;
}
function scheduleWorkspaceCheck(){
  clearTimeout(workspaceCheckTimer);
  // Styles and images can settle after the first layout; check again once.
  workspaceCheckTimer=setTimeout(()=>{
    if(openingFile||readActive||epsImportActive)return;
    const result=workspaceScan({attemptRepair:true});
    if(result&&!result.ok)workspaceCheckTimer=setTimeout(()=>{
      if(!openingFile&&!readActive&&!epsImportActive)
        workspaceScan({attemptRepair:true});
    },850);
  },160);
}
$('workspace-check').onclick=()=>{
  const health=workspaceScan({attemptRepair:true,manual:true});
  $('workspace-health-report').value=safeWorkspaceReport(health||{
    ok:true,issues:[],note:'Документ не открыт'},{
    version:'0.2.0-alpha.75',source:lastImportFailure?.source||doc.sourceFileName||'',errors:displayErrors});
  $('workspace-health-dialog').showModal();
};
$('workspace-check-repair').onclick=()=>{
  workspaceScan({attemptRepair:true,manual:true});
};
$('workspace-check-copy').onclick=async()=>{
  const value=$('workspace-health-report').value;
  try{await navigator.clipboard.writeText(value);status('Отчёт о рабочем поле скопирован.');}
  catch{ $('workspace-health-report').focus();$('workspace-health-report').select();
    status('Скопируйте выделенный диагностический отчёт клавишами Ctrl+C.');}
};
$('workspace-check-close').onclick=()=>$('workspace-health-dialog').close();
function syncWireframeControl(){
  $('workspace-check-wireframe').textContent=forceWireframe?'Обычное отображение':'Показать контуры';
  $('workspace-check-wireframe').setAttribute('aria-pressed',String(forceWireframe));
}
$('workspace-check-wireframe').onclick=()=>{
  forceWireframe=!forceWireframe;syncWireframeControl();render();
  workspaceScan({attemptRepair:true,manual:true});
  record('workspace-wireframe-mode',{enabled:forceWireframe,source:doc.sourceFileName||null});
};

function updateMascot(){return syncWorkspaceMascot($('mascot-welcome'),$('drop-target'),{hasDocument:Boolean(doc.paths.length||doc.sourceFileName||doc.epsImport||doc.pdfImport),importing:openingFile});}
function syncWorkspaceFileLabel(){
  // Reflect the last successfully opened document, never an in-flight or failed import.
  const name=basename(doc.sourceFileName||doc.epsImport?.name||doc.pdfImport?.name||'');
  const badge=$('workspace-file');
  badge.hidden=!name;
  $('workspace-filename').textContent=name;
  badge.title=name?('Исходный файл: '+name):'';
}
function render(){
  syncWorkspaceFileLabel();
  cancelViewZoom();manualScreenRect=null;
  document.body.classList.toggle('curve-editing',curveEditing());
  updateMascot();
  $('curve-node-tools').hidden=!curveEditing();
  if(curveEditing())$('optimization-result').textContent='Редактируются реальные опорные точки команд M/L/C/Q текущей геометрии. Ручки Безье отображаются у соответствующих C-сегментов. Undo доступен.';
  $('curve-edit').classList.toggle('active',curveEditing());
  $('curve-edit').setAttribute('aria-pressed',String(curveEditing()));
  for(const tool of ['move','add','remove','handles'])$('node-'+tool).classList.toggle('active',nodeTool===tool);
  $('canvas').dataset.nodeTool=curveEditing()?nodeTool:'';
  $('canvas').style.cursor=curveEditing()?(nodeTool==='add'?plusCursor:nodeTool==='remove'?minusCursor:nodeTool==='handles'?'crosshair':''):'';
  const chosenNode=curveEditing()&&activeCurveNode&&doc.paths[activeCurveNode.path];
  for(const name of ['cusp','smooth','symmetric','line','curve','break','close','reverse'])$('node-'+name).disabled=busy||!chosenNode;
  for(const name of ['cusp','smooth','symmetric'])$('node-'+name).classList.toggle('active',!!chosenNode&&curveNodeType(chosenNode,activeCurveNode.index)===name);
  $('node-hint').textContent=chosenNode?'Выбран узел: '+({cusp:'Перегиб',smooth:'Сглаженное',symmetric:'Симметрическая'}[curveNodeType(chosenNode,activeCurveNode.index)])+' · перетаскивайте ручки.':'Выберите узел; «Ручки углов» — управление касательными. Правый клик — контекстное меню.';
  const comparison=currentComparison();
  const frame=activeComparisonFrame(comparison,compareStage,doc,issues);
  const visibleDoc=frame.document,visibleIssues=frame.issues;
  displayedIssues=visibleIssues;
  const reviewing=frame.readOnly;
  $('canvas').classList.toggle('is-comparing',reviewing);
  $('compare-exit').hidden=!comparison;
  $('compare-exit').disabled=busy;
  $('compare-before').disabled=busy||!comparison;
  $('compare-after').disabled=busy||!comparison;
  $('compare-prepared').disabled=busy||!comparison?.preparedDoc;
  $('compare-prepared').setAttribute('aria-pressed',String(Boolean(comparison&&compareStage==='prepared')));
  $('compare-before').setAttribute('aria-pressed',String(!comparison||compareStage==='before'));
  $('compare-after').setAttribute('aria-pressed',String(Boolean(comparison&&compareStage==='after')));
  $('compare-status').textContent=comparison?
    (compareStage==='after'?'ПОСЛЕ':compareStage==='prepared'?'ОБЪЕДИНЕНО · ДЕФЕКТЫ':'ДО')+' · '+visibleDoc.paths.length+' контуров · '+(curvePreview?('стыков '+curvePreview.stats.smoothedJoints+' · сегменты '+(compareStage==='after'?curvePreview.stats.result:curvePreview.stats.original)+(compareStage==='after'?(curvePreview.afterDiagnosed?' · замечаний '+visibleIssues.length:' · проверка после выполняется'):' · исходные')):visibleIssues.length+' замечаний')+(curvePreview?' · автоисправление':' · применено'):
    'Сравнение после автоисправления';
  if(comparison&&curvePreview&&compareStage==='after')$('compare-status').textContent+=
    ' · итоговых узлов '+curvePreview.stats.actualNodesAfter;
  if(comparison&&compareStage==='prepared')$('compare-status').textContent=
    'ОБЪЕДИНЕНО · '+visibleDoc.paths.length+' объектов · '+visibleIssues.length+' замечаний'+
    (comparison.preparedDiagnosticComplete?'':' · проверка частичная');
  if(comparison&&compareStage==='before'&&!comparison.beforeDiagnosticComplete)
    $('compare-status').textContent='ДО · исходный вектор без изменений; дефекты — на объединённой копии';
  $('width').value=doc.width;$('height').value=doc.height;$('count').textContent=visibleDoc.paths.length;
  for(const id of ['sheet','grid-bg']){$(id).setAttribute('width',visibleDoc.width);$(id).setAttribute('height',visibleDoc.height);}
  $('geometry').replaceChildren();$('nodes').replaceChildren();$('markers').replaceChildren();$('paths').replaceChildren();
  if(visibleDoc.svgDefs)appendMarkup($('geometry'),visibleDoc.svgDefs);
  const artworkCount=doc.paths.filter(p=>p.kind!=='image').length;
  const images=doc.paths.filter(p=>p.kind==='image').length;
  $('import-report').textContent=doc.pdfImport?
    'PDF · страница '+doc.pdfImport.pageNumber+' из '+doc.pdfImport.pageCount+
    ' · '+doc.width.toFixed(3)+' × '+doc.height.toFixed(3)+
    ' мм · '+artworkCount+' векторов · '+images+
    ' изображений. Кривые и текстовые контуры доступны для лечения.':
    doc.epsImport?'EPS · '+doc.width.toFixed(3)+' × '+doc.height.toFixed(3)+
      ' мм · '+artworkCount+' векторов · '+images+' изображений. '+
      ((doc.epsImport.warnings||[]).length?'Предупреждения: '+doc.epsImport.warnings.join(' · '):'Импорт завершён.'):'';

  const view=$('canvas').viewBox.baseVal;
  const markerUnit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  updateClearance(visibleDoc,markerUnit);
  const radius=Math.max(.00001,markerUnit*3.1);
  let healthyDecoration=null;
  if(reviewing&&compareStage==='after'){
    const underlay=el('g',{'data-comparison-underlay':'before','aria-hidden':'true'},$('geometry'));
    for(const original of comparison.beforeDoc.paths)if(original.kind!=='image')
      el('path',{d:worldData(original),class:'comparison-ghost'},underlay);
  }
  visibleDoc.paths.forEach((p,i)=>{
    const sel=!reviewing&&selected.has(i);
    const attrs={d:pathData(p),'data-path':i};
    if(reviewing&&p.kind!=='image'){
      // Draw the exact geometry commands, not the original imported SVG
      // markup: that artwork could still contain the unsmoothed curves.
      el('path',{...attrs,class:'comparison-path '+(compareStage==='after'?'after':'before')},$('geometry'));
    }else if(p.artwork&&!forceWireframe){
      const painted=el('g',{'data-path':i,class:visibleDoc.epsImport?.outlineRecovery?'outline-artwork':'svg-artwork'},$('geometry'));
      appendMarkup(painted,artworkMarkup(p));
      if(sel)el('path',{...attrs,class:'path selected rich-selection'},$('geometry'));
    }else el('path',{...attrs,class:'path '+(sel?'selected':'')+(forceWireframe?' wireframe-override':'')},$('geometry'));
    if(!reviewing)el('path',{...attrs,class:'hit'},$('geometry'));
    if(sel&&curveEditing()&&p.kind!=='image'){
      if(activeCurveNode?.path===i){
        const info=curveHandles(p,activeCurveNode.index);
        for(const handle of info.handles){
          const [hx,hy]=handle.point,[ax,ay]=info.anchor;
          el('path',{d:'M'+ax+' '+ay+'L'+hx+' '+hy,class:'curve-tangent-guide'},$('geometry'));
          el('circle',{cx:hx,cy:hy,r:markerUnit*4.5,class:'curve-control-handle',
            'data-path':i,'data-curve-node':activeCurveNode.index,'data-curve-handle':handle.side},$('geometry'));
        }
      }
      const indexed=editorAnchorCache(p);
      const focus=manualFocus?.path===i?manualFocus.point:
        visibleIssues.find(x=>x.path===i||x.other===i)?.point||
        [view.x+view.width/2,view.y+view.height/2];
      const workingNodes=nearbyAnchors(indexed,focus,Math.max(markerUnit*135,settingNumber('tolerance')*3),
        {limit:240,includeIndex:activeCurveNode?.path===i?activeCurveNode.index:null});
      workingNodes.forEach(node=>{
        const [cx,cy]=node.point,kind=node.type,chosen=activeCurveNode?.path===i&&activeCurveNode.index===node.index;
        const common={'data-path':i,'data-curve-node':node.index,class:'curve-node'+(chosen?' chosen':'')};
        if(kind==='smooth')el('circle',{...common,cx,cy,r:markerUnit*4.5},$('geometry'));
        else if(kind==='symmetric')el('polygon',{...common,points:[[cx,cy-markerUnit*5.2],[cx+markerUnit*5.2,cy],[cx,cy+markerUnit*5.2],[cx-markerUnit*5.2,cy]].map(a=>a.join(',')).join(' ')},$('geometry'));
        else el('rect',{...common,x:cx-markerUnit*4.2,y:cy-markerUnit*4.2,width:markerUnit*8.4,height:markerUnit*8.4},$('geometry'));
      });
    }
    else if(sel&&!p.artwork)p.points.forEach(([cx,cy],node)=>el('circle',{cx,cy,r:radius,class:'node','data-path':i,'data-node':node},$('geometry')));
    const b=document.createElement('button');
    b.textContent=(i+1)+'. '+(p.kind==='image'?'Изображение':p.artwork?'EPS / SVG':p.closed?'Замкнут':'Открыт')+' · '+p.points.length+' узлов';
    b.classList.toggle('selected',sel);b.disabled=reviewing;
    b.onclick=e=>{if(!e.shiftKey)selected.clear();selected.has(i)?selected.delete(i):selected.add(i);render();if(!curveEditing())requestRecalculation();};
    $('paths').append(b);
  });
  // White-backed hollow rings always overlie the geometric stroke, at a
  // fixed screen-pixel radius. No diagnostic markup enters exported EPS.
  if(pointsVisible&&!curveEditing()){
    // Deliberately cap healthy-node decoration on dense EPS: drawing thousands
    // of hollow rings blocks the main thread but does not add diagnostics.
    const count=visibleDoc.paths.reduce((n,p)=>n+(p.points?.length||0),0);
    if(count<=2400){
      const healthy=visibleHealthyAnchors(visibleDoc,visibleIssues,settingNumber('tolerance'));
      if(healthy.length)healthyDecoration={points:healthy,element:el('path',{d:circlePath(healthy,radius),class:'healthy-anchors'},$('nodes'))};
    }
  }
  const marked=markersVisible?renderIssueMarkers($('markers'),visibleIssues,markerUnit,
    {x:0,y:0,width:visibleDoc.width,height:visibleDoc.height},
    {interactive:!curveEditing()}):0;
  $('marker-status').textContent=manualReviewPending?
    'После ручных изменений дефекты не перепроверялись. Старые маркеры скрыты.':visibleIssues.length?
    curveEditing()&&markersVisible?'В редакторе: '+marked+' маркеров проблем'+(manualDiagnosticsPending?' · идёт повторная проверка':' · не перекрывают узлы и ручки')+'.':markersVisible?'На чертеже: '+marked+' пространственно распределённых цветных маркеров'+
      (visibleIssues.length>marked?' из '+visibleIssues.length:'')+'. Нажмите кольцо, чтобы приблизить.':
      'Отметки проблем скрыты. Включите их в разделе «Видимость точек».':
    'В этой стадии проблемных мест не найдено.';
  $('draft').replaceChildren();
  if(!reviewing&&draft.length)el('path',{d:pathData({points:draft}),class:'path selected'},$('draft'));
  $('issues').replaceChildren();
  const counts={};visibleIssues.forEach(x=>counts[x.kind]=(counts[x.kind]||0)+1);
  if(manualReviewPending)$('summary').textContent='Диагностика после ручного редактирования не выполнялась. При необходимости нажмите «Проверить дефекты».';
  else if(manualDiagnosticsPending&&curveEditing())$('summary').textContent='Локальные изменения не проверены. Прежние маркеры показаны только как подсказка.';
  else if(!diagnosticComplete&&!comparison)$('summary').textContent='Диагностика частичная: лимит точек, блоки или ограничения движка. Найдено замечаний: '+visibleIssues.length+'. Межблочные дефекты не исключены.';
  else if(visibleIssues.length)$('summary').textContent='Замечаний: '+visibleIssues.length+' · '+Object.entries(counts).slice(0,2).map(([k,n])=>(names[k]||k)+': '+n).join(' · ');
  else $('summary').textContent=curvePreview&&compareStage==='after'&&!curvePreview.afterDiagnosed?'Диагностика оптимизированного результата пока недоступна.':comparison?'Для этой стадии замечаний не найдено.':metrics.length?'Проверка завершена: замечаний не найдено.':'Откройте SVG или нарисуйте векторы.';
  $('summary').title=Object.entries(counts).map(([k,n])=>(names[k]||k)+': '+n).join(' · ');
  $('issue-count').textContent=manualReviewPending?'—':visibleIssues.length;
  visibleIssues.slice(0,100).forEach((x,i)=>{
    const b=document.createElement('button');b.className='issue';
    b.textContent=(i+1)+'. '+(names[x.kind]||x.kind)+' · '+(x.path+1)+(x.other!==x.path?' ↔ '+(x.other+1):'')+issueDistanceLabel(x);
    b.title='Перейти к X '+x.point[0].toFixed(3)+' · Y '+x.point[1].toFixed(3)+' мм';
    b.onclick=()=>focusIssue(x);$('issues').append(b);
  });
  $('toggle-points-label').textContent=pointsVisible?'Скрыть здоровые точки':'Показать здоровые точки';
  $('toggle-markers-label').textContent=markersVisible?'Скрыть маркеры':'Показать маркеры';
  $('apply-changes').disabled=busy||!ready||!doc.paths.some(p=>p.kind!=='image')||
    (!settingsDirty&&(!curvePreview||!curvePreview.hasGeometryChange));
  $('auto-status').textContent=busy?'Идёт расчёт…':manualReviewPending?'Ручные правки сохранены · проверка дефектов не выполнялась.':curveEditing()?'Редактирование узлов · Ctrl+Z — отмена.':curvePreview?'Предварительный результат рассчитан, просмотрите ПОСЛЕ.':appliedComparison?'Изменения применены. ДО / ПОСЛЕ доступны для проверки.':doc.paths.length?'Проверка и расчёт после открытия файла.':'Откройте файл для автоматической проверки.';
  $('toggle-markers').disabled=busy||!(visibleIssues.length||clearanceReport?.markers.length);
  $('recheck-defects').disabled=busy||!ready||curveEditing()||reviewing||
    !doc.paths.some(p=>p.kind!=='image');
  $('undo').disabled=busy||!past.length;$('redo').disabled=busy||!future.length;
  $('delete').disabled=busy||reviewing||curveEditing();
  for(const id of ['new','line','rect','circle','select'])$(id).disabled=busy||reviewing;
  // Diagnostics run automatically after opening/changing a document or settings.
  document.querySelectorAll('[data-action]').forEach(b=>b.disabled=busy||!ready||reviewing);
  refreshViewDecorations=curveEditing()?null:cacheViewDecorations($('geometry'),$('markers'),$('clearance-markers'),markerUnit,healthyDecoration,settingNumber('clearance-threshold'));
}
function lock(value,{coverCanvas=true}={}){
  busy=value;
  if(value)progressStage('Подготовка векторов…',0);
  $('busy').hidden=!value;$('busy').classList.toggle('compact',value&&!coverCanvas);
  document.querySelectorAll('button,input').forEach(e=>{if(e.id!=='cancel'&&e.id!=='log')e.disabled=value;});
  if(!value){endProgress();render();}
}

// One source of truth for copy -> Union/compound -> diagnose -> repair.
async function prepareWorkingCopy(source,scope,generation){
  const tolerance=settingNumber('tolerance');
  let gpu;
  const cancelled=()=>generation!==previewGeneration;
  const result=await prepareAfterCopy(source,scope,{
    cancelled,
    combine:(document,indices,options)=>runNativeJob({action:'combine',document,indices,
      options:{...options,skipFilledUnion:!settingChecked('merge-overlaps')}}),
    union:async(copy,indices)=>{
      progressStage('2/5 · Объединение копии',8);
      await yieldForUi();
      gpu=settingChecked('merge-overlaps')?await gpuBroadphase(copy,{tolerance}):
        {mode:'cpu',pairs:null,reason:'union-disabled'};
      if(cancelled())throw Error('Подготовка копии отменена');
      $('gpu-status').textContent=gpu.mode==='webgpu'?'GPU: WebGPU':'GPU: CPU fallback ('+gpu.reason+')';
      if(settingChecked('merge-overlaps'))return mergeOverlappingObjects(copy,{
        indices,tolerance,cleanupTolerance:settingNumber('optimization-tolerance'),
        gpuPairs:{...gpu,sourceCount:copy.paths.length}});
      return {document:copy,selectedIndices:indices,stats:{mergedObjects:0,removedExact:0,
        weldedGroups:0,compoundGroups:0,skipped:0,holes:0,normalizedObjects:0,
        cleanup:{coincident:0,collinear:0,short:0,shortEdgesRemaining:0,reverted:0}}};
    },
    onPrepared:async combined=>{
      // The original is intentionally unscanned. Finalize that baseline now:
      // a later manual scan of an edited document cannot label the original.
      if(importedBefore?.pending)importedBefore=captureImportBefore(importedBefore,[],false);
      curvePreview=null;
      preparingComparison={beforeDoc:clone(importedBefore?.document||source),beforeIssues:[],
        afterDoc:combined.document,afterIssues:[],preparedDoc:combined.document,preparedIssues:[],
        beforeDiagnosticComplete:false,preparedDiagnosticComplete:false};
      if(!comparisonSelectionExplicit)compareStage='prepared';
      render();await yieldForUi();
    },
    diagnose:async document=>{
      progressStage('3/5 · Поиск дефектов объединённой копии',25);
      const report=await diagnoseAfterDocument(document,tolerance,{
        runBatch:runRustDiagnostic,progress:(label,pct,detail)=>
          progressStage('3/5 · '+label,25+Math.round(pct*.3),detail),yieldUi:yieldForUi,cancelled});
      if(!report||cancelled())return null;
      const native=await runNativeJob({action:'diagnose',document,issues:report.issues,
        indices:document.paths.map((p,i)=>p.kind==='image'?null:i).filter(i=>i!==null),tolerance});
      if(cancelled())return null;
      report.issues=native.issues;report.complete=report.complete&&native.complete;
      return report;
    }
  });
  if(cancelled())throw Error('Подготовка копии отменена');
  preparingComparison.preparedIssues=clone(result.report.issues);
  preparingComparison.preparedDiagnosticComplete=result.report.complete;
  preparingComparison.afterIssues=clone(result.report.issues);
  markersVisible=true;render();await yieldForUi();
  record('combined-copy-diagnosed',{objects:result.document.paths.length,
    issues:result.report.issues.length,complete:result.report.complete,compound:result.compound});
  progressStage('4/5 · Исправление кривых',58);
  return {...result,gpu};
}
function runRustDiagnostic(input){
  return new Promise((resolve,reject)=>{
    const id=++sequence;
    pending={id,largeDiagnostic:true,onResponse:data=>
      data.error?reject(new Error(data.error)):resolve(data.output)};
    worker.postMessage({id,input});
  });
}
function attachPreparedComparison(preview,prepared){
  preview.comparisonData.preparedDoc=clone(prepared.document);
  preview.comparisonData.preparedIssues=clone(prepared.report.issues);
  preview.comparisonData.preparedDiagnosticComplete=prepared.report.complete;
  preview.stats.preparation={...prepared.compound,issues:prepared.report.issues.length,
    complete:prepared.report.complete};
  preview.beforeDiagnosticComplete=prepared.report.complete;
  preparingComparison=null;
  const reason=prepared.compound.reason;
  $('optimization-result').textContent+='\nОбъединённая копия: '+prepared.compound.inputObjects+
    ' → '+prepared.compound.outputObjects+' объектов; до исправления '+prepared.report.issues.length+
    ' замечаний'+(prepared.report.complete?'':' · проверка частичная')+
    (reason?' · части сохранены раздельно: '+({
      'incompatible-paint':'различное оформление',
      'unsupported-appearance':'маски или неподдерживаемое оформление',
      'unverified-union':'безопасность Union не подтверждена',
      'union-disabled':'объединение заливок выключено'}[reason]||reason):'')+
    '. Исходное ДО сохранено как контурная подложка.';
}

// The automatic section is declarative: settings trigger calculation, no
// "start/cancel" action. Only Apply commits a candidate to the document.
async function buildUnifiedPreview(){
  if(busy||!doc.paths.length||curveEditing())return;
  const scope=selectedVectorIndices(doc,selected,settingChecked('selection-only'));
  if(!scope.length){curvePreview=null;$('optimization-result').textContent='Нет векторных кривых для обработки.';render();return;}
  const generation=++previewGeneration;
  previewActive=true;lock(true,{coverCanvas:false});
  try{
    await prepareNativeIntersections();
    if(generation!==previewGeneration)return;
    const smoothingAmount=settingNumber('smoothing-amount');
    const optimizationTolerance=settingNumber('optimization-tolerance');
    const diagnosticTolerance=settingNumber('tolerance');
    const prepared=await prepareWorkingCopy(clone(doc),scope,generation);
    if(generation!==previewGeneration)return;
    const repaired=repairVectorPoints(prepared.document,prepared.indices,diagnosticTolerance,{weldOpen:true});
    const gpu=prepared.gpu;
    const merged={...prepared.merged,document:repaired.document,safeDocument:clone(prepared.document),
      selectedIndices:prepared.indices,safeSelectedIndices:prepared.indices};
    const refitted=refitBooleanUnion(merged.document,optimizationTolerance);
    let optimized=smoothAndOptimizePaths(refitted.document,merged.selectedIndices,smoothingAmount*.3,optimizationTolerance,diagnosticTolerance);
    let budget=protectPreviewNodeBudget(prepared.document,merged.safeDocument,optimized.document);
    if(budget.reason==='union-node-growth'){
      // Reject only the flattened Boolean candidate, not the native repair.
      // Still run smoothing/optimization AFTER the attempted Union, on the
      // certified exact-native snapshot. PDF/large artwork must remain editable
      // and Save/Undo must commit an actual changed AFTER when safe.
      const nativeOptimized=smoothAndOptimizePaths(merged.safeDocument,
        merged.safeSelectedIndices,smoothingAmount*.3,optimizationTolerance,diagnosticTolerance);
      const nativeBudget=protectPreviewNodeBudget(prepared.document,merged.safeDocument,nativeOptimized.document);
      if(!nativeBudget.reason){
        optimized=nativeOptimized;
        budget={...nativeBudget,reason:'union-fallback-optimized',rejectedUnionNodes:budget.after};
      }
    }
    const filtered=removeTinyClosedSubpaths(budget.document,{
      enabled:settingChecked('remove-micro'),
      width:settingNumber('micro-width'),height:settingNumber('micro-height')});
    const untangled=settingChecked('separate-coincident')?
      separateCoincidentNonadjacentNodes(filtered.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        diagnosticTolerance,{includeNearby:true}):{document:filtered.document,stats:{detected:0,separated:0,skipped:0,limited:0,movedMm:0}};
    const selfHealed=settingChecked('repair-self-intersections')?
      repairSelfIntersections(untangled.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        diagnosticTolerance,{mode:settingValue('self-intersection-mode'),
          size:settingValue('self-intersection-size'),
          preserve:settingChecked('self-intersection-preserve')}):
      {document:untangled.document,stats:{detected:0,correctedHandles:0,
        removedLoops:0,skipped:0,limited:0,maxDeviationMm:0}};
    const nearby=settingChecked('merge-nearby')?
      mergeNearbyGeometry(selfHealed.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        settingNumber('merge-nearby-distance'),{strict:settingChecked('merge-nearby-strict')}):
      {document:selfHealed.document,stats:{candidates:0,weldedNodes:0,mergedCurves:0,
        connectedOpen:0,skipped:0,limited:0,maxMovementMm:0}};
    const rounded=smoothingAmount>0?await runNativeJob({action:'round-corners',document:nearby.document,
      indices:budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
      tolerance:smoothingAmount*.7}):{document:nearby.document,stats:{rounded:0,skipped:0,addedNodes:0,maxDeviationBound:0}};
    if(generation!==previewGeneration)return;
    const after=rounded.document;
    const actualCount=document=>document.paths.reduce((n,p)=>n+
      (p.kind==='image'?0:p.commands?.filter(c=>c[0]==='M'||c[0]==='L'||c[0]==='C'||c[0]==='Q').length??p.points.length),0);
    const st={...optimized.stats,scope:[...scope],gpu,refit:refitted.stats,budget,
      actualNodesBefore:actualCount(doc),actualNodesAfter:actualCount(after),micro:filtered.stats,overlaps:merged.stats,mergeOverlaps:settingChecked('merge-overlaps'),pointRepairs:repaired.stats,untangled:untangled.stats,selfIntersections:selfHealed.stats,nearby:nearby.stats,
      nearbyOptions:{enabled:settingChecked('merge-nearby'),distance:settingNumber('merge-nearby-distance'),
        strict:settingChecked('merge-nearby-strict')},
      selfIntersectionSettings:{enabled:settingChecked('repair-self-intersections'),mode:settingValue('self-intersection-mode'),
        size:settingValue('self-intersection-size'),preserve:settingChecked('self-intersection-preserve')},diagnosticTolerance,smoothingAmount,cornerRounding:rounded.stats,smoothedJoints:optimized.stats.smoothed+rounded.stats.rounded,
      smoothingDeviation:optimized.stats.smoothingError+rounded.stats.maxDeviationBound};
    const different=JSON.stringify(doc.paths.map(worldData))!==JSON.stringify(after.paths.map(worldData));
    const msg='Скруглено острых углов: '+rounded.stats.rounded+'; защищено: '+rounded.stats.skipped+(rounded.stats.reason?' · '+rounded.stats.reason:'')+'\nИТОГОВЫЕ реальные узлы: '+st.actualNodesBefore+' → '+st.actualNodesAfter+'.'+
      '\nСближение контуров: объединено узлов '+st.nearby.weldedNodes+
      ', совпадающих кривых '+st.nearby.mergedCurves+
      ', соединено открытых контуров '+st.nearby.connectedOpen+
      ', отклонено '+st.nearby.skipped+
      (st.nearby.limited?' · пропущено из-за ограничений '+st.nearby.limited:'')+
      ' · допуск '+settingNumber('merge-nearby-distance')+' мм.'+
      '\nСамопересечения: обнаружено '+st.selfIntersections.detected+
      ', исправлено управляющими точками '+st.selfIntersections.correctedHandles+
      ', удалено петель '+st.selfIntersections.removedLoops+
      (st.selfIntersections.separatedLoops?' · отделено микропетель '+st.selfIntersections.separatedLoops:'')+
      ', пропущено '+st.selfIntersections.skipped+
      (st.selfIntersections.limited?' · ограничений '+st.selfIntersections.limited:'')+'.'+
      '\nCNC: удалено малых замкнутых подконтуров '+st.micro.removedSubpaths+
      ' (объектов: '+st.micro.removedObjects+', узлов: '+st.micro.removedNodes+
      '); размер строго меньше '+st.micro.width+' × '+st.micro.height+
      ' мм'+(st.micro.enabled?'':' · фильтр отключён')+'.'+
      (budget.reason?'\n'+previewBudgetMessage(budget)+' Показатели Union ниже относятся к отклонённой попытке.':'')+'\nТочки: убрано коротких/нулевых сегментов '+st.pointRepairs.removedNodes+
      ' · замкнуто близких концов '+st.pointRepairs.closedGaps+' · удалено покрытых повторных проходов '+(st.pointRepairs.removedRetraces||0)+'.'+
      '\nРазведение несоседних узлов: найдено '+st.untangled.detected+
      ', разнесено '+st.untangled.separated+' (сближенных: '+(st.untangled.separatedNearby||0)+'), пропущено '+st.untangled.skipped+'.'+
      '\nUnion по независимым группам: принято '+(st.overlaps.acceptedGroups||0)+
      ', отклонено '+(st.overlaps.rejectedGroups||0)+
      '. Объединение исходных Безье: слито объектов '+st.overlaps.mergedObjects+
      ', сварено заполненных групп '+st.overlaps.weldedGroups+
      ', нормализовано составных заливок '+st.overlaps.normalizedObjects+
      ', сохранено отверстий '+st.overlaps.holes+
      ', составных обводок '+st.overlaps.compoundGroups+
      '. Очистка после Union: совпадающих точек '+st.overlaps.cleanup.coincident+
      ', лишних коллинеарных '+st.overlaps.cleanup.collinear+
      ', коротких сегментов '+st.overlaps.cleanup.short+
      (st.overlaps.cleanup.reverted?' · '+st.overlaps.cleanup.reverted+
        ' изменений отменено защитой топологии':'')+
      (st.overlaps.skipped?' · неподдерживаемых групп '+st.overlaps.skipped:'')+
      '. '+(budget.reason?'Булево объединение ограничено защитой узлов. ':st.overlaps.weldedGroups||st.overlaps.normalizedObjects?'Применено булево исправление перекрытий. ':'')+'Исходные кривые сохраняются; добавляются только необходимые точки пересечения.'+
      '\nИтоговая оптимизация ПОСЛЕ Union: '+st.refit.originalNodes+' → '+st.refit.finalNodes+
      ' реальных узлов (−'+st.refit.removed+'), кубических сегментов '+st.refit.cubicSegments+
      ', проходов '+st.refit.passes+(st.refit.skipped?' · пропущено объектов '+st.refit.skipped:'')+
      '. На экране реальных узлов: '+st.actualNodesBefore+' → '+st.actualNodesAfter+'.'+
      '\nКривые: сглажено стыков '+st.smoothedJoints+
      ' · оценённое отклонение сглаживания до '+st.smoothingDeviation.toFixed(5)+' мм.'+
      '\nПосле Union, сегментов кривых: '+st.original+' → '+st.result+
      ' (−'+st.removed+'), оценка отклонения оптимизации до '+st.maxError.toFixed(5)+' мм.'+
      '\nКонтроль геометрии: отклонено изменений '+(st.rejected+st.smoothingRejected+(st.refit?.rejected||0))+'.'+
      '\nДопуски: сглаживание '+smoothingAmount+' мм · оптимизация '+optimizationTolerance+' мм.'+
      (different?'\nДля просмотра изменений выберите ДО / ПОСЛЕ. Красный пунктир — исходная кривая, зелёный — результат.':
        '\nПри этих допусках форма не изменена.');
    $('optimization-result').textContent=msg;
    const initial=importedComparison(importedBefore,after)||{
      beforeDoc:clone(importedBefore?.document||doc),afterDoc:after,beforeIssues:[],afterIssues:[]};
    const pv={source:clone(doc),result:after,stats:st,hasGeometryChange:different,
      beforeDiagnosticComplete:initial?.beforeDiagnosticComplete??diagnosticComplete,
      afterDiagnosed:false,comparisonData:initial||{
        beforeDoc:clone(doc),afterDoc:after,beforeIssues:clone(issues),afterIssues:[]
      }};
    pv.doctorMaskToken=typeof doctorMaskCache==='undefined'?null:doctorMaskCache.generation;
    attachPreparedComparison(pv,prepared);
    curvePreview=pv;
    if(!comparisonSelectionExplicit)compareStage='after'; // default result is ПОСЛЕ
    record('autoheal-curve-preview',{scope,stats:st,changed:different});
    previewActive=false;lock(false);
    if(ready)void checkPreviewAfter(pv);
  }catch(err){if(generation!==previewGeneration)return;pendingSettingsApply=false;previewActive=false;preparingComparison=null;lock(false);curvePreview=null;$('optimization-result').textContent=err.message;render();status('Автоисправление: '+err.message);}
}
function applyUnifiedChanges(){
  if(busy||!curvePreview||!curvePreview.hasGeometryChange)return false;
  const pv=curvePreview;
  if(Number($('smoothing-amount').value)!==pv.stats.smoothingAmount||
     Number($('optimization-tolerance').value)!==pv.stats.tolerance||
     Number($('tolerance').value)!==pv.stats.diagnosticTolerance||
     $('merge-overlaps').checked!==pv.stats.mergeOverlaps||
     $('merge-nearby').checked!==pv.stats.nearbyOptions?.enabled||
     Number($('merge-nearby-distance').value)!==pv.stats.nearbyOptions?.distance||
     $('merge-nearby-strict').checked!==pv.stats.nearbyOptions?.strict||
     $('repair-self-intersections').checked!==pv.stats.selfIntersectionSettings?.enabled||
     $('self-intersection-mode').value!==pv.stats.selfIntersectionSettings?.mode||
     $('self-intersection-size').value!==pv.stats.selfIntersectionSettings?.size||
     $('self-intersection-preserve').checked!==pv.stats.selfIntersectionSettings?.preserve||
     ($('remove-micro')?.checked??true)!==pv.stats.micro?.enabled||
     Number($('micro-width')?.value??.1)!==pv.stats.micro?.width||
     Number($('micro-height')?.value??.1)!==pv.stats.micro?.height||
     JSON.stringify(selectedVectorIndices(doc,selected,$('selection-only').checked))!==JSON.stringify(pv.stats.scope)){
    status('Параметры изменились. Автоматический расчёт ещё не завершён.');return false;
  }
  const baseline=clone(doc),comparison=pv.comparisonData;
  checkpoint(baseline);doc=clone(pv.result);
  changed('unified-apply');appliedComparison=comparison;compareStage='after';render();
  const st=pv.stats;
  const beforeCount=(comparison.preparedIssues||comparison.beforeIssues).length,afterCount=comparison.afterIssues.length;
  const complete=pv.afterDiagnosed&&pv.afterDiagnosticComplete&&pv.beforeDiagnosticComplete;
  updateFileHistory({status:'Исправлено точек: '+st.pointRepairs.removedNodes+' · замкнуто: '+st.pointRepairs.closedGaps+
      ' · сглажено стыков: '+st.smoothedJoints+' · сегментов '+st.original+' → '+st.result,
    diagnosis:pv.afterDiagnosed?{count:afterCount,complete:pv.afterDiagnosticComplete}:null,
    repair:complete?{before:beforeCount,after:afterCount}:null});
  record('unified-apply',{stats:st});
  status('Изменения применены: '+st.pointRepairs.removedNodes+' исправлений точек, '+st.pointRepairs.closedGaps+
    ' замыканий, '+st.smoothedJoints+' сглаженных стыков, '+st.removed+
    ' удалённых сегментов. Undo восстанавливает исходные кривые.');
  return true;
}
function requestRecalculation(){
  clearTimeout(settingsTimeout);settingsTimeout=setTimeout(()=>{
    if(busy){requestRecalculation();return;}
    curvePreview=null;appliedComparison=null;if(!comparisonSelectionExplicit)compareStage='before';
    if(ready&&doc.paths.some(p=>p.kind!=='image'))calculate(0);
    else render();
  },180);
}
$('optimization-range').oninput=()=>{
  $('optimization-tolerance').value=$('optimization-range').value;markSettingsDirty();
};
$('optimization-tolerance').oninput=()=>{
  const t=Number($('optimization-tolerance').value);
  if(Number.isFinite(t)&&t>=.001&&t<=.25)$('optimization-range').value=String(t);
  markSettingsDirty();
};
$('settings-defaults').onclick=()=>{
  if(busy)return;
  for(const id of settingIds){
    if(settingChecks.has(id))$(id).checked=defaultSettings[id];
    else $(id).value=String(defaultSettings[id]);
  }
  $('optimization-range').value=String(defaultSettings['optimization-tolerance']);
  markSettingsDirty();
  $('settings-pending').textContent=settingsDirty?
    'Значения по умолчанию восстановлены. Нажмите «Применить изменения».':
    'Уже действуют настройки по умолчанию.';
};
for(const id of settingIds){
  $(id).addEventListener('change',markSettingsDirty);
  if(!settingChecks.has(id))$(id).addEventListener('input',markSettingsDirty);
}
async function applySettingsAndChanges(){
  if(busy||!ready||!doc.paths.some(p=>p.kind!=='image'))return;
  const next=readSettingsForm(),error=validateSettingsDraft(next);
  if(error){status(error);$('settings-pending').textContent=error;return;}
  if(settingsDirty){
    const modified=settingIds.filter(id=>next[id]!==appliedSettings[id]);
    appliedSettings=next;settingsDirty=false;
    $('settings-pending').classList.remove('unsaved');
    // Changing a measurement threshold alone must not invoke Union/smoothing,
    // alter EPS geometry, or create an unnecessary Undo checkpoint.
    if(modified.includes('doctortracer-enabled')){
      doctorMaskCache.invalidate();
      $('doctortracer-status').textContent=settingChecked('doctortracer-enabled')?
        'DoctorTracer 0.21.1 включён: при 11+ остаточных ошибках после лечения выполняется резервная трассировка.':
        'DoctorTracer 0.21.1 отключён. Автоматическая трассировка не запускается.';
    }
    // Optional tracing and measuring clearance never alter geometry themselves.
    if(modified.every(id=>id==='doctortracer-enabled'||id==='clearance-threshold')){
      if(modified.includes('clearance-threshold'))clearanceKey='';
      $('settings-pending').textContent='Параметры применены без изменения геометрии.';
      record('non-geometric-settings-apply',{modified,doctorTracerEnabled:settingChecked('doctortracer-enabled')});
      render();status('Настройки применены. Документ и результат ПОСЛЕ не изменены.');
      // If a user opts in after import, evaluate the existing AFTER preview
      // on explicit Apply; no need to reopen EPS or rerun the whole optimizer.
      if(modified.includes('doctortracer-enabled')&&settingChecked('doctortracer-enabled')&&
         curvePreview?.afterDiagnosed)void checkPreviewAfter(curvePreview);
      return;
    }
    if(curveEditing()){
      $('settings-pending').textContent='Параметры сохранены. Проверка и полное обновление — после «Готово».';
      drawLocalEditorOverlay();
      status('Параметры изменены, но исходная фигура и диагностика не обновлялись.');
      return;
    }
    // Explicit commit is the only point where new settings may trigger a
    // global optimizer or an expensive clearance scan.
    const scope=selectedVectorIndices(doc,selected,settingChecked('selection-only'));
    if(!scope.length){status('Нет векторных объектов для обработки.');return;}
    pendingSettingsApply=true;
    $('settings-pending').textContent='Параметры приняты. Выполняется однократный пересчёт…';
    record('settings-apply',{settings:appliedSettings,scope});
    const count=scope.reduce((sum,i)=>sum+(doc.paths[i].commands?.length??doc.paths[i].points?.length??0),0);
    if(count>2500||scope.length>150)await buildLargeUnifiedPreview(scope);
    else await buildUnifiedPreview();
    return;
  }
  if(curvePreview?.hasGeometryChange)applyUnifiedChanges();
  else status('Геометрия уже соответствует применённым настройкам.');
}
$('apply-changes').onclick=()=>{void applySettingsAndChanges();};
$('recheck-defects').onclick=()=>{
  if(busy||!ready||curveEditing()||currentComparison())return;
  record('manual-diagnostics-request');
  calculate(0,{diagnosticsOnly:true});
};

function spawnWorker(){
  ready=false;$('engine').textContent='○ Загрузка Rust / WASM…';
  worker=new Worker(new URL('worker.js?v=0.2.0-alpha.75',import.meta.url),{type:'module'});
  worker.onmessage=({data})=>{
    if(data.id===0){ready=!data.error;$('engine').textContent=ready?'● Rust / WASM готов':'○ WASM не собран';status(data.error||'Rust-ядро готово');render();if(ready&&doc.paths.length&&!currentComparison()&&!suppressNextDiagnostic)calculate(0);suppressNextDiagnostic=false;return;}
    if(!pending||data.id!==pending.id)return;
    const task=pending;pending=null;
    if(task.largeDiagnostic){task.onResponse(data);return;}
    if(data.error){lock(false);record('engine-error',{error:data.error});status(data.error);return;}
    if(task.unifiedAfterDiagnostic){
      if(curvePreview&&task.preview===curvePreview){
        curvePreview.comparisonData.afterIssues=data.output.issues.map(x=>({
          ...x,path:task.scope[x.path]??-1,other:task.scope[x.other]??-1
        }));
        curvePreview.afterDiagnosed=true;
        curvePreview.afterDiagnosticComplete=data.output.diagnosticComplete;
        record('unified-autoheal-diagnose',{issues:data.output.issues.length,complete:data.output.diagnosticComplete});
      }
      lock(false);render();
      status('Сглаживание и оптимизация: '+(curvePreview?.stats.original||0)+' → '+(curvePreview?.stats.result||0)+' сегментов; после: '+data.output.issues.length+' замечаний'+(data.output.diagnosticComplete?'':' (неполная проверка)'));
      return;
    }
    lock(false);
    if(task.action){
      checkpoint(task.before);
      const scope=new Set(task.scope);const next=[];let inserted=false;const changedIndices=[];
      doc.paths.forEach((p,i)=>{if(scope.has(i)){if(!inserted){for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}inserted=true;}}else next.push(p);});
      if(!inserted)for(const q of data.output.paths){changedIndices.push(next.length);next.push({points:q.points,closed:q.closed});}
      doc.paths=next;selected=new Set(changedIndices);changed(`repair-${task.action}`);
      status('Изменения применены. Для повторной проверки нажмите «Найти проблемы».');
    }else{
      diagnosticComplete=data.output.diagnosticComplete;markersVisible=true;issues=data.output.issues.map(x=>({...x,path:task.scope[x.path],other:task.scope[x.other]}));metrics=doc.paths.map(()=>null);data.output.paths.forEach((p,i)=>metrics[task.scope[i]]=p);
      if(importedBefore?.pending){
        importedBefore=captureImportBefore(importedBefore,issues,diagnosticComplete);
        appliedComparison=importedComparison(importedBefore,doc,issues);
        if(!comparisonSelectionExplicit)compareStage='before';
      }
      record('diagnose',{issues:issues.length,scope:task.scope});updateFileHistory({diagnosis:{count:issues.length,complete:diagnosticComplete,selected:Boolean(task.selectedOnly)}});render();status(diagnosticComplete?`Проверено объектов: ${task.scope.length}. Замечаний: ${issues.length}.`:'Проверка неполная: достигнут лимит 10000 замечаний.');
      if(task.action===0)buildUnifiedPreview();
    }
  };
  worker.onerror=e=>{++diagnosticGeneration;pending=null;ready=false;diagnosticComplete=false;$('engine').textContent='○ Ошибка WASM';lock(false);status(`Ошибка WASM worker: ${e.message}`);};worker.postMessage({id:0});
}
async function buildLargeUnifiedPreview(indices){
  if(busy||!doc.paths.length||curveEditing())return;
  const generation=++previewGeneration;
  previewActive=true;
  const source=clone(doc);let result=clone(doc),qualitySource=clone(doc);
  const tol=settingNumber('tolerance'),
    smoothingAmount=settingNumber('smoothing-amount'),
    optimizationTolerance=settingNumber('optimization-tolerance');
  const stats={scope:[...indices],original:0,result:0,removed:0,maxError:0,tolerance:optimizationTolerance,
    smoothingAmount,smoothedJoints:0,smoothingDeviation:0,rejected:0,smoothingRejected:0,pointRepairs:{
      removedNodes:0,closedGaps:0,maxDeviation:0,skipped:0,removedRetraces:0,removedRetracedNodes:0
    },diagnosticTolerance:tol};
  lock(true,{coverCanvas:false});
  try{
    await prepareNativeIntersections();
    if(generation!==previewGeneration)return;
    const prepared=await prepareWorkingCopy(source,indices,generation);
    if(generation!==previewGeneration)return;
    const workIndices=prepared.indices;
    result=clone(prepared.document);qualitySource=clone(prepared.document);
    for(let k=0;k<workIndices.length;k++){
      if(generation!==previewGeneration)return;
      const index=workIndices[k],input=result.paths[index];
      const repaired=repairVectorPoints({paths:[input]},[0],tol,{weldOpen:true});
      result.paths[index]=repaired.document.paths[0];
      for(const key of ['removedNodes','closedGaps','removedRetraces','removedRetracedNodes','skipped'])
        stats.pointRepairs[key]+=repaired.stats[key]||0;
      stats.pointRepairs.maxDeviation=Math.max(stats.pointRepairs.maxDeviation,repaired.stats.maxDeviation);
      if((k+1)%3===0||k===workIndices.length-1)await yieldForUi();
    }
    const gpu=prepared.gpu;
    const merged={...prepared.merged,document:result,safeDocument:clone(prepared.document),
      selectedIndices:workIndices,safeSelectedIndices:workIndices};
    progressStage('Восстановление кривых после Union',44);
    await yieldForUi();
    const refitted=refitBooleanUnion(merged.document,optimizationTolerance);
    qualitySource=clone(refitted.document);result=clone(refitted.document);
    const selectedAfter=merged.selectedIndices;
    for(let k=0;k<selectedAfter.length;k++){
      if(generation!==previewGeneration)return;
      const index=selectedAfter[k],input=result.paths[index];
      const smoothed=smoothVectorPath(input,smoothingAmount*.3,tol);
      const optimized=optimizeVectorPath(smoothed.path,optimizationTolerance,tol);
      result.paths[index]=optimized.path;
      stats.original+=optimized.before;stats.result+=optimized.after;
      stats.rejected+=Number(optimized.quality?.accepted===false);
      stats.smoothingRejected+=Number(smoothed.quality?.accepted===false);
      stats.removed+=optimized.removed;stats.smoothedJoints+=smoothed.changed;
      stats.smoothingDeviation=Math.max(stats.smoothingDeviation,smoothed.maxError);
      stats.maxError=Math.max(stats.maxError,optimized.maxError);
      if((k+1)%3===0||k===selectedAfter.length-1){
        progressStage('Сглаживание и оптимизация ПОСЛЕ Union',
          Math.round(48+47*(k+1)/selectedAfter.length),
          (k+1)+' / '+selectedAfter.length+' контуров');
        await yieldForUi();
      }
    }
    if(generation!==previewGeneration)return;
    previewActive=false;
    stats.quality=validateDocumentCurveChange(qualitySource,result,{
      tolerance:smoothingAmount+optimizationTolerance,nodeTolerance:tol});
    if(!stats.quality.accepted){
      result.paths=qualitySource.paths;stats.rejected++;
      stats.result=stats.original;stats.removed=0;stats.smoothedJoints=0;
      stats.maxError=0;stats.smoothingDeviation=0;
    }
    let budget=protectPreviewNodeBudget(prepared.document,merged.safeDocument,result);
    if(budget.reason==='union-node-growth'){
      // A rejected polygonized Union must not block independent safe native
      // optimization or erase earlier exact-copy removal on large EPS.
      const safeSource=clone(merged.safeDocument),safeResult=clone(safeSource);
      const nativeStats={original:0,result:0,removed:0,maxError:0,
        smoothedJoints:0,smoothingDeviation:0,rejected:0,smoothingRejected:0};
      const nativeIndices=merged.safeSelectedIndices;
      for(let k=0;k<nativeIndices.length;k++){
        if(generation!==previewGeneration)return;
        const i=nativeIndices[k],sm=smoothVectorPath(safeSource.paths[i],smoothingAmount*.3,tol);
        const opt=optimizeVectorPath(sm.path,optimizationTolerance,tol);
        safeResult.paths[i]=opt.path;
        nativeStats.original+=opt.before;nativeStats.result+=opt.after;
        nativeStats.removed+=opt.removed;nativeStats.maxError=Math.max(nativeStats.maxError,opt.maxError);
        nativeStats.smoothedJoints+=sm.changed;
        nativeStats.smoothingDeviation=Math.max(nativeStats.smoothingDeviation,sm.maxError);
        nativeStats.rejected+=Number(opt.quality?.accepted===false);
        nativeStats.smoothingRejected+=Number(sm.quality?.accepted===false);
        if((k+1)%3===0||k===nativeIndices.length-1){
          progressStage('Безопасная оптимизация без отклонённого Union',
            Math.round(95+4*(k+1)/nativeIndices.length),
            (k+1)+' / '+nativeIndices.length+' контуров');
          await yieldForUi();
        }
      }
      if(generation!==previewGeneration)return;
      const nativeQuality=validateDocumentCurveChange(safeSource,safeResult,{
        tolerance:smoothingAmount+optimizationTolerance,nodeTolerance:tol});
      const nativeBudget=protectPreviewNodeBudget(prepared.document,safeSource,safeResult);
      if(nativeQuality.accepted&&!nativeBudget.reason){
        result=safeResult;
        Object.assign(stats,nativeStats);
        stats.quality=nativeQuality;
        budget={...nativeBudget,reason:'union-fallback-optimized',rejectedUnionNodes:budget.after};
      }
    }
    const filtered=removeTinyClosedSubpaths(budget.document,{
      enabled:settingChecked('remove-micro'),
      width:settingNumber('micro-width'),height:settingNumber('micro-height')});
    const untangled=settingChecked('separate-coincident')?
      separateCoincidentNonadjacentNodes(filtered.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        tol,{includeNearby:true}):{document:filtered.document,stats:{detected:0,separated:0,skipped:0,limited:0,movedMm:0}};
    const selfHealed=settingChecked('repair-self-intersections')?
      repairSelfIntersections(untangled.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        tol,{mode:settingValue('self-intersection-mode'),
          size:settingValue('self-intersection-size'),
          preserve:settingChecked('self-intersection-preserve')}):
      {document:untangled.document,stats:{detected:0,correctedHandles:0,
        removedLoops:0,skipped:0,limited:0,maxDeviationMm:0}};
    const nearby=settingChecked('merge-nearby')?
      mergeNearbyGeometry(selfHealed.document,
        budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
        settingNumber('merge-nearby-distance'),{strict:settingChecked('merge-nearby-strict')}):
      {document:selfHealed.document,stats:{candidates:0,weldedNodes:0,mergedCurves:0,
        connectedOpen:0,skipped:0,limited:0,maxMovementMm:0}};
    const rounded=smoothingAmount>0?await runNativeJob({action:'round-corners',document:nearby.document,
      indices:budget.reason==='union-fallback-optimized'?merged.safeSelectedIndices:merged.selectedIndices,
      tolerance:smoothingAmount*.7}):{document:nearby.document,stats:{rounded:0,skipped:0,addedNodes:0,maxDeviationBound:0}};
    if(generation!==previewGeneration)return;
    const after=rounded.document;
    stats.cornerRounding=rounded.stats;stats.smoothedJoints+=rounded.stats.rounded;stats.smoothingDeviation+=rounded.stats.maxDeviationBound;
    stats.untangled=untangled.stats;
    stats.selfIntersections=selfHealed.stats;
    stats.nearby=nearby.stats;
    stats.nearbyOptions={enabled:settingChecked('merge-nearby'),
      distance:settingNumber('merge-nearby-distance'),strict:settingChecked('merge-nearby-strict')};
    stats.selfIntersectionSettings={enabled:settingChecked('repair-self-intersections'),
      mode:settingValue('self-intersection-mode'),size:settingValue('self-intersection-size'),
      preserve:settingChecked('self-intersection-preserve')};
    stats.micro=filtered.stats;
    stats.gpu=gpu;stats.budget=budget;stats.overlaps=merged.stats;stats.refit=refitted.stats;
    stats.mergeOverlaps=settingChecked('merge-overlaps');
    const countReal=target=>target.paths.reduce((n,p)=>n+(p.kind==='image'?0:
      p.commands?.filter(c=>['M','L','C','Q'].includes(c[0])).length??p.points.length),0);
    stats.actualNodesBefore=countReal(doc);stats.actualNodesAfter=countReal(after);
    const different=JSON.stringify(doc.paths.map(worldData))!==JSON.stringify(after.paths.map(worldData));
    const pv={source,result:after,stats,hasGeometryChange:different,beforeDiagnosticComplete:false,
      afterDiagnosed:false,afterDiagnosticComplete:false,afterScope:'unknown',
      comparisonData:importedComparison(importedBefore,after)||{
        beforeDoc:clone(importedBefore?.document||source),afterDoc:after,beforeIssues:[],afterIssues:[]
      }};
    pv.doctorMaskToken=typeof doctorMaskCache==='undefined'?null:doctorMaskCache.generation;
    pv.beforeDiagnosticComplete=importedBefore?.complete??diagnosticComplete;
    curvePreview=pv;if(!comparisonSelectionExplicit)compareStage='after';
    $('optimization-result').textContent='Скруглено острых углов: '+rounded.stats.rounded+'; защищено: '+rounded.stats.skipped+(rounded.stats.reason?' · '+rounded.stats.reason:'')+'\nИТОГОВЫЕ реальные узлы: '+stats.actualNodesBefore+' → '+stats.actualNodesAfter+'.'+
      '\nСближение контуров: объединено узлов '+stats.nearby.weldedNodes+
      ', совпадающих кривых '+stats.nearby.mergedCurves+
      ', соединено открытых контуров '+stats.nearby.connectedOpen+
      ', отклонено '+stats.nearby.skipped+' · допуск '+settingNumber('merge-nearby-distance')+' мм.'+
      '\nСамопересечения: обнаружено '+stats.selfIntersections.detected+
      ', исправлено ручками '+stats.selfIntersections.correctedHandles+
      ', удалено петель '+stats.selfIntersections.removedLoops+
      (stats.selfIntersections.separatedLoops?' · отделено микропетель '+stats.selfIntersections.separatedLoops:'')+
      ', пропущено '+stats.selfIntersections.skipped+
      (stats.selfIntersections.limited?' · сработал лимит проверки или ремонта':'')+'.'+
      '\nCNC: удалено малых замкнутых подконтуров '+stats.micro.removedSubpaths+
      ', узлов '+stats.micro.removedNodes+'; размер '+stats.micro.width+' × '+
      stats.micro.height+' мм'+(stats.micro.enabled?'':' · фильтр отключён')+'.'+
      (budget.reason?' '+previewBudgetMessage(budget)+' Показатели Union ниже — отклонённая попытка.':'')+'\nБольшой документ: обработано '+indices.length+
      ' контуров; Union принято групп '+(stats.overlaps.acceptedGroups||0)+
      ', отклонено '+(stats.overlaps.rejectedGroups||0)+
      '; разнесено несоседних узлов '+stats.untangled.separated+' (сближенных: '+(stats.untangled.separatedNearby||0)+')'+
      ', пропущено '+stats.untangled.skipped+
      '; удалено покрытых повторных проходов '+stats.pointRepairs.removedRetraces+' ('+stats.pointRepairs.removedRetracedNodes+' узлов); сглажено '+stats.smoothedJoints+' стыков, удалено '+stats.removed+
      ' сегментов; слито объектов '+stats.overlaps.mergedObjects+
      ', нормализовано заливок '+stats.overlaps.normalizedObjects+
      ', сохранено отверстий '+stats.overlaps.holes+
      ', очищено узлов '+(stats.overlaps.cleanup.coincident+stats.overlaps.cleanup.collinear+
        stats.overlaps.cleanup.short)+
      (stats.overlaps.cleanup.reverted?' · защищено контуров '+stats.overlaps.cleanup.reverted:'')+
      '. После Union оптимизировано узлов '+stats.refit.originalNodes+' → '+stats.refit.finalNodes+
      ' (−'+stats.refit.removed+'), кубических сегментов '+stats.refit.cubicSegments+
      '. Контроль геометрии: отклонено изменений '+(stats.rejected+stats.smoothingRejected+(stats.refit.rejected||0))+'. Реальные узлы '+stats.actualNodesBefore+' → '+stats.actualNodesAfter+'. '+(different?'Результат в режиме ПОСЛЕ. Применяйте изменения вручную после просмотра.':
      'Форма кривых не изменилась.')+
      '\nПолная диагностика между блоками не подтверждена; перед экспортом может появиться предупреждение.';
    attachPreparedComparison(pv,prepared);
    // Do not retain the entire source/result document inside a log event.
    // The 8101921 EPS session produced an 11 MB single JSONL record here.
    record('large-preview',{paths:indices.length,changed:different,
      originalNodes:stats.actualNodesBefore,resultNodes:stats.actualNodesAfter,
      originalSegments:stats.original,resultSegments:stats.result,
      rejected:stats.rejected,skipped:stats.pointRepairs.skipped,
      budgetReason:stats.budget?.reason,
      diagnosticComplete:false,afterDiagnosticComplete:false});
    progressStage('Оптимизация завершена',100,indices.length+' контуров');
    lock(false);
    if(ready)void checkPreviewAfter(pv);
  }catch(error){
    if(generation!==previewGeneration)return;
    pendingSettingsApply=false;previewActive=false;preparingComparison=null;curvePreview=null;
    $('optimization-result').textContent='Оптимизация остановлена: '+error.message;
    record('large-preview-error',{error:error.message});
    lock(false);status('Оптимизация не завершена: '+error.message+'. Исходные кривые сохранены.');
  }
}

async function retryUnfixableWithDoctorTracer(preview,report,callRust,generation){
  const source=preview.source;
  const vectors=source.paths.filter(p=>p.kind!=='image').length;
  const scopeComplete=preview.stats.scope?.length===vectors;
  const label=$('doctortracer-status');
  if(!settingChecked('doctortracer-enabled')){
    label.textContent='DoctorTracer 0.21.1 отключён в настройках. Исходный вектор сохранён.';
    return report;
  }
  if(!needsDoctorTracer(report,{scopeComplete,alreadyAttempted:preview.doctorTracerAttempted})){
    if(!preview.doctorTracerAttempted)label.textContent=
      report.issues.length>10&&!scopeComplete?
        'DoctorTracer 0.21.1: обнаружено '+report.issues.length+
        ' ошибок, но выбран не весь документ. Для полной реконструкции снимите ограничение выделения.':
        'DoctorTracer 0.21.1: '+report.issues.length+
        ' оставшихся ошибок. Переход на трассировку при 11 и более.';
    return report;
  }
  preview.doctorTracerAttempted=true;
  const originalCount=report.issues.length;
  const cancelled=()=>generation!==afterDiagnosticGeneration||preview!==curvePreview;
  const abort=new AbortController();
  doctorTracerAbort=abort;
  label.textContent='DoctorTracer 0.21.1 WASM запущен: '+originalCount+
    ' подтверждённых остаточных ошибок'+(report.complete?'':' (проверка частичная)')+
    '. Растрирование → повторная трассировка…';
  record('doctortracer-fallback-start',{remaining:originalCount,source:source.sourceFileName||null});
  try{
    progressStage('DoctorTracer: получение сохранённого растра 600 dpi',10);
    // The mask is already computed when the file was OPENED, before the
    // Rust diagnostics or autohealing. Do not repaint source geometry here.
    let prepared=doctorMaskCache.get(preview.doctorMaskToken);
    const cacheHit=Boolean(prepared);
    if(!prepared){
      // A manual geometry change invalidates the original import cache.
      // Regenerate instead of silently tracing stale content.
      record('doctortracer-mask-cache-miss',{source:source.sourceFileName||null,
        reason:'modified-or-unavailable'});
      const freshPlan=preparedRasterPlan(source);
      const fresh=await rasterizeDocumentAlpha(source,freshPlan,{
        signal:abort.signal,yieldUi:yieldForUi});
      prepared={plan:freshPlan,alpha:fresh.alpha};
    }
    if(cancelled())return report;
    // Keep the high-resolution alpha in temporary RAM for a strict 600dpi
    // result comparison. Only the downsampled/size-bounded black RGBA copy
    // is transferred to DoctorTracer; the cached buffer is never detached.
    const plan=boundedWorkerRasterPlan(prepared.plan);
    const originalMask=workerRasterFromPreparedMask(prepared,plan);
    const raster={...originalMask,pixels:new Uint8Array(originalMask.pixels)};
    record('doctortracer-rgba-ready',{backend:raster.backend,mask:raster.mask,
      width:raster.width,height:raster.height,bytes:raster.pixels.byteLength,
      cacheHit,preparedWidth:prepared.plan.width,
      preparedHeight:prepared.plan.height,
      preparedDpi:Number(prepared.plan.dpi.toFixed(3)),
      workerDpi:Number(plan.dpi.toFixed(3)),
      source:source.sourceFileName||null});
    progressStage('DoctorTracer: трассировка Rust WASM',30);
    const {candidate,traced,tracePlan,attempts}=await traceDocumentWithNodeBudget(source,plan,{
      // Stable physical silhouette: node-budget retries downsample this
      // immutable original RGBA rather than redraw 1px strokes at each DPI.
      firstRaster:raster,referenceRaster:originalMask,signal:abort.signal,
      traceOptions:{timeoutMs:240000,
        progress:(pct,stage)=>progressStage('DoctorTracer: '+(stage||'трассировка'),
          Math.min(70,30+Math.round(pct*.4)),Math.round(pct)+'%')},
      onAttempt:({attempt,total,plan:attemptPlan,rasterBackend})=>{
        record('doctortracer-trace-attempt',{attempt,total,width:attemptPlan.width,
          height:attemptPlan.height,rasterBackend});
        progressStage('DoctorTracer: трассировка WASM · попытка '+attempt+'/'+total,30);
      },
      onTraced:({attempt,plan:attemptPlan,paths,paletteCount,backend,segmentation})=>{
        record('doctortracer-trace-result',{attempt,width:attemptPlan.width,
          height:attemptPlan.height,paths,paletteCount,backend,requestedInkCount:1,
          segmentation});
      },
      onRetry:({attempt,nextPlan,reason})=>{
        record('doctortracer-node-limit-retry',{attempt,reason,
          nextWidth:nextPlan.width,nextHeight:nextPlan.height});
        label.textContent='DoctorTracer 0.21.1: превышен лимит 200000 узлов. '+
          'Повторная трассировка '+nextPlan.width+'×'+nextPlan.height+' px…';
      }
    });
    if(cancelled())return report;
    progressStage('DoctorTracer: сверка растрового силуэта',72);
    // Validate at the PREPARED resolution (600dpi where within resource
    // bounds), never merely against a reduced Worker input.
    const candidateRaster=await rasterizeDocumentAlpha(candidate,prepared.plan,{
      signal:abort.signal,yieldUi:yieldForUi,
      onProgress:f=>progressStage('DoctorTracer: сверка 600 dpi',72+Math.round(f*6))
    });
    const similarity=maskSimilarity({
      width:prepared.plan.width,height:prepared.plan.height,alpha:prepared.alpha
    },candidateRaster);
    if(similarity.iou<.95||similarity.areaRatio<.95||similarity.areaRatio>1.05)
      throw Error('новая геометрия заметно отличается от исходного растра (IoU '+
        similarity.iou.toFixed(3)+', площадь '+similarity.areaRatio.toFixed(3)+')');
    if(cancelled())return report;
    progressStage('DoctorTracer: повторная диагностика вектора',78);
    const checked=await diagnoseAfterDocument(candidate,settingNumber('tolerance'),{
      runBatch:callRust,progress:progressStage,yieldUi:yieldForUi,cancelled
    });
    if(!checked||cancelled())return report;
    const native=await runNativeJob({action:'diagnose',document:candidate,
      issues:checked.issues,tolerance:settingNumber('tolerance')});
    if(cancelled())return report;
    checked.issues=native.issues;
    checked.complete=checked.complete&&native.complete;
    checked.nativeUnresolved=native.unresolved;
    if(!acceptRetracing(originalCount,checked,similarity))
      throw Error('после трассировки осталось '+checked.issues.length+
        ' ошибок; безопасность/улучшение не подтверждены');
    preview.result=candidate;
    preview.hasGeometryChange=true;
    preview.stats.doctorTracer={triggered:true,accepted:true,before:originalCount,
      after:checked.issues.length,backend:traced.backend,similarity,plan,tracePlan,attempts};
    preview.stats.actualNodesAfter=candidate.paths.reduce((sum,p)=>sum+p.commands?.filter(
      c=>['M','L','C','Q'].includes(c[0])).length??p.points?.length??0,0);
    preview.comparisonData.afterDoc=candidate;
    $('optimization-result').textContent+='\nDoctorTracer: из '+originalCount+
      ' оставшихся ошибок получено '+checked.issues.length+
      '; вектор пересоздан из растра ('+plan.width+'×'+plan.height+
      ' px, IoU '+similarity.iou.toFixed(4)+'). Исходные кривые сохранены в ДО / Undo.';
    label.textContent='DoctorTracer 0.21.1: новый вектор принят · ошибок '+originalCount+
      ' → '+checked.issues.length+' · совпадение силуэта '+(100*similarity.iou).toFixed(2)+'%.';
    record('doctortracer-fallback-accepted',preview.stats.doctorTracer);
    return checked;
  }catch(error){
    if(!cancelled()){
      preview.stats.doctorTracer={triggered:true,accepted:false,before:originalCount,
        reason:String(error.message)};
      label.textContent='DoctorTracer 0.21.1: попытка выполнена, но новая структура отклонена. Исходный вектор сохранён · '+error.message;
      record('doctortracer-fallback-rejected',preview.stats.doctorTracer);
    }
    return report;
  }finally{
    if(doctorTracerAbort===abort)doctorTracerAbort=null;
  }
}

// After calculation belongs to the immutable optimized result and is reused
// by Save EPS; exporting must not trigger a second diagnostic pass.
async function checkPreviewAfter(preview){
  if(!preview||preview!==curvePreview||!ready||busy)return;
  const generation=++afterDiagnosticGeneration;
  preview.afterDiagnosed=false;preview.afterDiagnosticComplete=false;
  lock(true,{coverCanvas:false});
  const callRust=input=>new Promise((resolve,reject)=>{
    const id=++sequence;
    pending={id,largeDiagnostic:true,onResponse:data=>
      data.error?reject(new Error(data.error)):resolve(data.output)};
    worker.postMessage({id,input});
  });
  try{
    let report=await diagnoseAfterDocument(preview.result,
      settingNumber('tolerance'),{
        runBatch:callRust,progress:progressStage,yieldUi:yieldForUi,
        cancelled:()=>generation!==afterDiagnosticGeneration||preview!==curvePreview
      });
    if(!report||generation!==afterDiagnosticGeneration||preview!==curvePreview)return;
    const native=await runNativeJob({action:'diagnose',document:preview.result,issues:report.issues,tolerance:settingNumber('tolerance')});
    if(generation!==afterDiagnosticGeneration||preview!==curvePreview)return;
    report.issues=native.issues;report.complete=report.complete&&native.complete;report.nativeUnresolved=native.unresolved;
    report=await retryUnfixableWithDoctorTracer(preview,report,callRust,generation);
    if(generation!==afterDiagnosticGeneration||preview!==curvePreview)return;
    preview.comparisonData.afterIssues=report.issues;
    preview.comparisonData.afterDiagnosticComplete=report.complete;
    preview.comparisonData.afterScope=report.fullScope?'full':'partial';
    preview.afterDiagnosed=true;preview.afterDiagnosticComplete=report.complete;
    preview.afterScope=report.fullScope?'full':'partial';
    markersVisible=true; // Never steal the operator's selected ДО/ПОСЛЕ tab.
    record('after-diagnose-cached',report);
    lock(false);
    status('ПОСЛЕ: '+report.issues.length+' неисправленных проблем.'+
      (report.complete?'':' Проверка частичная — межблочные ошибки не исключены.'));
    finalizePendingSettingsApply(preview);
  }catch(error){
    if(generation!==afterDiagnosticGeneration)return;
    preview.afterDiagnosed=true;preview.afterDiagnosticComplete=false;
    preview.afterScope='partial';record('after-diagnosis-error',{error:error.message});
    pendingSettingsApply=false;
    lock(false);status('ПОСЛЕ: проверка не завершилась: '+error.message);
  }
}

async function runProgressiveDiagnostics(indices,tolerance,{diagnosticsOnly=false}={}){
  const generation=++diagnosticGeneration;
  const scope=[],contours=[],unreadable=[];
  lock(true,{coverCanvas:false});
  progressStage('Подготовка контуров к диагностике',2,'0 / '+indices.length);
  try{
    for(let j=0;j<indices.length;j++){
      if(generation!==diagnosticGeneration)return;
      const idx=indices[j];
      try{
        const parts=sampledContours(doc.paths[idx],tolerance);
        if(!parts.length){unreadable.push(idx);}
        for(const part of parts){contours.push(part);scope.push(idx);}
      }catch(error){unreadable.push(idx);record('diagnostic-path-unreadable',{path:idx,message:error.message});}
      if((j+1)%4===0||j===indices.length-1){
        progressStage('Подготовка EPS: контуры',3+32*(j+1)/indices.length,
          (j+1)+' / '+indices.length+' объектов');
        await yieldForUi();
      }
    }
    if(generation!==diagnosticGeneration)return;
    const plan=planDiagnosticBatches(contours,scope);
    if(plan.batches.length>1||plan.totalPoints>2000)showLargeFileNotice({large:true,totalPoints:plan.totalPoints});
    if(!plan.batches.length){
      diagnosticComplete=false;if(!curveEditing()){issues=[];metrics=[];}
      manualDiagnosticsPending=false;curvePreview=null;
      lock(false);
      status('Не удалось проверить контуры: нет доступных расчётных сегментов.');
      return;
    }
    let nextIndex=0,processed=0,checked=0,failedBatches=0,nativeFailure=false,complete=!plan.partial&&!unreadable.length,misplaced=0;
    const results=[],pathMetrics=doc.paths.map(()=>null);
    const dispatch=async()=>{
      if(generation!==diagnosticGeneration)return;
      if(nextIndex===plan.batches.length){
        try{const native=await runNativeJob({action:'diagnose',document:clone(doc),issues:results,indices,tolerance});if(generation!==diagnosticGeneration)return;results.splice(0,results.length,...native.issues);complete=complete&&native.complete;record('native-diagnostic-refinement',{complete:native.complete,unresolved:native.unresolved,nativeLocations:native.nativeLocations});}catch(error){complete=false;nativeFailure=true;const witnessed=results.filter(i=>i.kind!=='coincident'&&i.kind!=='short');results.splice(0,results.length,...witnessed);record('native-diagnostic-error',{error:error.message});}
        if(generation!==diagnosticGeneration)return;
        diagnosticComplete=complete;
        manualReviewPending=false;manualClearancePaused=false;
        markersVisible=true;
        issues=curveEditing()?resolveManualIssues(issues,results,{
          failed:failedBatches>0||nativeFailure||unreadable.length>0||plan.skipped.length>0
        }):results;
        manualDiagnosticsPending=false;
        metrics=pathMetrics;
        curvePreview=null;
        if(importedBefore?.pending){
          importedBefore=captureImportBefore(importedBefore,issues,complete);
          appliedComparison=importedComparison(importedBefore,doc,issues);
        }
        if(!comparisonSelectionExplicit)compareStage='before';
        progressStage('Диагностика завершена',100,processed+' расчётных точек пройдено');
        record('diagnose-large',{batchCount:plan.batches.length,totalPoints:plan.totalPoints,
          processed,checked,failedBatches,issues:issues.length,complete,skipped:unreadable.length+plan.skipped.length,
          split:plan.split,misplaced});
        updateFileHistory({diagnosis:{count:issues.length,complete,
          selected:settingChecked('selection-only')}});
        lock(false);
        status('Пройдено '+processed+' расчётных точек в '+plan.batches.length+
          ' блоках; успешно проверено '+checked+'; найдено '+issues.length+' замечаний.'+
          (complete?'':' Проверка частичная: межблочные связи, лимит замечаний или ошибки не исключены.')+
          (failedBatches?' Блоков с ошибкой: '+failedBatches+'.':'')+
          (misplaced?' Исключены '+misplaced+' маркеров вне соответствующих контуров.':''));
        if(diagnosticsOnly){
          record('user-requested-diagnostics',{issues:issues.length,complete});
          return;
        }
        // Large EPS files may pass Rust diagnostics completely while still
        // containing tens of thousands of original Bézier segments. Running
        // their Union/smoothing synchronously stalls the browser on ПОСЛЕ.
        // Always use cooperative per-object stages above this work threshold.
        const largeWork=plan.totalPoints>2500||indices.length>150;
        record('preview-routing',{points:plan.totalPoints,objects:indices.length,
          progressive:largeWork||!complete});
        if(complete&&!largeWork)void buildUnifiedPreview();
        else if(!curveEditing())void buildLargeUnifiedPreview(indices);
        return;
      }
      const batch=plan.batches[nextIndex];
      const issueInBounds=createIssueBoundsValidator(batch.paths,tolerance);
      const id=++sequence;
      const ordinal=nextIndex+1;
      pending={id,largeDiagnostic:true,onResponse:data=>{
        if(generation!==diagnosticGeneration)return;
        if(data.error||!Array.isArray(data.output?.issues)){
          complete=false;failedBatches++;
          record('diagnostic-batch-error',{batch:ordinal,message:data.error||'Некорректный результат Rust'});
        }else{
          complete=complete&&data.output.diagnosticComplete===true;
          checked+=batch.points;
          for(const issue of data.output.issues){
            if(results.length>=10000){complete=false;break;}
            if(!issueInBounds(issue)){
              misplaced++;complete=false;continue;
            }
            const mapped=mapDiagnosticIssue(issue,batch);
            if(mapped)results.push(mapped);
          }
          data.output.paths?.forEach((p,i)=>{pathMetrics[batch.scope[i]]=p;});
        }
        processed+=batch.points;nextIndex++;
        progressStage('Поиск дефектных точек · блок '+nextIndex+'/'+plan.batches.length,
          35+64*nextIndex/plan.batches.length,
          processed.toLocaleString('ru-RU')+' / '+plan.totalPoints.toLocaleString('ru-RU')+' точек');
        setTimeout(dispatch,0);
      }};
      progressStage('Диагностика: блок '+ordinal+' / '+plan.batches.length,
        35+64*nextIndex/plan.batches.length,
        processed.toLocaleString('ru-RU')+' точек пройдено');
      worker.postMessage({id,input:packedInput(batch.paths,tolerance,0)});
    };
    dispatch();
  }catch(error){
    if(generation!==diagnosticGeneration)return;
    pending=null;diagnosticComplete=false;manualDiagnosticsPending=false;curvePreview=null;
    lock(false);status('Ошибка пакетной диагностики: '+error.message+'; ранее найденные проблемы сохранены.');
    record('diagnostic-large-error',{message:error.message});
  }
}

function calculate(action,{diagnosticsOnly=false}={}){
  if(!ready||busy)return;
  if(currentComparison()&&action){status('Закройте режим ДО/ПОСЛЕ перед ручным редактированием.');return;}
  const selectedScope=doc.paths.map((_,i)=>i).filter(i=>(!settingChecked('selection-only')||!selected.size||selected.has(i))&&doc.paths[i].kind!=='image');
  if(!selectedScope.length){status('Нет векторов для проверки');return;}
  const tol=settingNumber('tolerance'),parameter=Number($('loop-percent').value);
  if(!Number.isFinite(tol)||tol<1e-9||tol>1000){status('Укажите допуск от 0.000000001 до 1000 мм');return;}
  if(action&&selectedScope.some(i=>doc.paths[i].artwork)){status('Исходные EPS-кривые сохранены. Для лечения сначала создайте полилинии кнопкой «Копия для лечения».');return;}
  if(action===0){
    if(diagnosticsOnly){void runProgressiveDiagnostics(selectedScope,tol,{diagnosticsOnly:true});return;}
    const count=selectedScope.reduce((sum,i)=>sum+(doc.paths[i].commands?.length??doc.paths[i].points?.length??0),0);
    if(count>2500||selectedScope.length>150)void buildLargeUnifiedPreview(selectedScope);
    else void buildUnifiedPreview();
    return;
  }
  try{
    const scope=[],paths=[];
    for(const i of selectedScope)for(const p of sampledContours(doc.paths[i],tol)){scope.push(i);paths.push(p);}
    if(paths.reduce((n,p)=>n+p.points.length,0)>2000)throw Error('Для диагностики доступно 2000 узлов за раз. Выделите меньше объектов или увеличьте допуск. Оригиналы не изменены.');
    const input=[tol,action,parameter,paths.length];for(const p of paths)input.push(+p.closed,p.points.length,...p.points.flat());
    const id=++sequence;pending={id,action,scope,before:clone(doc),selectedOnly:selectedScope.length!==doc.paths.filter(p=>p.kind!=='image').length};record('engine-start',{action,scope,tolerance:tol,curveSampling:!action});lock(true,{coverCanvas:false});worker.postMessage({id,input});
  }catch(e){status(e.message);}
}
function at(e){
  {
    const canvas=$('canvas');
    // getScreenCTM().inverse() can synchronously flush thousands of SVG
    // elements on every pointermove. Cache only the element rectangle and
    // map through viewBox + SVG xMidYMid/meet without DOM geometry queries.
    manualScreenRect??=canvas.getBoundingClientRect();
    const point=screenToDocumentPoint(e.clientX,e.clientY,manualScreenRect,canvas.viewBox.baseVal);
    if(point)return point;
  }
  const p=new DOMPoint(e.clientX,e.clientY).matrixTransform($('canvas').getScreenCTM().inverse());
  return [p.x,p.y];
}
function setMode(m){
  if(currentComparison()){status('Закройте режим ДО/ПОСЛЕ перед редактированием.');return;}
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  mode=m;draft=[];
  for(const key of ['select','line','rect','circle'])$(key).classList.toggle('active',key===mode);
  render();
}
function startCurveEditor(){
  if(busy)return;
  if(curveEditing()){exitDeferredCurveEditor();return;}
  // After applying the preview, the editable document is AFTER. Capture its
  // diagnosed witnesses BEFORE applyUnifiedChanges clears the old issue list.
  // An already-applied comparison also refers to the current editable AFTER.
  const useAfter=Boolean((curvePreview&&compareStage==='after')||
    (!curvePreview&&appliedComparison));
  const candidate=curvePreview||(
    appliedComparison?{
      afterDiagnosed:Array.isArray(appliedComparison.afterIssues),
      afterDiagnosticComplete:appliedComparison.afterDiagnosticComplete,
      comparisonData:appliedComparison,hasGeometryChange:false
    }:null);
  const manual=issuesForManualEditor(candidate,useAfter?'after':'before',issues,diagnosticComplete);
  // In AFTER, edit actual optimized geometry, never throw away the preview
  // and silently return to the original dense input document.
  if(curvePreview&&compareStage==='after'){
    if(curvePreview.hasGeometryChange&&!applyUnifiedChanges()){
      status('ПОСЛЕ устарел: пересчитайте изменения перед редактированием узлов.');return;
    }
  }
  clearTimeout(settingsTimeout);clearTimeout(manualLocalTimer);++manualLocalGeneration;
  resetLocalEditors();
  clearTimeout(clearanceTimer);clearanceWorker?.terminate();clearanceWorker=null;
  ++clearanceJob;clearanceKey='';
  curvePreview=null;appliedComparison=null;compareStage='before';
  mode='nodes';nodeTool='move';activeCurveNode=null;draft=[];manualScreenRect=null;
  if(useAfter){issues=manual.issues;diagnosticComplete=manual.complete;}
  manualDiagnosticsPending=useAfter&&!manual.verified;
  markersVisible=true;
  selected=new Set([...selected].filter(i=>doc.paths[i]&&doc.paths[i].kind!=='image'));
  if(!selected.size){const i=doc.paths.findIndex(p=>p.kind!=='image');if(i>=0)selected=new Set([i]);}
  // Prime the native segment index and local SVG layer at editor entry.
  // Otherwise deep zoom before the first node click would repaint the full
  // 2300–7545-C source compound, because localEditors would still be empty.
  const primary=[...selected][0],view=$('canvas').viewBox.baseVal;
  // Light documents retain their old visible native #geometry node glyphs.
  // Prime a detached index only if the document is actually costly to paint.
  if(heavyManualScene(doc.paths)&&Number.isInteger(primary)&&localEditor(primary))manualFocus={path:primary,
    point:[view.x+view.width/2,view.y+view.height/2]};
  render();
  if(manualFocus)drawLocalEditorOverlay();
  // Preserve existing witness rings during editing, but discard them on
  // commit. The operator decides whether to run another diagnostic scan.
  status('Режим локальной правки: «Готово» сохранит кривые без поиска дефектов.');
}
function runLocalNodeEdit(path,action,details={}){
  if(busy||!curveEditing())return false;
  const editor=localEditor(path);
  if(!editor)return false;
  try{
    let result;
    const index=details.index??activeCurveNode?.index;
    if(action==='add')result=editor.addSegment(details.segment,details.t);
    else if(action==='remove')result=editor.removeAnchor(index);
    else if(action==='close')result=editor.closeAt(index);
    else if(action==='break')result=editor.breakAt(index);
    else if(action==='reverse')result=editor.reversePart(index);
    else if(['cusp','smooth','symmetric'].includes(action))result=editor.setKind(index,action);
    else if(action==='line'||action==='curve')result=editor.setSegment(index,action);
    else throw Error('Неизвестное локальное действие '+action);
    if(result===false||Array.isArray(result)&&!result.length)return false;
    manualFocus={path,point:details.point||editor.nodePosition(index)||
      manualFocus?.point||[0,0]};
    if(action==='add')activeCurveNode={path,index:result};
    else if(action==='remove'||action==='break'||action==='reverse')activeCurveNode=null;
    // Only the command-local topology index may change. Never regenerate
    // 7,545 SVG segments or the imported document here.
    if(['add','remove','close','break','reverse'].includes(action))
      localEditorIndexes.set(path,buildAnchorIndex(editor.nodeList()));
    localEditorModified(path,action,
      ['add','remove','close','break','reverse'].includes(action)?
        null:Array.isArray(result)?result:[]);
    return true;
  }catch(error){status(error.message);return false;}
}
function removeActiveCurveNode(){
  if(!activeCurveNode){status('Выберите узел для удаления.');return;}
  runLocalNodeEdit(activeCurveNode.path,'remove',{index:activeCurveNode.index});
}
function runNodeCommand(name){
  if(busy||!curveEditing())return;
  if(name==='add'){nodeTool='add';localEditorToolbar();
    status('Локальный курсор +: выберите сегмент для нового узла.');return;}
  if(name==='remove'){removeActiveCurveNode();return;}
  if(!activeCurveNode){status('Сначала выберите узел.');return;}
  runLocalNodeEdit(activeCurveNode.path,name,{index:activeCurveNode.index});
}
$('curve-edit').onclick=startCurveEditor;
for(const tool of ['move','add','remove','handles'])$('node-'+tool).onclick=()=>{
  if(busy)return;nodeTool=tool;$('node-context').hidden=true;
  if(curveEditing())localEditorToolbar();else render();
};
for(const name of ['cusp','smooth','symmetric','line','curve','break','close','reverse'])
  $('node-'+name).onclick=()=>runNodeCommand(name);
$('node-done').onclick=()=>{$('node-context').hidden=true;startCurveEditor();};
$('node-context').querySelectorAll('[data-node-menu]').forEach(button=>button.onclick=()=>{
  const name=button.dataset.nodeMenu;$('node-context').hidden=true;
  if(name==='add'&&contextHit?.nearest&&contextHit.node===null&&contextHit.nearest.t>1e-6&&contextHit.nearest.t<1-1e-6)
    runLocalNodeEdit(contextHit.path,'add',{segment:contextHit.nearest.index,
      t:contextHit.nearest.t,point:contextHit.point});
  else runNodeCommand(name);
});
$('canvas').addEventListener('contextmenu',e=>{
  if(!curveEditing()||busy)return;
  const target=e.target.closest('[data-path]');if(!target)return;
  const path=Number(target.dataset.path);if(!doc.paths[path]||doc.paths[path].kind==='image')return;
  e.preventDefault();const node=target.dataset.curveNode===undefined?null:Number(target.dataset.curveNode);
  selected=new Set([path]);activeCurveNode=node===null?null:{path,index:node};
  const pos=at(e);manualFocus={path,point:[...pos]};
  const view=$('canvas').viewBox.baseVal,unit=screenUnitsPerPixel(view,$('canvas').clientWidth,$('canvas').clientHeight);
  contextHit={path,node,point:pos,nearest:localEditor(path).nearestSegment(pos,unit*12)};
  drawLocalEditorOverlay();const menu=$('node-context');
  for(const button of menu.querySelectorAll('[data-node-menu]'))
    button.disabled=(node===null&&button.dataset.nodeMenu!=='add')||(node!==null&&button.dataset.nodeMenu==='add');
  menu.hidden=false;
  menu.style.left=Math.max(4,Math.min(e.clientX,window.innerWidth-240))+'px';
  menu.style.top=Math.max(4,Math.min(e.clientY,window.innerHeight-330))+'px';
});
document.addEventListener('pointerdown',e=>{if(!e.target.closest('#node-context'))$('node-context').hidden=true;});
function download(name,content,type='application/json'){const a=document.createElement('a');const url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function validate(value){
  if(value?.format!=='relief-forge'||value.version!==1||!Number.isFinite(value.width)||!Number.isFinite(value.height)||value.width<=0||value.height<=0||!Array.isArray(value.paths))throw Error('Неверный формат проекта');
  let nodes=0;for(const p of value.paths){if(typeof p.closed!=='boolean'||!Array.isArray(p.points)||p.points.some(v=>!Array.isArray(v)||v.length!==2||v.some(n=>!Number.isFinite(n)||Math.abs(n)>1e9)))throw Error('Неверная геометрия');nodes+=p.points.length;}
  if(nodes>200000)throw Error('Документ превышает лимит импорта 200000 узлов. Для расчёта alpha выбирайте не более 2000 узлов за раз.');
  if(value.svgDefs)safeFragment(value.svgDefs);
  for(const p of value.paths)if(p.artwork){safeFragment(p.artwork);if(!['image','vector'].includes(p.kind)||!Array.isArray(p.offset)||p.offset.length!==2||p.offset.some(n=>!Number.isFinite(n))||!Array.isArray(p.commands)||p.commands.some(s=>!Array.isArray(s)||!['M','L','C','Q','Z'].includes(s[0])||s.length!==({M:3,L:3,C:7,Q:5,Z:1}[s[0]])||s.slice(1).some(n=>!Number.isFinite(n))))throw Error('Неверная геометрия EPS / SVG');}
  return clone({format:'relief-forge',version:1,width:value.width,height:value.height,paths:value.paths,svgDefs:value.svgDefs||'',sourceSvg:value.sourceSvg||'',...(value.sourceFileName?{sourceFileName:basename(value.sourceFileName)}:{}),...(value.epsImport?{epsImport:value.epsImport}:{}),...(value.pdfImport?{pdfImport:value.pdfImport}:{})});
}
$('markers').addEventListener('keydown',e=>{
  if(busy||!['Enter',' '].includes(e.key))return;
  const marker=e.target.closest('[data-issue]');
  const issue=marker&&displayedIssues[Number(marker.dataset.issue)];
  if(issue){e.preventDefault();e.stopPropagation();focusIssue(issue);}
});
window.addEventListener('resize',()=>{
  manualScreenRect=null;
  if(curveEditing())scheduleManualZoomRefresh();else scheduleViewZoomRefresh();
});
new ResizeObserver(()=>{
  manualScreenRect=null;
  if(curveEditing())scheduleManualZoomRefresh();else scheduleViewZoomRefresh();
}).observe($('canvas'));
window.addEventListener('scroll',()=>{manualScreenRect=null;},true);
$('canvas').addEventListener('pointerdown',e=>{
  // A new editing gesture uses the viewport actually displayed at pointer
  // down; a queued wheel event must not move its anchor during the drag.
  cancelViewZoom();manualPendingView=null;
  if(busy)return;const pos=at(e);const canvas=$('canvas');
  if(e.button===1){e.preventDefault();pan={pos};const b=canvas.viewBox.baseVal;pan.view=[b.x,b.y,b.width,b.height];canvas.setPointerCapture(e.pointerId);return;}
  if(e.button!==0)return;
  const issueMarker=e.target.closest('[data-issue]');
  if(issueMarker){const issue=displayedIssues[Number(issueMarker.dataset.issue)];if(issue)focusIssue(issue);return;}
  if(currentComparison()){status('Сравнение ДО/ПОСЛЕ доступно только для просмотра. Нажмите × для редактирования.');return;}
  if(curveEditing()){
    const target=e.target.closest('[data-path]');
    if(!target){activeCurveNode=null;drawLocalEditorOverlay();return;}
    const i=Number(target.dataset.path);
    if(doc.paths[i]?.kind==='image'){status('Изображение не содержит редактируемых узлов.');return;}
    const editor=localEditor(i);
    if(!editor)return;
    selected=new Set([i]);manualFocus={path:i,point:[...pos]};
    const index=target.dataset.curveNode===undefined?null:Number(target.dataset.curveNode);
    if(index!==null){
      activeCurveNode={path:i,index};
      if(target.dataset.curveHandle&&nodeTool==='handles'){
        const side=target.dataset.curveHandle,live=editor.viewPatch(index,side);
        const initialTarget=side==='in'?live?.incoming?.at(-2):live?.outgoing?.[1];
        drag={local:true,curveHandle:side,curveNode:index,path:i,
          live,localTarget:initialTarget?[...initialTarget]:[...pos],
          initialTarget:initialTarget?[...initialTarget]:[...pos],
          startPointer:[...pos]};
        canvas.setPointerCapture(e.pointerId);
      }else if(nodeTool==='remove'&&!target.dataset.curveHandle){
        runLocalNodeEdit(i,'remove',{index,point:[...pos]});return;
      }else if(nodeTool==='move'&&!target.dataset.curveHandle){
        const live=editor.viewPatch(index);
        drag={local:true,curveNode:index,path:i,
          live,localTarget:live?[...live.point]:[...pos],
          initialTarget:live?[...live.point]:[...pos],
          startPointer:[...pos]};
        canvas.setPointerCapture(e.pointerId);
      }
    }else if(nodeTool==='add'){
      const view=canvas.viewBox.baseVal,
        hit=screenUnitsPerPixel(view,canvas.clientWidth,canvas.clientHeight)*12;
      const nearest=editor.nearestSegment(pos,hit);
      if(nearest)runLocalNodeEdit(i,'add',{segment:nearest.index,t:nearest.t,
        point:[...pos]});
      else status('Нажмите ближе к кривой, чтобы добавить узел.');
      return;
    }else activeCurveNode=null;
    drawLocalEditorOverlay();
    if(drag?.local&&drag.live)attachLiveCurvePatch();
    return;
  }
  if(mode==='line'){draft.push(pos);render();return;}
  if(mode==='rect'||mode==='circle'){drag={start:pos,before:clone(doc),shape:mode};canvas.setPointerCapture(e.pointerId);return;}
  const target=e.target.closest('[data-path]');
  if(target){const i=Number(target.dataset.path);if(!e.shiftKey&&!selected.has(i))selected.clear();if(e.shiftKey&&selected.has(i))selected.delete(i);else selected.add(i);
    if(target.dataset.node!==undefined)drag={path:i,node:Number(target.dataset.node),before:clone(doc)};
    else drag={move:[...selected],start:pos,before:clone(doc)};
    canvas.setPointerCapture(e.pointerId);
  }else selected.clear();render();
});
let dragRenderFrame=0,liveDragFrame=0;
const scheduleDragRender=()=>{if(!dragRenderFrame)dragRenderFrame=requestAnimationFrame(()=>{dragRenderFrame=0;render();});};
const flushDragRender=()=>{if(dragRenderFrame){cancelAnimationFrame(dragRenderFrame);dragRenderFrame=0;}};
function attachLiveCurvePatch(){
  if(!drag?.live||!curveEditing())return;
  drag.livePath=el('path',{d:'',class:'manual-live-patch'},$('manual-patches'));
  drag.visualNode=$('manual-glyphs').querySelector('[data-path="'+drag.path+'"][data-curve-node="'+drag.curveNode+'"]:not([data-curve-handle])')||
    $('geometry').querySelector('[data-path="'+drag.path+'"][data-curve-node="'+drag.curveNode+'"]:not([data-curve-handle])');
  paintLiveCurvePatch();
}
function paintLiveCurvePatch(){
  if(!drag?.live||!drag.livePath?.isConnected)return;
  drag.livePath.setAttribute('d',drawLiveCurvePatch(drag.live,drag.localTarget));
  if(drag.visualNode&&!drag.curveHandle){
    const dx=drag.localTarget[0]-drag.live.point[0],dy=drag.localTarget[1]-drag.live.point[1];
    drag.visualNode.setAttribute('transform','translate('+dx+' '+dy+')');
  }
}
const scheduleLiveDrag=()=>{
  if(!liveDragFrame)liveDragFrame=requestAnimationFrame(()=>{liveDragFrame=0;paintLiveCurvePatch();});
};
const flushLiveDrag=()=>{if(liveDragFrame){cancelAnimationFrame(liveDragFrame);liveDragFrame=0;}};
$('canvas').addEventListener('pointermove',e=>{
  const pos=at(e);$('coords').textContent=`X ${pos[0].toFixed(2)} · Y ${pos[1].toFixed(2)} мм`;
  if(pan){const b=$('canvas').viewBox.baseVal;const dx=pos[0]-pan.pos[0],dy=pos[1]-pan.pos[1];b.x-=dx;b.y-=dy;if(curveEditing())scheduleManualZoomRefresh();return;}
  if(!drag||busy)return;
  if(drag.live&&(drag.curveHandle||drag.curveNode!==undefined)){
    // No model mutation, SVG reconstruction, Bézier parse or diagnostic
    // Worker occurs in the pointermove hot path.
    drag.localTarget=drag.initialTarget.map((v,i)=>v+pos[i]-drag.startPointer[i]);
    scheduleLiveDrag();
  }else if(drag.curveHandle){
    try{doc.paths[drag.path]=moveCurveHandle(drag.before.paths[drag.path],drag.curveNode,drag.curveHandle,pos);scheduleDragRender();}
    catch(error){status(error.message);}
  }else if(drag.curveNode!==undefined){
    try{doc.paths[drag.path]=moveCurveNode(drag.before.paths[drag.path],drag.curveNode,pos);scheduleDragRender();}
    catch(error){status(error.message);}
  }else if(drag.node!==undefined){doc.paths[drag.path].points[drag.node]=pos;scheduleDragRender();}
  else if(drag.move){const dx=pos[0]-drag.start[0],dy=pos[1]-drag.start[1];for(const i of drag.move){doc.paths[i].points=drag.before.paths[i].points.map(([x,y])=>[x+dx,y+dy]);if(doc.paths[i].artwork)doc.paths[i].offset=[drag.before.paths[i].offset[0]+dx,drag.before.paths[i].offset[1]+dy];}render();}
  else{drag.end=pos;$('draft').replaceChildren();el('path',{d:pathData(makeShape(drag)),class:'path selected'},$('draft'));}
});
function makeShape(d){const [x,y]=d.start,[a,b]=d.end||d.start;
  return d.shape==='rect'?{closed:true,points:[[x,y],[a,y],[a,b],[x,b]]}:{closed:true,points:Array.from({length:96},(_,i)=>{const t=i*Math.PI*2/96,r=Math.hypot(a-x,b-y);return [x+r*Math.cos(t),y+r*Math.sin(t)];})};
}
$('canvas').addEventListener('pointerup',e=>{
  flushDragRender();flushLiveDrag();
  if(pan){pan=null;if(curveEditing())scheduleManualZoomRefresh();return;}if(!drag)return;
  if(drag.local){
    const pos=at(e),editor=localEditor(drag.path),
      target=drag.initialTarget.map((v,i)=>v+pos[i]-drag.startPointer[i]);
    drag.livePath?.remove();
    drag.visualNode?.removeAttribute('transform');
    if(editor&&drag.live&&
       Math.hypot(target[0]-drag.initialTarget[0],target[1]-drag.initialTarget[1])>1e-10){
      try{
        const changed=drag.curveHandle?
          editor.moveHandle(drag.curveNode,drag.curveHandle,target):
          editor.moveAnchor(drag.curveNode,target);
        if(changed.length){
          manualFocus={path:drag.path,point:drag.curveHandle?
            [...(editor.nodePosition(drag.curveNode)||pos)]:[...target]};
          localEditorModified(drag.path,drag.curveHandle?'handle':'move',changed);
        }else drawLocalEditorOverlay();
      }catch(error){status(error.message);drawLocalEditorOverlay();}
    }else drawLocalEditorOverlay();
    drag=null;
    return; // No doc mutation, checkpoint, render, diagnostics or Worker.
  }
  if(drag.shape&&drag.end&&Math.hypot(drag.end[0]-drag.start[0],drag.end[1]-drag.start[1])>.001){doc.paths.push(makeShape(drag));selected=new Set([doc.paths.length-1]);}
  if(curveEditing()&&(drag.curveHandle||drag.curveNode!==undefined))manualFocus={path:drag.path,point:at(e)};
  if(JSON.stringify(doc)!==JSON.stringify(drag.before)){checkpoint(drag.before);changed(drag.curveHandle?'curve-node-handle':drag.curveNode!==undefined?'curve-node-move':drag.shape?'draw-'+drag.shape:'move-nodes');}else render();drag=null;
});
$('canvas').addEventListener('pointercancel',()=>{
  flushDragRender();flushLiveDrag();
  if(drag?.local){drag.livePath?.remove();drag.visualNode?.removeAttribute('transform');
    drag=null;pan=null;drawLocalEditorOverlay();return;}
  if(drag)doc=drag.before;drag=null;pan=null;render();
});
$('canvas').addEventListener('wheel',e=>{
  if(busy)return;e.preventDefault();
  const canvas=$('canvas');manualScreenRect??=canvas.getBoundingClientRect();
  const center=screenToDocumentPoint(e.clientX,e.clientY,manualScreenRect,
    (curveEditing()?manualPendingView:viewPendingBox)||canvas.viewBox.baseVal);
  if(!center)return;
  zoom(e.deltaY>0?1.15:1/1.15,center);
},{passive:false});
document.addEventListener('keydown',e=>{
  if(busy||e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
  if(e.key==='Escape'){
    $('node-context').hidden=true;flushDragRender();flushLiveDrag();
    if(drag?.local){drag.livePath?.remove();drag.visualNode?.removeAttribute('transform');drag=null;
      pan=null;activeCurveNode=null;drawLocalEditorOverlay();}
    else{if(drag){doc=drag.before;drag=null;}pan=null;draft=[];activeCurveNode=null;render();}
  }
  if(e.key==='Enter'&&draft.length>1){checkpoint();doc.paths.push({closed:false,points:draft});draft=[];changed('draw-polyline');}
  const action=keyboardAction(e,curveEditing());if(!action)return;
  e.preventDefault();
  if(action.button){$(action.button).click();return;}
  if(action.repair){document.querySelector('[data-action="'+action.repair+'"]').click();return;}
  if(action.tool){nodeTool=action.tool;
    if(curveEditing())localEditorToolbar();else render();return;}
  if(action.operation)runNodeCommand(action.operation);
});
for(const m of ['select','line','rect','circle'])$(m).onclick=()=>setMode(m);
$('fit').onclick=fit;
$('zoom-in').onclick=()=>zoom(0.8);
$('zoom-out').onclick=()=>zoom(1.25);
$('compare-before').onclick=()=>{if(!currentComparison())return;comparisonSelectionExplicit=true;compareStage='before';record('compare-stage',{stage:'before'});render();};
$('compare-prepared').onclick=()=>{if(!currentComparison()?.preparedDoc)return;comparisonSelectionExplicit=true;compareStage='prepared';record('compare-stage',{stage:'prepared'});render();};
$('compare-after').onclick=()=>{if(!currentComparison())return;comparisonSelectionExplicit=true;compareStage='after';record('compare-stage',{stage:'after'});render();};
$('compare-exit').onclick=()=>{if(busy)return;comparisonSelectionExplicit=false;preparingComparison=null;appliedComparison=null;curvePreview=null;compareStage='before';record('compare-close');render();status('Сравнение закрыто, редактирование доступно.');};
$('toggle-info').onclick=()=>{if(busy)return;const panel=$('info-panel'),expanded=panel.hidden;panel.hidden=!expanded;$('main-layout').classList.toggle('left-collapsed',!expanded);$('toggle-info').setAttribute('aria-expanded',String(expanded));$('toggle-info-label').textContent=expanded?'Сведения ◂':'Сведения ▸';record('info-panel-toggle',{expanded});};
$('toggle-points').onclick=()=>{
  pointsVisible=!pointsVisible;record('toggle-all-anchors',{visible:pointsVisible});
  if(curveEditing()){
    $('toggle-points-label').textContent=pointsVisible?'Скрыть здоровые точки':'Показать здоровые точки';
    $('manual-glyphs').hidden=!pointsVisible;return;
  }
  render();
};
$('toggle-markers').onclick=()=>{
  if(busy||!(displayedIssues.length||clearanceReport?.markers.length))return;
  markersVisible=!markersVisible;record('toggle-issue-markers',{visible:markersVisible});
  if(curveEditing()){
    $('markers').hidden=!markersVisible;
    $('toggle-markers-label').textContent=markersVisible?'Скрыть маркеры':'Показать маркеры';
    return;
  }
  $('markers').hidden=!markersVisible;render();
};
document.querySelectorAll('[data-action]').forEach(e=>e.onclick=()=>{calculate(Number(e.dataset.action));});
$('cancel').onclick=()=>{
  if(importMaskActive){
    importMaskAbort?.abort();importMaskAbort=null;importMaskActive=false;
    doctorMaskCache.invalidate();lock(false);
    record('doctortracer-mask-preparation-cancelled');
    status('Подготовка 600 dpi отменена. Исходные векторы сохранены.');
    return;
  }
  doctorTracerAbort?.abort();doctorTracerAbort=null;preparingComparison=null;pendingSettingsApply=false;clearTimeout(manualLocalTimer);++manualLocalGeneration;cancelNativeJobs();++diagnosticGeneration;++readGeneration;++previewGeneration;++afterDiagnosticGeneration;if(previewActive){previewActive=false;worker.terminate();pending=null;suppressNextDiagnostic=true;spawnWorker();lock(false);status('Оптимизация отменена, оригинальные кривые сохранены.');return;}if(readActive){readActive=false;openingFile=false;updateMascot();lock(false);status('Чтение файла отменено.');return;}if(epsImportActive){stopEps({destroy:true});openingFile=false;updateMascot();lock(false);record('vector-import-cancel');status('Импорт отменён. Предыдущий документ сохранён.');return;}worker.terminate();pending=null;ready=false;suppressNextDiagnostic=true;lock(false);record('engine-cancel');status('Расчёт отменён, документ сохранён.');spawnWorker();};
$('undo').onclick=()=>{
  if(busy)return;
  if(curveEditing()&&localEditUndo.length){
    const path=localEditUndo.pop(),editor=localEditors.get(path);
    if(editor?.undoLocal()){
      localEditRedo.push(path);localEditCount=Math.max(0,localEditCount-1);
      localEditorIndexes.set(path,buildAnchorIndex(editor.nodeList()));
      manualFocus={path,point:manualFocus?.point||[0,0]};activeCurveNode=null;
      syncLocalPatches({reset:true});drawLocalEditorOverlay();
      status('Локальная отмена. Общий документ пока не менялся.');
    }
    return;
  }
  if(curveEditing()){status('Для отмены предыдущей операции сначала завершите локальный редактор.');return;}
  if(!past.length)return;
  future.push(clone(doc));doc=past.pop();selected.clear();changed('undo',{skipDiagnostics:manualReviewPending});
};
$('redo').onclick=()=>{
  if(busy)return;
  if(curveEditing()&&localEditRedo.length){
    const path=localEditRedo.pop(),editor=localEditors.get(path);
    if(editor?.redoLocal()){
      localEditUndo.push(path);localEditCount++;
      localEditorIndexes.set(path,buildAnchorIndex(editor.nodeList()));
      manualFocus={path,point:manualFocus?.point||[0,0]};activeCurveNode=null;
      syncLocalPatches({reset:true});drawLocalEditorOverlay();
      status('Локальный повтор; изменения ещё не записаны в фигуру.');
    }
    return;
  }
  if(curveEditing()){status('Для повторения предыдущей операции завершите локальный редактор.');return;}
  if(!future.length)return;
  past.push(clone(doc));doc=future.pop();selected.clear();changed('redo',{skipDiagnostics:manualReviewPending});
};
$('delete').onclick=()=>{if(!selected.size)return;checkpoint();doc.paths=doc.paths.filter((_,i)=>!selected.has(i));selected.clear();changed('delete');};
$('new').onclick=()=>{
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  activeHistoryId=null;clearTimeout(manualLocalTimer);++manualLocalGeneration;
  manualFocus=null;mode='select';resetLocalEditors();checkpoint();
  doc={format:'relief-forge',version:1,width:300,height:200,paths:[]};
  importedBefore=null;selected.clear();changed('new');fit();
};
for(const key of ['width','height'])$(key).onchange=()=>{const v=Number($(key).value);if(v>0&&v<1e6){checkpoint();doc[key]=v;changed('resize-sheet');fit();}else render();};
$('save').onclick=()=>{
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  record('save-project');download('doktor-uzelkov.rf.json',
    JSON.stringify({...doc,journal,history:{past,future}},null,2));
};
function stopEps({destroy=false}={}){const picker=$('pdf-page-picker');if(picker?.open)picker.close();epsImportActive=false;clearTimeout(epsTimer);epsTimer=null;if(epsWorker){epsWorker.onmessage=null;epsWorker.onerror=null;}if(destroy){epsWorker?.terminate();epsWorker=null;}}
async function prepareImportBlackMask(opened){
  const token=doctorMaskCache.generation;
  if(opened.paths.some(p=>p.kind==='image')){
    record('doctortracer-mask-not-prepared',{reason:'raster-objects',source:opened.sourceFileName});
    if(ready&&doc===opened)calculate(0);
    return;
  }
  const abort=new AbortController();importMaskAbort=abort;importMaskActive=true;
  lock(true,{coverCanvas:false});
  progressStage('Импорт: чёрный силуэт на прозрачном фоне · 600 dpi',87);
  try{
    // Let the import UI paint before the synchronous vector->Canvas stage.
    await yieldForUi();
    const entry=await doctorMaskCache.prepare(opened,{
      signal:abort.signal,yieldUi:yieldForUi,
      onProgress:f=>{
        if(doc===opened&&token===doctorMaskCache.generation)
          progressStage('Создание временной маски 600 dpi',87+Math.round(f*11));
      }
    });
    if(!entry||doc!==opened||token!==doctorMaskCache.generation)return;
    const capped=entry.plan.dpi<PREPARED_RASTER_DPI-1;
    record('doctortracer-mask-prepared',{
      source:opened.sourceFileName||null,requestedDpi:PREPARED_RASTER_DPI,
      effectiveDpi:Number(entry.plan.dpi.toFixed(3)),
      width:entry.plan.width,height:entry.plan.height,
      alphaBytes:entry.alpha.byteLength,storage:'temporary-memory',
      color:'black-transparent',capped
    });
    $('doctortracer-status').textContent=
      'DoctorTracer 0.21.1: чёрный растр '+entry.plan.width+'×'+entry.plan.height+
      ' подготовлен при '+entry.plan.dpi.toFixed(1)+' dpi (цель 600). '+
      'Хранится только прозрачность в памяти. Трассировка — после проверки ошибок.';
  }catch(error){
    if(!abort.signal.aborted&&doc===opened&&token===doctorMaskCache.generation){
      record('doctortracer-mask-prepare-error',{
        source:opened.sourceFileName||null,error:error.message});
      $('doctortracer-status').textContent=
        'Растр 600 dpi не подготовлен: '+error.message+
        '. Вектор будет проверен без изменения.';
    }
  }finally{
    if(importMaskAbort===abort){importMaskAbort=null;importMaskActive=false;}
    if(doc===opened&&token===doctorMaskCache.generation){
      lock(false);
      if(ready&&opened.paths.some(p=>p.kind!=='image'))calculate(0);
    }
  }
}
function openValue(value,name,historyStarted=false){const next=validate(value),old=clone(doc);doctorMaskCache.invalidate();resetLocalEditors();openingFile=false;lastImportFailure=null;lastImportAttempt={source:name,status:'opened',objects:next.paths.length};forceWireframe=false;syncWireframeControl();if(!historyStarted)beginFileHistory(name);next.sourceFileName=basename(next.sourceFileName||next.epsImport?.name||name);const restoredPast=Array.isArray(value.history?.past)?value.history.past.slice(-100).map(validate):null;const restoredFuture=Array.isArray(value.history?.future)?value.history.future.slice(-100).map(validate):[];const restoredJournal=Array.isArray(value.journal)?value.journal.slice(-100000):[];checkpoint();if(restoredPast){past=[old,...restoredPast].slice(-100);future=restoredFuture;}journal.push(...restoredJournal);clearTimeout(manualLocalTimer);++manualLocalGeneration;manualFocus=null;mode='select';doc=next;selected.clear();changed('import-'+name);importedBefore=beginImportBefore(doc);comparisonSelectionExplicit=false;compareStage='before';fit();scheduleWorkspaceCheck();updateFileHistory({status:'Открыт · '+doc.paths.length+' контуров; '+
  (settingChecked('doctortracer-enabled')?'подготовка маски 600 dpi':'векторная проверка без DoctorTracer')});
  if(doc.paths.some(p=>p.kind!=='image')){
    if(settingChecked('doctortracer-enabled'))void prepareImportBlackMask(doc);
    else{ $('doctortracer-status').textContent='DoctorTracer 0.21.1 отключён. Маска 600 dpi не создаётся.';
      if(ready)calculate(0); }
  }}
function importEps(bytes,name,historyStarted=false){
  if(busy)return;openingFile=true;lastImportFailure=null;lastImportAttempt={source:name,status:'converting',bytes:bytes.byteLength};updateMascot();if(!historyStarted)beginFileHistory(name);lock(true);$('busy-label').textContent='Подготовка импорта '+(/\.pdf$/i.test(name)?'PDF':'EPS')+'…';record('vector-import-start',{name,bytes:bytes.byteLength,fonts:importFonts.map(f=>f.name)});
  epsImportActive=true;epsWorker??=new Worker(new URL('eps-worker.js?v=0.2.0-alpha.75',import.meta.url));
  progressStage(/\.pdf$/i.test(name)?'Импорт PDF: подготовка MuPDF':'Импорт EPS: подготовка интерпретатора',9);
  const started=performance.now();let downloadLoaded=0,lastDownloadLogAt=0;
  const fail=message=>{
    const reason=String(message||'Неизвестная ошибка импорта');
    lastImportFailure={source:name,code:/0 контуров|пустая страница|нет векторных объектов/i.test(reason)?
      'EPS_EMPTY_GEOMETRY':'IMPORT_FAILED',message:reason.slice(0,1100)};
    lastImportAttempt={source:name,status:'failed',bytes:bytes.byteLength};
    stopEps({destroy:true});openingFile=false;updateMascot();lock(false);
    workspaceScan({manual:true});status(reason);$('import-report').textContent='Не удалось открыть '+(/\.pdf$/i.test(name)?'PDF':'EPS')+': '+message;record('vector-import-error',{name,message});updateFileHistory({status:'Ошибка открытия: '+String(message).slice(0,180)});};
  const armTimer=()=>{clearTimeout(epsTimer);epsTimer=setTimeout(()=>fail('Импорт не сообщал о прогрессе 120 секунд. Исходный документ сохранён.'),120000);};
  armTimer();
  epsWorker.onerror=e=>fail('Ошибка импортера: '+e.message);
  epsWorker.onmessage=({data})=>{
    if(data.type==='progress'){if(!data.download||data.download.loaded>downloadLoaded){downloadLoaded=Math.max(downloadLoaded,data.download?.loaded||0);armTimer();if(data.download&&(performance.now()-lastDownloadLogAt>=1000||data.download.total&&downloadLoaded>=data.download.total)){lastDownloadLogAt=performance.now();record('vector-engine-download',{receivedBytes:downloadLoaded,totalBytes:data.download.total||null,elapsedMs:Math.round(performance.now()-started),stage:data.message});}}progressStage(data.message,data.percent);return;}
    if(data.type==='pages'){
      clearTimeout(epsTimer);epsTimer=null;
      const picker=$('pdf-page-picker'),select=$('pdf-page-number');
      select.replaceChildren();
      for(const page of data.pages){
        const option=document.createElement('option');option.value=String(page.index);
        option.textContent='Страница '+page.number+' · '+(page.widthPt*25.4/72).toFixed(1)+
          ' × '+(page.heightPt*25.4/72).toFixed(1)+' мм';
        select.append(option);
      }
      $('pdf-page-count').textContent='Страниц в документе: '+data.count+
        '. Выберите страницу для редактирования. Исходный PDF не изменяется.';
      $('pdf-page-confirm').disabled=false;$('pdf-page-cancel').disabled=false;select.disabled=false;
      picker.showModal();
      $('pdf-page-confirm').onclick=()=>{
        const index=Number(select.value);
        if(!Number.isInteger(index)||index<0||index>=data.count)return;
        picker.close();$('pdf-page-confirm').disabled=true;$('pdf-page-cancel').disabled=true;
        progressStage('Извлечение выбранной страницы PDF',60,'Страница '+(index+1));
        armTimer();
        epsWorker.postMessage({type:'select-pdf-page',pageIndex:index});
      };
      $('pdf-page-cancel').onclick=()=>fail('Выбор страницы PDF отменён; предыдущий документ сохранён.');
      picker.oncancel=e=>{e.preventDefault();fail('Выбор страницы PDF отменён; предыдущий документ сохранён.');};
      return;
    }
    if(data.type==='error'){fail(data.message);return;}
    if(data.type==='done')try{
      progressStage('Создание редактируемых кривых',92);
      const next=importRichSvg(data.result.svg,{unitsPerInch:72});
      const integrity=assessImportedGeometry(next,{format:data.format==='pdf'?'pdf':'eps',
        source:name,allowEmpty:data.format==='pdf',conversion:data.result});
      record('import-integrity',{name,format:data.format||'eps',...integrity});
      let binary='';if(data.format!=='pdf'){const chunks=[];for(let i=0;i<bytes.length;i+=32768)chunks.push(String.fromCharCode(...bytes.subarray(i,i+32768)));binary=chunks.join('');}
      if(data.format==='pdf'){
        next.pdfImport={name,...data.result.metadata,engine:'MuPDF 1.28.1'};
      }else{
        next.epsImport={name,originalBase64:btoa(binary),originalGeometryStamp:geometryStamp(next),
          ...data.result.metadata,warnings:data.result.warnings,logs:data.result.logs,
          outlineRecovery:data.result.outlineRecovery||null,engines:{ghostscript:'10.08.0',mupdf:'1.28.1'}};
      }
      const durationMs=performance.now()-started;stopEps();lock(false);openValue(next,name,true);record(data.format==='pdf'?'pdf-import-time':'eps-import-time',{name,format:data.format||'eps',bytes:bytes.length,ms:Math.round(durationMs),workerMs:data.durationMs||0,fastPath:Boolean(data.fastPath),warm:Boolean(data.warm)});
      if(data.format==='pdf'){
        status('PDF импортирован: страница '+data.result.metadata.pageNumber+'/'+data.result.metadata.pageCount+
          ' · '+next.paths.length+' объектов. Векторные кривые доступны для редактирования.');
      }else if(data.result.outlineRecovery){
        record('eps-outline-recovery',data.result.outlineRecovery);
        status(`Восстановлено ${data.result.outlineRecovery.count} непечатаемых EPS-контуров. Обводки только для просмотра; начинается проверка векторов…`);
      }else status(`EPS импортирован: ${next.paths.length} объектов. ${data.result.warnings.length?'Есть предупреждения — см. панель EPS.':'Кривые и оформление сохранены.'}`);
    }catch(e){fail(e.message);}
  };
  const transfer=bytes.slice();epsWorker.postMessage({kind:/\.pdf$/i.test(name)?'pdf':'eps',bytes:transfer,fonts:importFonts},[transfer.buffer]);
}
async function importUserFile(file,origin='dialog'){
  if(!file||busy||readActive)return;
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  if(!isSupportedDrop(file)){status('Поддерживаются PDF, EPS, PS, SVG и проекты JSON.');return;}
  showLargeFileNotice(null);
  if(file.size>64*1024*1024){status('Файл превышает 64 МБ. Импорт отклонён.');return;}
  clearTimeout(settingsTimeout); // Import commits its own recalculation; discard the old settings job.
  beginFileHistory(file.name);
  const token=++readGeneration;
  openingFile=true;updateMascot();
  readActive=true;lock(true,{coverCanvas:false});
  record('open-file',{name:file.name,origin,bytes:file.size});
  try{
    // Stream reads expose real byte progress and avoid one big unresponsive
    // FileReader result on large files. Keep original filename intact.
    const parts=[];let size=0;
    const reader=file.stream().getReader();
    try{
      for(;;){
        const {value,done}=await reader.read();if(done)break;
        if(token!==readGeneration)throw Error('Чтение отменено');
        parts.push(value);size+=value.byteLength;
        progressStage('Чтение файла «'+file.name+'»',Math.round(8*size/Math.max(1,file.size)),
          (size/1024/1024).toFixed(1)+' / '+(file.size/1024/1024).toFixed(1)+' МБ');
      }
    }finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let pos=0;
    for(const part of parts){bytes.set(part,pos);pos+=part.byteLength;}
    const complexity=inspectDocumentComplexity(bytes,file.name);
    if(complexity.large)showLargeFileNotice(complexity);
    record('file-complexity-preflight',{name:file.name,...complexity});
    readActive=false;lock(false);
    if(/\.(eps|epsf|epsi|ps|pdf)$/i.test(file.name))importEps(bytes,file.name,true);
    else{
      progressStage('Разбор документа',35);
      const content=new TextDecoder().decode(bytes);
      openValue(/\.svg$/i.test(file.name)?importRichSvg(content):JSON.parse(content),file.name,true);
      endProgress();
    }
  }catch(err){
    readActive=false;openingFile=false;updateMascot();lock(false);
    lastImportFailure={source:file.name,code:'FILE_READ_FAILED',message:String(err.message).slice(0,1100)};
    lastImportAttempt={source:file.name,status:'failed',bytes:file.size};
    workspaceScan({manual:true});endProgress();
    status(err.message);record('import-error',{name:file.name,origin,message:err.message});
    updateFileHistory({status:'Ошибка открытия: '+String(err.message).slice(0,180)});
  }
}
$('open').onclick=()=>$('file').click();
$('file').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)void importUserFile(file);};
let fileDragDepth=0;
const hasFiles=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
const showDropOverlay=on=>{
  $('drop-overlay').hidden=!on;
  $('drop-target').classList.toggle('is-file-dragging',on);
};
window.addEventListener('dragenter',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();fileDragDepth++;
  if(!busy)showDropOverlay(true);
});
window.addEventListener('dragover',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();
  if(e.dataTransfer)e.dataTransfer.dropEffect=busy?'none':'copy';
});
window.addEventListener('dragleave',e=>{
  if(!hasFiles(e))return;
  fileDragDepth=Math.max(0,fileDragDepth-1);
  if(fileDragDepth===0)showDropOverlay(false);
});
window.addEventListener('drop',e=>{
  if(!hasFiles(e))return;
  e.preventDefault();fileDragDepth=0;showDropOverlay(false);
  if(busy||readActive){status('Идёт обработка. Завершите или отмените её перед открытием другого файла.');return;}
  const files=droppedFiles(e);
  if(files.length!==1||e.dataTransfer.files.length!==1){
    status('Перетащите один PDF, EPS, PS, SVG или JSON-файл.');return;
  }
  void importUserFile(files[0],'drag-drop');
});
$('fonts').onchange=async e=>{try{const files=[...e.target.files];if(files.reduce((n,f)=>n+f.size,0)>32*1024*1024)throw Error('Шрифты: максимум 32 МБ');importFonts=await Promise.all(files.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())})));$('font-count').textContent=importFonts.length+' шрифтов';status('Шрифты будут использованы при следующем импорте EPS.');}catch(error){status(error.message);}};
$('demo-eps').onclick=async()=>{try{const response=await fetch('examples/curves-text-clip.eps');if(!response.ok)throw Error('Не удалось загрузить пример');importEps(new Uint8Array(await response.arrayBuffer()),'curves-text-clip.eps');}catch(e){status(e.message);}};
$('heal-copy').onclick=()=>{try{const ids=[...selected].filter(i=>doc.paths[i].kind!=='image');if(!ids.length)throw Error('Выделите импортированные векторы');const tol=settingNumber('tolerance');if(!Number.isFinite(tol)||tol<1e-6||tol>1000)throw Error('Укажите допуск от 0.000001 до 1000 мм');const copies=ids.flatMap(i=>sampledContours(doc.paths[i],tol));checkpoint();const start=doc.paths.length;doc.paths.push(...copies);selected=new Set(copies.map((_,i)=>start+i));changed('create-healing-copy');status(`Создано ${copies.length} полилиний, допуск ${tol} мм. Исходные кривые сохранены отдельными объектами.`);}catch(e){status(e.message);}};
$('export').onclick=()=>{
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  download('relief-forge.svg',exportDocument(doc),'image/svg+xml');record('export-svg');
};
function readEpsSaveSettings(){
  return {diagnosticTolerance:settingNumber('tolerance'),
    smoothingAmount:settingNumber('smoothing-amount'),
    optimizationTolerance:settingNumber('optimization-tolerance'),
    mergeOverlaps:settingChecked('merge-overlaps'),
    microEnabled:settingChecked('remove-micro'),
    microWidth:settingNumber('micro-width'),
    microHeight:settingNumber('micro-height'),
    scope:selectedVectorIndices(doc,selected,settingChecked('selection-only'))};
}
let epsColorMode='outline';
function prepareEpsOutput(document){
  return epsColorMode==='original'?exportColoredEps(document):{content:exportEps(document),source:'outline'};
}
let pendingAfterSave=null;
function exportConfirmedEps({snapshot=null,overridden=false}={}){
  try{
    const chosen=snapshot||chooseAfterSnapshot(doc,curvePreview,readEpsSaveSettings(),
      appliedComparison,{issues,complete:diagnosticComplete,current:false,fullScope:false});
    if(!chosen.valid)throw Error('Результат ПОСЛЕ устарел. Повторите обработку.');
    const prepared=prepareEpsOutput(chosen.document);
    const verifiedOutput=verifyEpsOutputGeometry(chosen.document,prepared);
    const eps=prepared.content;
    const resultName=epsResultFilename(chosen.document.sourceFileName||doc.sourceFileName||
      doc.epsImport?.name||'relief-forge.eps');
    download(resultName,eps,'application/postscript');
    // Commit the exact exported optimized geometry; Undo restores the
    // original, and no second repair or diagnostic is invoked.
    const applied=Boolean(chosen.preview&&applyUnifiedChanges());
    updateFileHistory({exportName:resultName,exportAt:new Date().toISOString(),
      status:'EPS ПОСЛЕ · '+(epsColorMode==='original'?'цвет':'без цвета')+
        (overridden?' · остаточные ошибки подтверждены':'')});
    record('export-eps-after',{name:resultName,source:chosen.stage,
      colorMode:epsColorMode,colorSource:prepared.source,
      bytes:eps.length,applied,overridden,issues:chosen.issues?.length??null,
      verified:chosen.complete,diagnosticReused:true,realNodes:verifiedOutput.realNodes,
      exportGeometry:verifiedOutput.status});
    status('EPS сохранён: '+resultName+
      ' · экспортирован готовый результат '+(chosen.stage==='current'?'': 'ПОСЛЕ')+
      ' без повторной обработки'+
      (overridden?' · с подтверждёнными замечаниями':'')+'.');
    pendingAfterSave=null;
  }catch(error){
    record('eps-export-error',{message:error.message,mode:epsColorMode});
    status('Не удалось сохранить EPS: '+error.message);
  }
}
function showEpsSaveWarning(decision,snapshot){
  const dialog=$('eps-save-warning');
  pendingAfterSave=snapshot;
  $('eps-save-warning-message').textContent=afterSaveMessage(decision,snapshot.stage)+
    '\nСохранить обработанный результат с замечаниями или вернуться к редактированию?';
  record('eps-save-after-warning',{count:decision.count,complete:decision.complete,
    stage:snapshot.stage,reason:decision.reason});
  if(!dialog.open)dialog.showModal();
  $('eps-save-return').focus();
}
$('eps-save-return').onclick=()=>{
  $('eps-save-warning').close();pendingAfterSave=null;
  record('eps-save-return');status('Сохранение отменено. Исправления ПОСЛЕ остаются в редакторе.');
};
$('eps-save-anyway').onclick=()=>{
  if(!$('eps-save-warning').open||!pendingAfterSave)return;
  const snapshot=pendingAfterSave;
  $('eps-save-warning').close();
  record('eps-save-after-confirmed');
  exportConfirmedEps({snapshot,overridden:true});
};
$('eps-save-warning').addEventListener('cancel',()=>{
  pendingAfterSave=null;record('eps-save-return');
  status('Сохранение отменено. Результат ПОСЛЕ сохранён в редакторе.');
});
function saveExistingAfterResult(){
  if(busy||readActive||$('eps-save-warning').open)return;
  const snapshot=chooseAfterSnapshot(doc,curvePreview,readEpsSaveSettings(),
    appliedComparison,{issues,complete:diagnosticComplete,current:false,fullScope:false});
  const decision=afterSaveDecision(snapshot);
  record('eps-save-cached-result',{stage:snapshot.stage||'stale',
    complete:snapshot.complete,errors:decision.count,action:decision.action});
  if(decision.action==='stop'){
    status(afterSaveMessage(decision));return;
  }
  if(decision.action==='warn'){
    showEpsSaveWarning(decision,snapshot);return;
  }
  exportConfirmedEps({snapshot});
}
$('export-eps').onclick=()=>{
  if(busy||readActive)return;
  if(curveEditing()&&!exitDeferredCurveEditor())return;
  $('eps-color-choice').showModal();
};
$('eps-color-cancel').onclick=()=>$('eps-color-choice').close();
$('eps-color-confirm').onclick=()=>{
  const choice=document.querySelector('input[name="eps-color-mode"]:checked');
  epsColorMode=choice?.value==='original'?'original':'outline';
  $('eps-color-choice').close();
  record('eps-export-mode',{mode:epsColorMode});
  saveExistingAfterResult();
};
$('log').onclick=()=>download('relief-forge-session.jsonl',journal.map(x=>JSON.stringify(x)).join('\n'),'application/x-ndjson');
$('demo').onclick=()=>{activeHistoryId=null;checkpoint();doc={format:'relief-forge',version:1,width:150,height:100,paths:[{closed:true,points:[[10,10],[50,50],[10,50],[50,10]]},{closed:true,points:[[70,10],[110,10],[110,40],[70,40]]},{closed:true,points:[[110,40],[110,10],[70,10],[70,40]]},{closed:false,points:[[10,70],[30,70],[30.003,70],[50,70]]},{closed:false,points:[[50.005,70],[80,70],[80,90]]}]};selected.clear();changed('load-demo');fit();};
document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{
  const filter=b.dataset.filter;
  if(filter==='none'){selected.clear();render();if(!curveEditing())requestRecalculation();return;}
  if(filter==='duplicate'&&!issues.length){status('Сначала найдите проблемы (для всех объектов снимите выделение).');return;}
  const area=p=>p.closed?p.points.reduce((sum,a,i)=>{const b=p.points[(i+1)%p.points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2:0;
  const length=p=>p.points.reduce((sum,a,i)=>{if(i===p.points.length-1&&!p.closed)return sum;const b=p.points[(i+1)%p.points.length];return sum+Math.hypot(a[0]-b[0],a[1]-b[1]);},0);
  const al=Number($('area-limit').value),ll=Number($('length-limit').value);
  selected=new Set(doc.paths.map((p,i)=>({p,i})).filter(({p,i})=>filter==='all'||filter==='open'&&!p.closed||filter==='closed'&&p.closed||filter==='cw'&&area(p)>0||filter==='ccw'&&area(p)<0||filter==='duplicate'&&issues.some(x=>x.kind==='duplicate'&&x.path===i)||filter==='area-less'&&p.closed&&Math.abs(area(p))<al||filter==='area-more'&&p.closed&&Math.abs(area(p))>al||filter==='length-less'&&length(p)<ll||filter==='length-more'&&length(p)>ll).map(({i})=>i));render();if(!curveEditing())requestRecalculation();
});
record('session-start',{version:'0.2.0-alpha.75'});renderFileHistory();spawnWorker();fit();document.documentElement.dataset.doctorVersion='0.2.0-alpha.75';document.documentElement.dataset.doctorReady='true';document.dispatchEvent(new Event('doctor-ready'));
