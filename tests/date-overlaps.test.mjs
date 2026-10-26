import { test } from 'node:test';
import assert from 'node:assert/strict';
import { overlappingRoles } from '../app/lib/resume/date-overlaps.ts';
test('flags concurrent ongoing work without treating it as an error', () => {
 const rows = [{id:'a',role:'Freelance',company:'Self',dates:'2020 – Present'}, {id:'b',role:'Engineer',company:'Rawura',dates:'2022 – 2024'}];
 assert.equal(overlappingRoles(rows, new Date('2026-10-26')).length,1);
 assert.equal(overlappingRoles([{...rows[0],dates:'Jan 2020 – Dec 2021'},rows[1]]).length,0);
 assert.equal(overlappingRoles([{...rows[0],dates:'unknown'},rows[1]]).length,0);
});
