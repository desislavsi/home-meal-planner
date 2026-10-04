import { describe, expect, it } from 'vitest';
import { baseQuantity } from './ingredients.js';
import { parseIngredientAmount, stripIngredientAmount, stripIngredientUnit } from './ingredient-quantities.js';

describe('recipe ingredient quantity parsing', () => {
  it('parses Unicode fractions and cups from a recipe ingredient', () => {
    const value = '\u00bc cup extra-virgin olive oil';

    expect(parseIngredientAmount(value)).toEqual({ quantity: 0.25, unit: 'cup' });
    expect(stripIngredientUnit(stripIngredientAmount(value))).toBe('extra-virgin olive oil');
  });

  it('converts cooking volume units to millilitres for price calculations', () => {
    expect(baseQuantity(1, 'cup')).toEqual({ value: 240, unit: 'ml' });
    expect(baseQuantity(2, 'tbsp')).toEqual({ value: 30, unit: 'ml' });
  });
});

