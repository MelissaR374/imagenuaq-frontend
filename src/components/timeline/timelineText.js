// What «Cronograma» shares: how many weeks it shows, how a day's load reads as a level, and how bars
// are stacked into lanes. An area's load is its open stages against the people present that day, so
// an absence makes the day heavier (RF-CAL-06).

/** How many weeks the viewer can show; twelve stays under the calendar's 92-day read. */
export const WEEK_OPTIONS = [2, 4, 8, 12];

export const DEFAULT_WEEKS = 8;

export const LEVELS = [
  { level: "free", label: "Libre" },
  { level: "low", label: "Ligera" },
  { level: "mid", label: "Media" },
  { level: "high", label: "Alta" },
];

export const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];

/** An area's day: stages per person present. Work with nobody present is the heaviest it gets. */
export function areaLevel(stages, present) {
  if (stages === 0) return "free";
  if (present === 0) return "high";
  const perPerson = stages / present;
  if (perPerson <= 1) return "low";
  if (perPerson <= 2) return "mid";
  return "high";
}

/**
 * Puts each bar in the first lane where it does not overlap the one before it, so overlapping work
 * stacks instead of hiding. Bars are `{ first, last }` column indexes; each gets a `lane`.
 *
 * @returns {{ bars: object[], lanes: number }}
 */
export function stackLanes(bars) {
  const ends = [];
  const placed = [...bars]
    .sort((a, b) => a.first - b.first || b.last - a.last)
    .map((bar) => {
      let lane = ends.findIndex((end) => end < bar.first);
      if (lane === -1) lane = ends.length;
      ends[lane] = bar.last;
      return { ...bar, lane };
    });
  return { bars: placed, lanes: Math.max(ends.length, 1) };
}
