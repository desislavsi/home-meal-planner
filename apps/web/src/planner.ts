import type { MealPlanEntry } from '@home-meal-planner/contracts';

const slotOrder: Record<MealPlanEntry['slot'], number> = { breakfast: 0, lunch: 1, dinner: 2 };

export function groupMealEntriesByDay(entries: MealPlanEntry[]) {
  const groups = new Map<string, MealPlanEntry[]>();
  for (const entry of entries) groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, dayEntries]) => [date, dayEntries.sort((left, right) => slotOrder[left.slot] - slotOrder[right.slot])] as const);
}
