import type { Ingredient, ProductOffer } from '@home-meal-planner/contracts';

export type IngredientCategory =
  | 'produce'
  | 'dairy'
  | 'meat'
  | 'seafood'
  | 'pantry'
  | 'bakery'
  | 'frozen'
  | 'beverage'
  | 'other';

export type IngredientSearchProfile = {
  originalName: string;
  canonicalName: string;
  searchTerms: string[];
  category: IngredientCategory;
};

type AliasGroup = {
  keys: string[];
  searchTerms: string[];
  category: IngredientCategory;
};

const aliasGroups: AliasGroup[] = [
  {
    keys: ['cucumber', 'cucumbers', '\u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0430', '\u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0438'],
    searchTerms: ['\u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0430', '\u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0438', 'cucumber', 'cucumbers'],
    category: 'produce',
  },
  {
    keys: ['tomato', 'tomatoes', '\u0434\u043e\u043c\u0430\u0442', '\u0434\u043e\u043c\u0430\u0442\u0438'],
    searchTerms: ['\u0434\u043e\u043c\u0430\u0442\u0438', '\u0434\u043e\u043c\u0430\u0442', 'tomatoes', 'tomato'],
    category: 'produce',
  },
  {
    keys: ['onion', 'onions', '\u043b\u0443\u043a'],
    searchTerms: ['\u043b\u0443\u043a', 'onion', 'onions'],
    category: 'produce',
  },
  {
    keys: ['potato', 'potatoes', '\u043a\u0430\u0440\u0442\u043e\u0444', '\u043a\u0430\u0440\u0442\u043e\u0444\u0438'],
    searchTerms: ['\u043a\u0430\u0440\u0442\u043e\u0444\u0438', '\u043a\u0430\u0440\u0442\u043e\u0444', 'potatoes', 'potato'],
    category: 'produce',
  },
  {
    keys: ['banana', 'bananas', '\u0431\u0430\u043d\u0430\u043d', '\u0431\u0430\u043d\u0430\u043d\u0438'],
    searchTerms: ['\u0431\u0430\u043d\u0430\u043d\u0438', '\u0431\u0430\u043d\u0430\u043d', 'bananas', 'banana'],
    category: 'produce',
  },
  {
    keys: ['flour', '\u0431\u0440\u0430\u0448\u043d\u043e'],
    searchTerms: ['\u0431\u0440\u0430\u0448\u043d\u043e', 'flour'],
    category: 'pantry',
  },
  {
    keys: ['milk', '\u043c\u043b\u044f\u043a\u043e'],
    searchTerms: ['\u043c\u043b\u044f\u043a\u043e', 'milk'],
    category: 'dairy',
  },
  {
    keys: ['yogurt', 'yoghurt', '\u043a\u0438\u0441\u0435\u043b\u043e \u043c\u043b\u044f\u043a\u043e'],
    searchTerms: ['\u043a\u0438\u0441\u0435\u043b\u043e \u043c\u043b\u044f\u043a\u043e', 'yogurt', 'yoghurt'],
    category: 'dairy',
  },
  {
    keys: ['egg', 'eggs', '\u044f\u0439\u0446\u0435', '\u044f\u0439\u0446\u0430'],
    searchTerms: ['\u044f\u0439\u0446\u0430', '\u044f\u0439\u0446\u0435', 'eggs', 'egg'],
    category: 'pantry',
  },
  {
    keys: ['olive oil', 'oil', '\u0437\u0435\u0445\u0442\u0438\u043d', '\u043e\u043b\u0438\u043e'],
    searchTerms: ['\u0437\u0435\u0445\u0442\u0438\u043d', '\u043e\u043b\u0438\u043e', 'olive oil', 'oil'],
    category: 'pantry',
  },
];

const householdTerms = [
  '\u043f\u0440\u0435\u043f\u0430\u0440\u0430\u0442',
  '\u0441\u044a\u0434\u043e\u0432\u0435',
  '\u043f\u043e\u0447\u0438\u0441\u0442',
  '\u043f\u0435\u0440\u0438\u043b\u0435\u043d',
  '\u043e\u043c\u0435\u043a\u043e\u0442\u0438\u0442\u0435\u043b',
  '\u0434\u0435\u0437\u0438\u043d\u0444\u0435\u043a\u0442',
  'detergent',
  'dish soap',
  'dishwasher',
  'cleaner',
  'cleaning',
  'laundry',
  'bleach',
  'soap',
];

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[()[\],;:]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function canonicalIngredientName(name: string): string {
  const trimmed = name.trim();
  const withoutPreparation = trimmed.split(/[\[(]/, 1)[0]?.trim() ?? trimmed;
  return withoutPreparation.replace(/[,:;]+$/, '').trim() || trimmed;
}

function matchesKey(canonicalName: string, key: string): boolean {
  return canonicalName === key || canonicalName.startsWith(`${key} `) || canonicalName.includes(` ${key}`);
}

function findAliasGroup(canonicalName: string): AliasGroup | undefined {
  return aliasGroups.find((group) => group.keys.some((key) => matchesKey(canonicalName, normalizeText(key))));
}

export function buildIngredientSearchProfile(ingredient: Ingredient): IngredientSearchProfile {
  const canonicalName = normalizeText(canonicalIngredientName(ingredient.name));
  const aliasGroup = findAliasGroup(canonicalName);
  const searchTerms = [...new Set((aliasGroup?.searchTerms ?? [canonicalName]).map(normalizeText).filter(Boolean))];

  return {
    originalName: ingredient.name,
    canonicalName,
    searchTerms,
    category: aliasGroup?.category ?? (ingredient.form === 'fresh' ? 'produce' : 'other'),
  };
}

export function applyPriceBasisDefaults(ingredient: Ingredient, offer: ProductOffer): ProductOffer {
  if (offer.provenance !== 'live' || offer.price == null) return offer;

  const profile = buildIngredientSearchProfile(ingredient);
  if (profile.category !== 'produce') return offer;

  const isUnpackagedKilogramPrice = offer.priceBasis === 'kg' && !offer.packageQuantity && !offer.packageUnit;
  if (offer.priceBasis && !isUnpackagedKilogramPrice) return offer;

  return {
    ...offer,
    packageQuantity: offer.packageQuantity ?? 1,
    packageUnit: offer.packageUnit ?? 'kg',
    priceBasis: 'package',
    priceBasisAssumed: true,
  };
}

export function productMatchesIngredient(ingredient: Ingredient, offer: ProductOffer): boolean {
  const profile = buildIngredientSearchProfile(ingredient);
  const title = normalizeText(offer.title);

  if (!profile.searchTerms.some((term) => title.includes(term))) {
    return false;
  }

  if (profile.category !== 'other' && householdTerms.some((term) => title.includes(normalizeText(term)))) {
    return false;
  }

  return true;
}

