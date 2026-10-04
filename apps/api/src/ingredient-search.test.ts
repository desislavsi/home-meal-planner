import { describe, expect, it } from 'vitest';
import type { Ingredient, ProductOffer } from '@home-meal-planner/contracts';
import { assessOffer } from './pricing.js';
import { applyPriceBasisDefaults, buildIngredientSearchProfile, canonicalIngredientName, productMatchesIngredient } from './ingredient-search.js';

const cucumber: Ingredient = {
  name: 'cucumber (cut lengthwise, seeded, and sliced ¼-inch thick)',
  quantity: 1,
  unit: 'pcs',
  modifiers: [],
};

const offer = (title: string, overrides: Partial<ProductOffer> = {}): ProductOffer => ({
  id: `offer-${title}`,
  storeId: 'vmv',
  title,
  price: 2,
  currency: 'EUR',
  priceBasis: 'package',
  availability: 'available',
  provenance: 'demo',
  productUrl: 'https://example.test/products/1',
  ...overrides,
});

describe('ingredient search normalization', () => {
  it('removes preparation instructions from the store-search name', () => {
    expect(canonicalIngredientName(cucumber.name)).toBe('cucumber');
  });

  it('creates Bulgarian aliases for an English ingredient', () => {
    const profile = buildIngredientSearchProfile(cucumber);

    expect(profile.category).toBe('produce');
    expect(profile.searchTerms).toContain('\u043a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0430');
    expect(profile.searchTerms).toContain('cucumber');
  });

  it('accepts matching food products and rejects household false positives', () => {
    expect(productMatchesIngredient(cucumber, offer('\u041a\u0440\u0430\u0441\u0442\u0430\u0432\u0438\u0446\u0438 1 кг'))).toBe(true);
    expect(productMatchesIngredient(cucumber, offer('Течен препарат за съдове Spark Cucumber'))).toBe(false);
  });

  it('assumes live produce prices represent one-kilogram packs when no basis is published', () => {
    const assumed = applyPriceBasisDefaults(cucumber, offer('Краставици', { provenance: 'live', priceBasis: undefined }));
    const nonProduce = applyPriceBasisDefaults({ name: 'eggs', modifiers: [] }, offer('Eggs', { provenance: 'live', priceBasis: undefined }));

    expect(assumed).toMatchObject({ packageQuantity: 1, packageUnit: 'kg', priceBasis: 'package', priceBasisAssumed: true });
    expect(nonProduce.priceBasis).toBeUndefined();
  });

  it('calculates assumed one-kilogram produce packs from the app quantity', () => {
    const assumed = applyPriceBasisDefaults(cucumber, offer('Cucumbers', { price: 12.45, provenance: 'live', priceBasis: 'kg' }));
    const assessment = assessOffer({ name: 'cucumber', quantity: 6400, unit: 'g' as const, modifiers: [] }, assumed);

    expect(assessment).toMatchObject({ packagesNeeded: 7, purchasedQuantity: 7000, excessQuantity: 600, status: 'complete' });
    expect(assessment.purchaseCost).toBeCloseTo(87.15, 10);
  });
});

