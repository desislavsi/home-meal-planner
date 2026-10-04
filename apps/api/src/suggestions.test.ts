import { describe, expect, it } from 'vitest';
import { recipeSchema, type MealPlan, type Recipe } from '@home-meal-planner/contracts';
import { enforceSuggestionPolicy, generateMealSuggestions, validateMealSuggestions } from './suggestions.js';

const recipe = (id: string, title: string, suitableMealSlots: Recipe['suitableMealSlots'], servings = 2): Recipe => ({
  id,
  title,
  servings,
  ingredients: [],
  instructions: ['Cook'],
  tags: [],
  suitableMealSlots,
  createdAt: '',
  updatedAt: '',
});

const plan: MealPlan = {
  id: 'plan-1',
  name: 'Test plan',
  startDate: '2026-10-03',
  endDate: '2026-10-04',
  entries: [{ id: 'entry-1', date: '2026-10-03', slot: 'dinner', recipeId: 'dinner', servings: 2 }],
  createdAt: '',
  updatedAt: '',
};

describe('recipe meal suitability', () => {
  it('defaults missing suitability metadata for older recipes', () => {
    const parsed = recipeSchema.parse({ id: 'legacy', title: 'Legacy', servings: 2, ingredients: [], instructions: ['Cook'], tags: [], createdAt: '', updatedAt: '' });
    expect(parsed.suitableMealSlots).toEqual([]);
  });
});

describe('deterministic meal suggestions', () => {
  it('fills every empty date and meal slot while preserving existing entries', () => {
    const recipes = [
      recipe('breakfast-a', 'Apple porridge', ['breakfast']),
      recipe('breakfast-b', 'Banana pancakes', ['breakfast']),
      recipe('lunch', 'Lunch salad', ['lunch']),
      recipe('dinner', 'Dinner casserole', ['dinner']),
      recipe('fallback', 'Fallback meal', []),
    ];
    const result = generateMealSuggestions(plan, recipes);

    expect(result.suggestions).toHaveLength(5);
    expect(result.suggestions).not.toContainEqual(expect.objectContaining({ date: '2026-10-03', slot: 'dinner' }));
    expect(result.suggestions.filter((item) => item.slot === 'breakfast').map((item) => item.recipeId)).toEqual(['breakfast-a', 'breakfast-b']);
    expect(new Set(result.suggestions.map((item) => `${item.date}:${item.slot}`)).size).toBe(result.suggestions.length);
  });

  it('prefers suitable recipes before less suitable but less-used recipes', () => {
    const recipes = [recipe('suitable', 'Suitable dinner', ['dinner']), recipe('other', 'Other meal', [])];
    const usedPlan: MealPlan = { ...plan, entries: [{ id: 'entry-1', date: '2026-10-03', slot: 'breakfast', recipeId: 'suitable', servings: 2 }] };
    const result = generateMealSuggestions(usedPlan, recipes);
    expect(result.suggestions.find((item) => item.slot === 'dinner')?.recipeId).toBe('suitable');
  });

  it('repairs a valid AI proposal to the deterministic suitability and repeat policy', () => {
    const recipes = [recipe('alpha', 'Alpha meal', ['breakfast']), recipe('beta', 'Beta meal', ['breakfast'])];
    const proposed = [{ date: '2026-10-03', slot: 'breakfast' as const, recipeId: 'beta', servings: 2, reason: 'AI chose beta.' }];
    const result = enforceSuggestionPolicy({ ...plan, endDate: '2026-10-03', entries: [] }, recipes, proposed);
    expect(result.suggestions[0]).toMatchObject({ recipeId: 'alpha', reason: 'Marked suitable for breakfast; selected with the lowest current usage.' });
  });

  it('rejects nonexistent, occupied, duplicate, and out-of-range suggestions', () => {
    const recipes = [recipe('dinner', 'Dinner casserole', ['dinner'])];
    expect(() => validateMealSuggestions(plan, recipes, [{ date: '2026-10-03', slot: 'dinner', recipeId: 'dinner', servings: 2, reason: 'occupied' }])).toThrow(/overlaps/);
    expect(() => validateMealSuggestions(plan, recipes, [{ date: '2026-10-05', slot: 'lunch', recipeId: 'dinner', servings: 2, reason: 'outside' }])).toThrow(/outside/);
    expect(() => validateMealSuggestions(plan, recipes, [{ date: '2026-10-04', slot: 'lunch', recipeId: 'missing', servings: 2, reason: 'missing' }])).toThrow(/not saved/);
    expect(() => validateMealSuggestions(plan, recipes, [
      { date: '2026-10-04', slot: 'lunch', recipeId: 'dinner', servings: 2, reason: 'one' },
      { date: '2026-10-04', slot: 'lunch', recipeId: 'dinner', servings: 2, reason: 'two' },
    ])).toThrow(/duplicate/);
  });
});
