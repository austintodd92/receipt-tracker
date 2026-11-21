// Budget math. No dependencies, so it can be tested on its own.
//
// Rules (agreed with the parents):
//  • A monthly eating-out budget is split across the month BY DAYS, so each
//    week gets its fair share and a 2-day week at the end gets a 2-day share.
//  • Weeks run Sunday–Saturday (change WEEK_STARTS_ON to 1 for Monday), and a
//    week is cut at the month boundary.
//  • Leftover money rolls into next week. Overspending is subtracted from next week.
//  • Everything resets on the 1st of the month.

export const WEEK_STARTS_ON = 0; // 0 = Sunday, 1 = Monday

const cents = (n) => Math.round(Number(n) * 100);
const dollars = (c) => c / 100;

export function parseDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** The weeks of a month, each cut to the month: [{start, end, days}] (day numbers). */
export function weeksOfMonth(year, monthIndex) {
  const D = daysInMonth(year, monthIndex);
  const weeks = [];
  let start = 1;
  for (let day = 1; day <= D; day++) {
    const dow = new Date(year, monthIndex, day).getDay();
    const isLastDayOfWeek = (dow + 1) % 7 === WEEK_STARTS_ON;
    if (isLastDayOfWeek || day === D) {
      weeks.push({ start, end: day, days: day - start + 1 });
      start = day + 1;
    }
  }
  return weeks;
}

/**
 * Full breakdown of one month.
 * receipts: [{ total, spent_on: "YYYY-MM-DD" }] — any receipts outside the month are ignored.
 * Returns { weeks: [{start, end, startDate, endDate, allowance, carryIn, available, spent, left}],
 *           monthBudget, monthSpent, monthLeft }
 */
export function monthBreakdown(monthlyBudget, receipts, year, monthIndex) {
  const D = daysInMonth(year, monthIndex);
  const B = cents(monthlyBudget);
  const weeks = weeksOfMonth(year, monthIndex);

  const spentByDay = new Array(D + 2).fill(0);
  let monthSpent = 0;
  for (const r of receipts) {
    const d = parseDate(r.spent_on);
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
    spentByDay[d.getDate()] += cents(r.total);
    monthSpent += cents(r.total);
  }

  let carry = 0;
  let allocatedSoFar = 0;
  const out = weeks.map((w) => {
    // Allocate by cumulative days so the weeks add up exactly to the budget.
    const allocatedThrough = Math.round((B * w.end) / D);
    const allowance = allocatedThrough - allocatedSoFar;
    allocatedSoFar = allocatedThrough;

    let spent = 0;
    for (let day = w.start; day <= w.end; day++) spent += spentByDay[day];

    const available = allowance + carry;
    const left = available - spent;
    const row = {
      start: w.start,
      end: w.end,
      startDate: fmtDate(new Date(year, monthIndex, w.start)),
      endDate: fmtDate(new Date(year, monthIndex, w.end)),
      allowance: dollars(allowance),
      carryIn: dollars(carry),
      available: dollars(available),
      spent: dollars(spent),
      left: dollars(left),
    };
    carry = left;
    return row;
  });

  return {
    weeks: out,
    monthBudget: dollars(B),
    monthSpent: dollars(monthSpent),
    monthLeft: dollars(B - monthSpent),
  };
}

/** The week row that contains `date` (a Date), plus the month breakdown. */
export function currentWeek(monthlyBudget, receipts, date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const month = monthBreakdown(monthlyBudget, receipts, y, m);
  const day = date.getDate();
  const week = month.weeks.find((w) => day >= w.start && day <= w.end);
  return { week, month };
}

/** First and last date strings of a month, for database queries. */
export function monthRange(year, monthIndex) {
  return {
    from: fmtDate(new Date(year, monthIndex, 1)),
    to: fmtDate(new Date(year, monthIndex, daysInMonth(year, monthIndex))),
  };
}
