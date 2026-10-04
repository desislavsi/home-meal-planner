import { describe, expect, it } from 'vitest';
import { consolidateIngredients } from './ingredients.js';

describe('semantic ingredient consolidation', () => {
  it('does not merge meaningful forms or brands', () => {
    const recipe = { id: 'r', title: 'Test', servings: 2, ingredients: [
      { name: 'домати', quantity: 200, unit: 'g' as const, form: 'fresh' as const, modifiers: [] },
      { name: 'домати', quantity: 400, unit: 'g' as const, form: 'canned' as const, modifiers: [] },
      { name: 'кисело мляко', quantity: 400, unit: 'g' as const, fatPercent: 3.6, modifiers: [] },
      { name: 'кисело мляко', quantity: 400, unit: 'g' as const, fatPercent: 2, modifiers: [] },
    ], instructions: ['Mix'], tags: [], suitableMealSlots: [], createdAt: '', updatedAt: '' };
    const plan = { id: 'p', name: 'Plan', startDate: '2026-10-03', endDate: '2026-10-03', entries: [{ id: 'e', date: '2026-10-03', slot: 'dinner' as const, recipeId: 'r', servings: 2 }], createdAt: '', updatedAt: '' };
    expect(consolidateIngredients(plan, new Map([['r', recipe]])).length).toBe(4);
  });

  it('derives missing legacy quantities from the recipe ingredient text before scaling by meal servings', () => {
    const recipe = { id: 'r', title: 'Oil recipe', servings: 2, ingredients: [
      { name: '\u00bc cup extra-virgin olive oil', modifiers: [] },
    ], instructions: ['Mix'], tags: [], suitableMealSlots: [], createdAt: '', updatedAt: '' };
    const plan = { id: 'p', name: 'Plan', startDate: '2026-10-03', endDate: '2026-10-03', entries: [{ id: 'e', date: '2026-10-03', slot: 'dinner' as const, recipeId: 'r', servings: 4 }], createdAt: '', updatedAt: '' };

    const [line] = consolidateIngredients(plan, new Map([['r', recipe]]));

    expect(line.ingredient).toMatchObject({ name: 'extra-virgin olive oil', quantity: 0.5, unit: 'cup' });
    expect(line.requiredQuantity).toBe(0.5);
    expect(line.requiredUnit).toBe('cup');
  });
});
