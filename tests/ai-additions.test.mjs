import test from 'node:test';
import assert from 'node:assert/strict';
import {pendingAiAdditions} from '../app/lib/dashboard/resume/ai-additions.ts';

const addition={section:'experience',entryId:'job',before:'Prepared reports.',after:'Built supplier dashboards.',reviewed:false,addedAt:'2026-11-23'};
const content={title:'Analyst',summary:'',skills:['Power BI'],experience:[{id:'job',role:'Analyst',bullets:[addition.after]}],aiAdditions:[addition]};
test('AI additions survive JSON storage and only describe the current visible text',()=>{
  assert.equal(pendingAiAdditions(JSON.parse(JSON.stringify(content))).length,1);
  assert.equal(pendingAiAdditions({...content,hiddenParts:['exp:job:0']}).length,0);
  assert.equal(pendingAiAdditions({...content,experience:[{...content.experience[0],bullets:['Original report.']}]}).length,0);
});
test('new skills, headlines and role titles are reviewable without duplicate notices',()=>{
  const records=[{...addition,section:'skills',after:'Power BI'},{...addition,section:'title',after:'Analyst'},{...addition,section:'role',after:'Analyst'}];
  assert.equal(pendingAiAdditions({...content,aiAdditions:[...records,...records]}).length,3);
  assert.equal(pendingAiAdditions({...content,aiAdditions:records.map(item=>({...item,reviewed:true}))}).length,0);
});
