import test from 'node:test';
import assert from 'node:assert/strict';
import {basename,epsResultFilename,readHistory,persistHistory,createHistoryEntry,updateHistoryEntry,formatHistoryStatus,formatHistoryDate,HISTORY_KEY,HISTORY_LIMIT} from '../web/file-history.js';

function localStorage(){
  const memory=new Map();
  return {getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
}
test('export EPS retains original file basename and appends _result before .eps',()=>{
  assert.equal(epsResultFilename('7921701_02_09.eps'),'7921701_02_09_result.eps');
  assert.equal(epsResultFilename('заказ №5.ФИНАЛ.EPS'),'заказ №5.ФИНАЛ_result.eps');
  assert.equal(epsResultFilename('logo.svg'),'logo_result.eps');
  assert.equal(epsResultFilename('CLIENT.one.two.eps'),'CLIENT.one.two_result.eps');
  assert.equal(epsResultFilename('no extension'),'no extension_result.eps');
  assert.equal(epsResultFilename('C:\\my\\path\\logo.eps'),'logo_result.eps');
  assert.equal(epsResultFilename('../directory/any:bad*.EPS'),'any_bad__result.eps');
  assert.equal(epsResultFilename(''),'relief-forge_result.eps');
  assert.equal(basename('a'.repeat(999)).length,180);
});
test('history survives a browser restart and preserves same filename as independent records',()=>{
  const storage=localStorage();
  let history=readHistory(storage);
  const date='2026-10-22T13:01:02.000Z';
  history=createHistoryEntry(history,{id:'1',filename:'logo.eps',openedAt:date});
  history=updateHistoryEntry(history,'1',{diagnosis:{count:51,complete:true,selected:false}});
  history=updateHistoryEntry(history,'1',{repair:{before:51,after:0}});
  history=updateHistoryEntry(history,'1',{exportName:'logo_result.eps'});
  history=createHistoryEntry(history,{id:'2',filename:'logo.eps',openedAt:'2026-10-22T13:05:02.000Z'});
  assert.equal(persistHistory(storage,history),true);
  const reopened=readHistory(storage);
  assert.equal(reopened.length,2);
  assert.deepEqual(reopened.map(x=>x.id),['2','1']);
  assert.equal(reopened[0].filename,'logo.eps');
  assert.match(formatHistoryStatus(reopened[0]),/проверка не выполнена/);
  assert.match(formatHistoryStatus(reopened[1]),/Исправлено: 51 → 0 замечаний/);
  assert.match(formatHistoryStatus(reopened[1]),/EPS: logo_result\.eps/);
  assert.equal(formatHistoryDate(date,'ru-RU').startsWith('22.10.2026'),true);
});
test('diagnosis result distinguishes completed, empty, partial and selected-only checks',()=>{
  const row={status:'Открыт'};
  assert.equal(formatHistoryStatus({...row,diagnosis:{count:0,complete:true}}),'Без замечаний');
  assert.equal(formatHistoryStatus({...row,diagnosis:{count:12,selected:true,complete:true}}),'Замечаний: 12 (выделенные)');
  assert.equal(formatHistoryStatus({...row,diagnosis:{count:10000,complete:false}}),'Частичная проверка: Замечаний: 10000');
});
test('browser local history is bounded and contains summaries only',()=>{
  let rows=[];
  for(let i=0;i<250;i++)rows=createHistoryEntry(rows,{id:String(i),filename:'file'+i+'.eps',openedAt:'2026-10-22T01:00:00Z'});
  assert.equal(rows.length,HISTORY_LIMIT);
  assert.equal(rows[0].id,'249');
  assert.equal(rows.at(-1).id,'50');
  const storage=localStorage();persistHistory(storage,rows);
  assert.equal(storage.getItem(HISTORY_KEY).includes('originalBase64'),false);
  assert.equal(readHistory(storage).length,HISTORY_LIMIT);
  const changed=updateHistoryEntry(rows,'249',{status:'Проверен',password:'secret',originalBase64:'encoded-data'});
  assert.equal('originalBase64' in changed[0],false);
  assert.equal('password' in changed[0],false);
});
test('corrupt browser data or disabled localStorage does not break file importing',()=>{
  const broken={getItem:()=>'{bad json',setItem:()=>{throw Error('quota exceeded')}};
  assert.deepEqual(readHistory(broken),[]);
  assert.equal(persistHistory(broken,[]),false);
  assert.equal(persistHistory(null,[]),false);
  assert.deepEqual(readHistory({getItem:()=>JSON.stringify({invalid:true})}),[]);
  assert.throws(()=>createHistoryEntry([],{filename:'f',id:'',openedAt:'bad date'}),/истории/);
});
