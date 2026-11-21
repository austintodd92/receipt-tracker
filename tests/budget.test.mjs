import assert from "node:assert/strict";
import { weeksOfMonth, monthBreakdown, currentWeek } from "../budget.js";

// Nov 2026: Nov 1 is a Sunday. 30 days.
const w = weeksOfMonth(2026, 10);
console.log(w);
assert.equal(w.reduce((a,b)=>a+b.days,0), 30);
assert.equal(w[0].start, 1); assert.equal(w[0].end, 7);
assert.equal(w.at(-1).start, 29); assert.equal(w.at(-1).end, 30);

// Dec 2026: Dec 1 is a Tuesday -> first week Dec 1-5 (Sat)
const d = weeksOfMonth(2026, 11);
assert.equal(d[0].end, 5);
assert.equal(d.reduce((a,b)=>a+b.days,0), 31);

// $300 in Nov -> $10/day. Week1 70. Overspend 100 in week1 -> week2 avail 70-30=40
const r = [{ total: 100, spent_on: "2026-11-03" }, { total: 25.5, spent_on: "2026-11-10" }, { total: 999, spent_on: "2026-10-31" }];
const m = monthBreakdown(300, r, 2026, 10);
console.log(m);
assert.equal(m.weeks[0].allowance, 70);
assert.equal(m.weeks[0].left, -30);
assert.equal(m.weeks[1].carryIn, -30);
assert.equal(m.weeks[1].available, 40);
assert.equal(m.weeks[1].left, 14.5);
assert.equal(m.weeks[2].carryIn, 14.5);
assert.equal(m.monthSpent, 125.5);
const totalAllow = m.weeks.reduce((a,b)=>a+b.allowance,0);
assert.equal(Math.round(totalAllow*100), 30000);
// last week left = whole month left
assert.equal(m.weeks.at(-1).left, m.monthLeft);

// Odd budget sums exactly
const o = monthBreakdown(333.33, [], 2026, 11);
assert.equal(Math.round(o.weeks.reduce((a,b)=>a+b.allowance,0)*100), 33333);

const c = currentWeek(300, r, new Date(2026, 10, 21));
assert.equal(c.week.start, 15); assert.equal(c.week.end, 21);
console.log("ALL OK", c.week);
