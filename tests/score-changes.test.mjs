// The ATS score's recipe on the website (owner, 2026-10-19: "the ATS is meant to be more than a
// keyword matcher"): how it is said under the numbers, and how a stored report scored by the old
// formula (keyword match alone) is told apart, so it is rescored rather than compared.
//
//   npm test        (node --test --experimental-strip-types tests/)
//
// Same loader as apply.test.mjs: Node resolves neither the `@/` alias nor an extensionless `./x`.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { registerHooks } from "node:module";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const target = specifier.startsWith("@/") ? new URL(specifier.slice(2), ROOT).href : specifier;
    const isPath = target.startsWith(".") || target.startsWith("file:");
    if (isPath && !/\.[cm]?[jt]sx?$/.test(target)) {
      const base = new URL(target, context.parentURL);
      for (const ext of [".ts", ".tsx", "/index.ts"]) {
        const candidate = new URL(base.href + ext);
        if (existsSync(fileURLToPath(candidate))) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(target, context);
  },
});
const { scoreDrops } = await import('../app/lib/apply/score-changes.ts');
const report = (value, factors = []) => ({ scoringVersion: 18, scanId: 'test', score: value, degraded: false, verdicts: [], metrics: [{id:'length-format', label:'Length & format', value, factors}] });
it('combines overlapping requirement labels without hiding unrelated losses', () => {
 const labels=['Marketplace experience','two-sided marketplace experience','Accessibility'];
 const make=(value,state)=>({...report(value),metrics:[{id:'keyword-match',label:'Keyword match',value}],verdicts:labels.map((label,id)=>({requirement:{id:String(id),label,text:label},state,evidence:[],coverage:state==='satisfied'?1:0}))});
 const drop=scoreDrops(make(82,'satisfied'),make(65,'missing'))[0];
 assert.equal(drop.reasons.length,2);
 assert.match(drop.reasons.join(' '),/two-sided marketplace/i);
 assert.match(drop.reasons.join(' '),/Accessibility/);
});
it('explains only the factor that actually lost credit', () => {
 const before = report(80,[{id:'length',value:25,detail:'Old',lines:[]},{id:'punctuation',value:0,detail:'Old',lines:[]}]);
 const after = report(79,[{id:'length',value:25,detail:'Unchanged',lines:[]},{id:'punctuation',value:-1,detail:'One sentence needs punctuation.',lines:['A sentence']}]);
 assert.deepEqual(scoreDrops(before,after)[0].reasons,['One sentence needs punctuation.']);
 assert.deepEqual(scoreDrops(before,after)[0].lines,['A sentence']);
});

it('groups differently worded checks that lost the same evidence and keeps other losses separate', () => {
 const labels=['Two-sided market service','Marketplace experience','Accessibility'];
 const make=(value,state)=>({...report(value),metrics:[{id:'keyword-match',label:'Keyword match',value}],verdicts:labels.map((label,id)=>({requirement:{id:String(id),label,text:label},state,evidence:state==='satisfied'?[{chunkId:id<2?'market':'access',text:'Source example'}]:[],coverage:state==='satisfied'?1:0}))});
 const drop=scoreDrops(make(86,'satisfied'),make(65,'missing'))[0];
 assert.equal(drop.reasons.length,2);
 assert.match(drop.reasons[0],/same resume evidence.*Two-sided market service.*Marketplace experience/);
 assert.match(drop.reasons[1],/Accessibility/);
});
it('reports component losses even when the overall score improves', () => {
 const before = report(80), after = {...report(70),score:90};
 assert.equal(scoreDrops(before,after).length,1);
});
it('never fabricates a cause when factor evidence is missing', () => {
 assert.match(scoreDrops(report(80),report(79))[0].reasons[0],/specific cause was not recorded/);
});
it('ignores stale rules, partial scans, and improvements', () => {
 assert.deepEqual(scoreDrops({...report(80),scoringVersion:17},report(70)),[]);
 assert.deepEqual(scoreDrops(report(80),{...report(70),degraded:true}),[]);
 assert.deepEqual(scoreDrops(report(70),report(80)),[]);
 assert.deepEqual(scoreDrops(null,report(80)),[]);
});
it('explains repetition adjustments even when metrics are unchanged', () => {
 const drops=scoreDrops(report(80),{...report(80),score:78,stuffingPenalty:2,stuffing:['Repeated tool list.']});
 assert.equal(drops[0].id,'repetition');
 assert.deepEqual(drops[0].reasons,['Repeated tool list.']);
});
