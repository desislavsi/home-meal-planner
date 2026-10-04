import { describe, expect, it } from 'vitest';
import type { Recipe } from '@home-meal-planner/contracts';
import { sortRecipesForMeal } from './recipe-order';

const recipe = (id: string, title: string, suitableMealSlots: Recipe['suitableMealSlots']): Recipe => ({
  id,
  title,
  servings: 2,
  ingredients: [],
  instructions: ['Cook'],
  tags: [],
  suitableMealSlots,
  createdAt: '',
  updatedAt: '',
});

describe('recipe ordering by meal slot', () => {
  it('puts suitable recipes first and sorts both groups alphabetically', () => {
    const sorted = sortRecipesForMeal([
      recipe('other-z', 'Zucchini dinner', ['dinner']),
      recipe('breakfast-b', 'Banana pancakes', ['breakfast']),
      recipe('breakfast-a', 'Apple porridge', ['breakfast']),
      recipe('other-a', 'Avocado toast', ['lunch']),
    ], 'breakfast');

    expect(sorted.map((item) => item.title)).toEqual(['Apple porridge', 'Banana pancakes', 'Avocado toast', 'Zucchini dinner']);
  });
});
