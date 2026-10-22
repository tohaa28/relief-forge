// Persist only filename/date/diagnostic summaries. Never store uploaded artwork
// bytes, project contents, or original file paths in localStorage.
export const HISTORY_KEY='relief-forge.file-history.v1';
export const HISTORY_LIMIT=200;
export function basename(name){
  const raw=String(name||'').split(/[\\/]/).pop()||'';
  const trimmed=raw.replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g,'_').replace(/[. ]+$/g,'').slice(0,180);
  return trimmed || 'relief-forge';
}
export function epsResultFilename(source){
  const file=basename(source);
  const dot=file.lastIndexOf('.');
  const root=dot>0?file.slice(0,dot):file;
  return (root||'relief-forge')+'_result.eps';
}
export function emptyHistory(){return [];}
function isEntry(e){return e&&typeof e==='object'&&typeof e.id==='string'&&typeof e.openedAt==='string'&&typeof e.filename==='string';}
export function readHistory(storage){
  try{
    const raw=storage?.getItem(HISTORY_KEY);
    if(!raw)return [];
    const decoded=JSON.parse(raw);
    return Array.isArray(decoded)?decoded.filter(isEntry).slice(0,HISTORY_LIMIT):[];
  }catch{return [];}
}
export function persistHistory(storage,entries){
  try{storage?.setItem(HISTORY_KEY,JSON.stringify(entries.slice(0,HISTORY_LIMIT)));return true;}
  catch{return false;}
}
export function createHistoryEntry(entries,{id,filename,openedAt}){
  if(!id||!Number.isFinite(Date.parse(openedAt)))throw Error('Некорректная дата истории');
  const record={id:String(id),filename:basename(filename),openedAt,status:'Открыт · проверка не выполнена'};
  return [record,...entries].slice(0,HISTORY_LIMIT);
}
export function updateHistoryEntry(entries,id,patch){
  const safe=Object.fromEntries(Object.entries(patch).filter(([key])=>['status','diagnosis','repair','exportName','exportAt'].includes(key)));
  return entries.map(item=>item.id===id?{...item,...safe}:item);
}
export function formatHistoryStatus(row){
  if(!row)return 'Неизвестно';
  let result=String(row.status||'Открыт');
  if(row.diagnosis&&Number.isInteger(row.diagnosis.count)){
    result=(row.diagnosis.complete===false?'Частичная проверка: ':'')+
      (row.diagnosis.count===0?'Без замечаний':'Замечаний: '+row.diagnosis.count)+
      (row.diagnosis.selected?' (выделенные)':'');
  }
  if(row.repair&&Number.isInteger(row.repair.before)&&Number.isInteger(row.repair.after))
    result='Исправлено: '+row.repair.before+' → '+row.repair.after+' замечаний';
  if(row.exportName)result+=' · EPS: '+basename(row.exportName);
  return result;
}
export function formatHistoryDate(iso,locale='ru-RU'){
  const d=new Date(iso);
  return Number.isNaN(d.valueOf())?'—':d.toLocaleString(locale,{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
