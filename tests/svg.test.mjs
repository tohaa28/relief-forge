import test from 'node:test';import assert from 'node:assert/strict';import {parseLinearPath} from '../web/svg-import.js';
test('relative lines and close',()=>{assert.deepEqual(parseLinearPath('M 10 20 l 20 0 v 20 h -20 z'),[{closed:true,points:[[10,20],[30,20],[30,40],[10,40]]}]);});
test('implicit line after M',()=>{assert.deepEqual(parseLinearPath('M0,0 1,2 3,4')[0].points,[[0,0],[1,2],[3,4]]);});
test('multiple subpaths remain separate',()=>{assert.equal(parseLinearPath('M0 0L1 1 M2 2L3 3').length,2);});
test('unsupported curves fail explicitly',()=>{assert.throws(()=>parseLinearPath('M0 0C1 1 2 2 3 3'),/не поддерживается/);});
test('truncated commands fail',()=>{assert.throws(()=>parseLinearPath('M0 0L1'),/Неполная/);});
test('scientific coordinates accepted',()=>{assert.deepEqual(parseLinearPath('M1e-2 -2E+1L.5 3.')[0].points,[[.01,-20],[.5,3]]);});
test('malformed bytes fail',()=>{assert.throws(()=>parseLinearPath('M0 0@L1 2'));});
