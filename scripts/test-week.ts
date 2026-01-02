import { getISOWeek, getYear, getISOWeekYear } from 'date-fns';

const testDates = [
  new Date('2025-12-28'),
  new Date('2025-12-29'),
  new Date('2025-12-30'),
  new Date('2025-12-31'),
  new Date('2026-01-01'),
  new Date('2026-01-02'),
  new Date('2026-01-03'),
  new Date('2026-01-04'),
];

console.log('Date            | ISO Week | getYear | getISOWeekYear');
console.log('----------------|----------|---------|---------------');
for (const d of testDates) {
  const isoWeek = getISOWeek(d);
  const year = getYear(d);
  const isoWeekYear = getISOWeekYear(d);
  console.log(`${d.toISOString().split('T')[0]} | W${String(isoWeek).padStart(2, ' ')}      | ${year}   | ${isoWeekYear}`);
}
