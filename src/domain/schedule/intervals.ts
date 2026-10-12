/**
 * Half-open intervals [start, end) measured in minutes from the start of a
 * week (Monday 00:00 local wall-clock time). Pure functions, no I/O.
 */
export interface Interval {
  start: number;
  end: number;
}

export const MINUTES_PER_DAY = 24 * 60;
export const MINUTES_PER_WEEK = 7 * MINUTES_PER_DAY;

/** Sorts, drops empty intervals and merges overlapping/touching ones. */
export function normalize(intervals: readonly Interval[]): Interval[] {
  const sorted = intervals
    .filter((i) => i.end > i.start)
    .map((i) => ({ start: i.start, end: i.end }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: Interval[] = [];
  for (const current of sorted) {
    const last = merged[merged.length - 1];
    if (last && current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push(current);
    }
  }
  return merged;
}

/** Overlap of two interval sets: time present in both `a` and `b`. */
export function intersect(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const left = normalize(a);
  const right = normalize(b);
  const result: Interval[] = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const start = Math.max(left[i].start, right[j].start);
    const end = Math.min(left[i].end, right[j].end);
    if (end > start) result.push({ start, end });
    if (left[i].end < right[j].end) i++;
    else j++;
  }
  return result;
}

/** Time in `a` that is not covered by `b`. */
export function subtract(a: readonly Interval[], b: readonly Interval[]): Interval[] {
  const cuts = normalize(b);
  const result: Interval[] = [];
  for (const piece of normalize(a)) {
    let cursor = piece.start;
    for (const cut of cuts) {
      if (cut.end <= cursor) continue;
      if (cut.start >= piece.end) break;
      if (cut.start > cursor) result.push({ start: cursor, end: cut.start });
      cursor = Math.max(cursor, cut.end);
      if (cursor >= piece.end) break;
    }
    if (cursor < piece.end) result.push({ start: cursor, end: piece.end });
  }
  return result;
}

export function totalMinutes(intervals: readonly Interval[]): number {
  return normalize(intervals).reduce((sum, i) => sum + (i.end - i.start), 0);
}
