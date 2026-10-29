const ts = require('typescript');
const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const values = new Map(), memories = new Map();
let fail = false, calls = 0;
const session = {id:'chat',contactId:'char'};
const mocks = {
 './kv-db': {kvGet:k=>values.get(k),kvSet:(k,v)=>values.set(k,v),kvRemove:k=>values.delete(k),registerDynamicPrefix:()=>{}},
 './chat-storage': {loadChatSessions:()=>[session]},
 './app-clock': {appNowISO:()=>new Date().toISOString()},
 './llm-prompt-assembler': {formatChatTimestamp:s=>s},
 './settings-storage': {loadApiConfigs:()=>[{id:'api'}],loadBindingConfig:()=>({}),resolveBinding:()=>({apiConfigId:'api'}),resolveAuxiliaryApiConfig:()=>null},
 './api-helpers': {simpleLLMCall:async()=>{calls++;if(fail) throw Error('network');return {content:'双方约定周末见面。'}}},
 './memory-storage': {saveMemoryEntry:async m=>memories.set(m.id,m)},
};
function load(name) {
 const module={exports:{}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/'+name+'.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:p=>{if(!mocks[p])throw Error(p);return mocks[p]},crypto:require('node:crypto').webcrypto,console});
 return module.exports;
}
const storage=load('chat-offline-storage');mocks['./chat-offline-storage']=storage;
const meetings=load('offline-meetings');
function append(text) {return storage.appendChatOfflineTurn({sessionId:'chat',userContent:text,assistantContent:'回答',summary:text,summaryTag:'summary'});}
(async()=>{
 append('旧数据');const m=meetings.endOfflineMeeting(session,'约会');
 assert.equal(storage.loadActiveOfflineTurns('chat').length,0);
 assert.equal(storage.loadChatOfflineTurns('chat').length,1);
 const next=append('第二场');assert.equal(storage.loadActiveOfflineTurns('chat').length,1);
 storage.deleteChatOfflineTurnsFrom('chat',next.id);assert.equal(storage.loadChatOfflineTurns('chat').length,1);
 fail=true;await assert.rejects(()=>meetings.summarizeOfflineMeeting(session,m));
 assert.equal(meetings.loadOfflineMeetings('chat')[0].summary,undefined);
 fail=false;await meetings.summarizeOfflineMeeting(session,m);await meetings.summarizeOfflineMeeting(session,m,'更正后的记忆');
 assert.equal(memories.size,1);assert.match([...memories.values()][0].content,/更正/);
 assert.equal(storage.loadChatOfflineProjectionEntries('char',{excludeSessionId:'chat'}).length,1);
 assert.equal(calls,2);
 console.log('PASS: legacy preservation, scene isolation, scoped truncation, failure/retry, idempotent memory edit, cross-mode history');
})().catch(e=>{console.error(e);process.exit(1)});
