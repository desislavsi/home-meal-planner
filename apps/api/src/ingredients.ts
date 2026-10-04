import { randomUUID } from 'node:crypto';
import type { Ingredient, MealPlan, Recipe, ShoppingLine } from '@home-meal-planner/contracts';
import { parseIngredientAmount, stripIngredientAmount, stripIngredientUnit } from './ingredient-quantities.js';

const unitAliases: Record<string, string> = {
  gram: 'g', grams: 'g', г: 'g', килограм: 'kg', кг: 'kg', kilogram: 'kg', kilograms: 'kg',
  миллилитър: 'ml', мл: 'ml', milliliter: 'ml', milliliters: 'ml', литър: 'l', л: 'l', liter: 'l', liters: 'l',
  бр: 'pcs', piece: 'pcs', pieces: 'pcs', 'броя': 'pcs', tbsp: 'tbsp', 'с.л.': 'tbsp', tsp: 'tsp', 'ч.л.': 'tsp',
};

export function normalizeUnit(unit?: string): string | undefined {
  if (!unit) return undefined;
  return unitAliases[unit.trim().toLowerCase()] ?? unit.trim().toLowerCase();
}

export function baseQuantity(quantity: number, unit?: string): { value: number; unit: 'g' | 'ml' | 'pcs' | undefined } {
  const normalized = normalizeUnit(unit);
  if (normalized === 'kg') return { value: quantity * 1000, unit: 'g' };
  if (normalized === 'l') return { value: quantity * 1000, unit: 'ml' };
  if (normalized === 'g') return { value: quantity, unit: 'g' };
  if (normalized === 'ml') return { value: quantity, unit: 'ml' };
  if (normalized === 'cup') return { value: quantity * 240, unit: 'ml' };
  if (normalized === 'tbsp') return { value: quantity * 15, unit: 'ml' };
  if (normalized === 'tsp') return { value: quantity * 5, unit: 'ml' };
  if (normalized === 'pcs' || normalized === 'piece') return { value: quantity, unit: 'pcs' };
  return { value: quantity, unit: undefined };
}

const semanticText = (ingredient: Ingredient) => [
  ingredient.name.trim().toLocaleLowerCase(),
  ingredient.form ?? 'other',
  ingredient.fatPercent == null ? '' : String(ingredient.fatPercent),
  ingredient.brand?.trim().toLocaleLowerCase() ?? '',
  ...ingredient.modifiers.map((value) => value.trim().toLocaleLowerCase()).sort(),
].join('|');

export function semanticKey(ingredient: Ingredient): string { return semanticText(ingredient); }

export function consolidateIngredients(plan: MealPlan, recipes: Map<string, Recipe>): ShoppingLine[] {
  const grouped = new Map<string, ShoppingLine>();
  for (const entry of plan.entries) {
    const recipe = recipes.get(entry.recipeId);
    if (!recipe) continue;
    const factor = entry.servings / recipe.servings;
    for (const rawIngredient of recipe.ingredients) {
      const embeddedAmount = rawIngredient.quantity == null ? parseIngredientAmount(rawIngredient.name) : {};
      const embeddedName = rawIngredient.quantity == null && embeddedAmount.quantity != null
        ? stripIngredientUnit(stripIngredientAmount(rawIngredient.name))
        : rawIngredient.name;
      const ingredient: Ingredient = {
        ...rawIngredient,
        name: embeddedName || rawIngredient.name,
        quantity: (rawIngredient.quantity ?? embeddedAmount.quantity) == null ? undefined : (rawIngredient.quantity ?? embeddedAmount.quantity)! * factor,
        unit: normalizeUnit(rawIngredient.unit ?? embeddedAmount.unit) as Ingredient['unit'],
      };
      const key = semanticKey(ingredient);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          id: randomUUID(),
          ingredient,
          requiredQuantity: ingredient.quantity,
          requiredUnit: ingredient.unit,
          semanticKey: key,
          offers: [],
          included: true,
        });
        continue;
      }
      const left = baseQuantity(existing.requiredQuantity ?? 0, existing.requiredUnit);
      const right = baseQuantity(ingredient.quantity ?? 0, ingredient.unit);
      if (existing.requiredQuantity != null && ingredient.quantity != null && left.unit === right.unit && left.unit) {
        existing.requiredQuantity = left.value + right.value;
        existing.requiredUnit = left.unit;
      } else if (existing.requiredQuantity == null || ingredient.quantity == null) {
        existing.requiredQuantity = undefined;
        existing.requiredUnit = undefined;
      }
    }
  }
  return [...grouped.values()];
}
