import { describe, expect, it } from 'vitest';
import { groupMealEntriesByDay } from './planner';

describe('meal planner grouping', () => {
  it('groups by date and orders slots breakfast, lunch, dinner', () => {
    const groups = groupMealEntriesByDay([
      { id: 'dinner', date: '2026-10-04', slot: 'dinner', recipeId: 'r1', servings: 2 },
      { id: 'lunch', date: '2026-10-03', slot: 'lunch', recipeId: 'r1', servings: 2 },
      { id: 'breakfast', date: '2026-10-03', slot: 'breakfast', recipeId: 'r1', servings: 2 },
    ]);
    expect(groups.map(([date]) => date)).toEqual(['2026-10-03', '2026-10-04']);
    expect(groups[0][1].map((entry) => entry.slot)).toEqual(['breakfast', 'lunch']);
  });
});
