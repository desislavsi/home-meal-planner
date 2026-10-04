import { describe, expect, it } from 'vitest';
import { createGemmaSmokeFixture } from './ai.js';

describe('Gemma smoke fixture', () => {
  it('uses an isolated empty plan so persisted household meals cannot cause false failures', () => {
    const { plan, recipe } = createGemmaSmokeFixture();

    expect(plan.entries).toEqual([]);
    expect(plan.startDate).toBe('2099-01-03');
    expect(recipe.ingredients.map((ingredient) => ingredient.name)).toEqual(['картофи', 'домати', 'кисело мляко', 'брашно']);
  });
});
