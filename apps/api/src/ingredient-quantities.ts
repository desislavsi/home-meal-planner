import type { Ingredient } from '@home-meal-planner/contracts';

const amountTokenPattern = '(?:(?:[0-9]+(?:[.,][0-9]+)?\\s+)?(?:[0-9]+\\s*\\/\\s*[0-9]+|[\\u00bc\\u00bd\\u00be\\u2153\\u2154\\u215b\\u215c\\u215d\\u215e])|[0-9]+(?:[.,][0-9]+)?)';
const amountPattern = new RegExp(`^(${amountTokenPattern})\\s*([a-zA-Z\\u0400-\\u04ff.]+)?`, 'u');
const amountPrefixPattern = new RegExp(`^${amountTokenPattern}\\s*`, 'u');

const unicodeFractions: Record<string, number> = {
  '\u00bc': 0.25,
  '\u00bd': 0.5,
  '\u00be': 0.75,
  '\u2153': 1 / 3,
  '\u2154': 2 / 3,
  '\u215b': 0.125,
  '\u215c': 0.375,
  '\u215d': 0.625,
  '\u215e': 0.875,
};

const unitAliases: Record<string, Ingredient['unit']> = {
  g: 'g', '\u0433': 'g', '\u0433\u0440': 'g', gram: 'g', grams: 'g',
  kg: 'kg', '\u043a\u0433': 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', '\u043c\u043b': 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', '\u043b': 'l', liter: 'l', liters: 'l',
  pcs: 'pcs', '\u0431\u0440': 'pcs', piece: 'pcs', pieces: 'pcs',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', '\u0441.\u043b.': 'tbsp',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp', '\u0447.\u043b.': 'tsp',
  cup: 'cup', cups: 'cup', '\u0447\u0430\u0448\u0430': 'cup', '\u0447\u0430\u0448\u0438': 'cup',
};

function parseNumericAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 1 && unicodeFractions[trimmed] != null) return unicodeFractions[trimmed];
  const mixed = trimmed.match(/^([0-9]+(?:[.,][0-9]+)?)\s+([0-9]+)\s*\/\s*([0-9]+)$/);
  if (mixed) {
    const whole = Number(mixed[1].replace(',', '.'));
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    return denominator > 0 ? whole + numerator / denominator : undefined;
  }
  const fraction = trimmed.match(/^([0-9]+)\s*\/\s*([0-9]+)$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator > 0 ? Number(fraction[1]) / denominator : undefined;
  }
  const numeric = Number(trimmed.replace(',', '.'));
  return Number.isFinite(numeric) ? numeric : undefined;
}

export function parseIngredientAmount(value: string): { quantity?: number; unit?: Ingredient['unit'] } {
  const match = value.trim().match(amountPattern);
  if (!match) return {};
  const quantity = parseNumericAmount(match[1]);
  const rawUnit = match[2]?.toLocaleLowerCase();
  return { quantity, unit: rawUnit ? unitAliases[rawUnit] : undefined };
}

export function stripIngredientAmount(value: string): string {
  return value.trim().replace(amountPrefixPattern, '').trim();
}

export function stripIngredientUnit(value: string): string {
  return value.replace(/^(?:%|g|kg|ml|l|pcs|piece|pieces|tbsp|tsp|cup|cups|gram|grams|kilogram|kilograms|milliliter|milliliters|liter|liters|tablespoon|tablespoons|teaspoon|teaspoons|\u0433|\u0433\u0440|\u043a\u0433|\u043c\u043b|\u043b|\u0431\u0440|\u0447\u0430\u0448\u0430|\u0447\u0430\u0448\u0438)\.?\s+/i, '').trim();
}

