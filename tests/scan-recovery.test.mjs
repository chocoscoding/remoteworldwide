import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverScan } from '../app/lib/ats/recover-scan.ts';
test('partial results recover without a manual click', async () => {
 let calls=0; const delays=[];
 const result=await recoverScan(async()=>({degraded:++calls<3,score:80}),new AbortController().signal,async ms=>{delays.push(ms)});
 assert.equal(result.degraded,false); assert.equal(calls,3); assert.deepEqual(delays,[1500,4000]);
});
test('complete scans do not repeat', async()=>{
 let calls=0; await recoverScan(async()=>({degraded:false,score:++calls}),new AbortController().signal);
 assert.equal(calls,1);
});
test('an outage remains partial after bounded recovery',async()=>{
 let calls=0; const result=await recoverScan(async()=>({degraded:true,score:++calls}),new AbortController().signal,async()=>{});
 assert.equal(calls,3); assert.equal(result.degraded,true);
});
test('changing the resume cancels delayed recovery',async()=>{
 let calls=0; const controller=new AbortController();
 await assert.rejects(recoverScan(async()=>({degraded:true,score:++calls}),controller.signal,async()=>{controller.abort()}),{name:'AbortError'});
 assert.equal(calls,1);
});
test('failed recovery preserves the partial report',async()=>{
 let calls=0; const result=await recoverScan(async()=>{if(++calls>1)throw Error('offline');return {degraded:true,score:80}},new AbortController().signal,async()=>{});
 assert.equal(result.degraded,true);assert.equal(result.score,80);
});
test('background recovery survives a longer outage and a failed request',async()=>{
 let calls=0; const delays=[]; const waiting=[];
 const result=await recoverScan(async()=>{calls++; if(calls===4)throw Error('temporary'); return {degraded:calls<7,score:85};},new AbortController().signal,async ms=>{delays.push(ms)},{background:true,retryable:()=>true,onWaiting:r=>waiting.push(r.score)});
 assert.equal(result.degraded,false);assert.equal(calls,7);assert.equal(delays.at(-1),60000);assert.equal(waiting.length,6);
});
test('background recovery stops on permanent failures',async()=>{
 let calls=0;
 const result=await recoverScan(async()=>{if(++calls>1)throw Error('forbidden');return {degraded:true,score:80}},new AbortController().signal,async()=>{},{background:true,retryable:()=>false});
 assert.equal(calls,2);assert.equal(result.degraded,true);
});
test('background recovery cancels even after many attempts',async()=>{
 const controller=new AbortController();let calls=0;
 await assert.rejects(recoverScan(async()=>({degraded:true,score:++calls}),controller.signal,async()=>{if(calls===8)controller.abort()},{background:true}),{name:'AbortError'});
 assert.equal(calls,8);
});
