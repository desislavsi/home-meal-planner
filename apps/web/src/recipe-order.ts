import type { MealSlot, Recipe } from '@home-meal-planner/contracts';

export function sortRecipesForMeal(recipes: Recipe[], slot: MealSlot) {
  return [...recipes].sort((a, b) => {
    const aSuitable = a.suitableMealSlots.includes(slot);
    const bSuitable = b.suitableMealSlots.includes(slot);
    if (aSuitable !== bSuitable) return aSuitable ? -1 : 1;
    return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
  });
}
