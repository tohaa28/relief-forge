import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const root=new URL('../',import.meta.url).pathname;
const file=path=>readFileSync(join(root,path),'utf8');
const required=[
  'AGENTS.md','HANDOFF.md','docs/NEXT_CHAT_START.md',
  'docs/history/RELEASE_CHRONICLE.md',
  'docs/history/FAILURE_REGISTER.md',
  'docs/history/METHODS_AND_DECISIONS.md',
  'docs/history/WORKLOG_PROTOCOL.md',
  'docs/DEVELOPMENT_LOG.md','docs/FEATURE_MATRIX.md','logs/actions.jsonl'
];
test('current repository has complete permanent histories and handoff documents',()=>{
  for(const p of required){
    assert.ok(existsSync(join(root,p)),'Missing mandatory history: '+p);
    assert.ok(file(p).length>300,'History incomplete: '+p);
  }
});
test('release version is synchronized with canonical next-chat and release chronology',()=>{
  const version=JSON.parse(file('package.json')).version;
  assert.match(version,/^0\.2\.0-alpha\.\d+$/);
  for(const p of ['docs/NEXT_CHAT_START.md','docs/history/RELEASE_CHRONICLE.md',
    'HANDOFF.md']){
    assert.ok(file(p).includes(version),'Update '+p+' for release '+version);
  }
});
test('failure register includes contiguous permanent failure identifiers',()=>{
  const failures=file('docs/history/FAILURE_REGISTER.md');
  const matches=[...failures.matchAll(/^## (F-\d{3})\./gm)].map(x=>x[1]);
  assert.ok(matches.length>=22,'Too few documented failures');
  const unique=new Set(matches);
  assert.equal(unique.size,matches.length,'Never duplicate a failure identifier');
  for(let i=1;i<=matches.length;i++)
    assert.ok(unique.has('F-'+String(i).padStart(3,'0')),'Missing historical failure F-'+i);
});
test('architecture and next chat contain critical anti-regression safeguards',()=>{
  const methods=file('docs/history/METHODS_AND_DECISIONS.md');
  const handoff=file('docs/NEXT_CHAT_START.md');
  for(const term of ['Corel','Union','Clipper','ПОСЛЕ','EPS','PDF','Undo',
    'Ghostscript','CMYK','M/L/C/Q','реальных']){
    assert.ok(methods.includes(term),'Architecture missing '+term);
  }
  for(const term of ['fee205c17a729ed246f0760f2cebd29352e73cd9',
    '171/171','8049569_10_29.10.eps','F-001']){
    assert.ok(handoff.includes(term),'Handoff missing key verified context: '+term);
  }
  assert.match(file('AGENTS.md'),/WORKLOG_PROTOCOL\.md/);
});
test('historical append-only action journal is parseable (blank separators allowed)',()=>{
  const records=file('logs/actions.jsonl').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  assert.ok(records.length>=60);
  const all=records.map((l,i)=>{
    try{return JSON.parse(l);}
    catch(e){throw Error('Malformed JSONL at nonblank record '+(i+1)+': '+e.message);}
  });
  assert.ok(all.every(x=>x.at&&x.action),'Each action must have an action name and time');
  assert.ok(all.some(x=>x.action==='alpha33-corel-c-lowercase'));
  assert.ok(all.some(x=>x.action==='full-development-history-checkpoint'));
});
