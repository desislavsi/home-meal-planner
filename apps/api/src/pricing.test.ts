import { describe, expect, it } from 'vitest';
import { assessOffer, rankAssessments, recalculateShoppingSubtotals } from './pricing.js';

describe('deterministic product pricing', () => {
  it('prefers the exact brand group and calculates packages plus excess', () => {
    const ingredient = { name: 'домати', quantity: 200, unit: 'g' as const, brand: 'Brand A', form: 'fresh' as const, modifiers: [] };
    const exact = { id: 'a', storeId: 'x', title: 'Brand A tomatoes 250g', brand: 'Brand A', packageQuantity: 250, packageUnit: 'g' as const, price: 1.5, currency: 'EUR', priceBasis: 'package' as const, availability: 'available' as const, provenance: 'demo' as const, productUrl: 'https://example.com/a' };
    const alternative = { ...exact, id: 'b', title: 'Brand B tomatoes 1kg', brand: 'Brand B', packageQuantity: 1, packageUnit: 'kg' as const, price: 4, productUrl: 'https://example.com/b' };
    const ranked = rankAssessments([assessOffer(ingredient, alternative), assessOffer(ingredient, exact)]);
    expect(ranked[0].offerId).toBe('a');
    expect(ranked[0].purchaseCost).toBe(1.5);
    expect(ranked[0].excessQuantity).toBe(50);
  });

  it('calculates loose-weight products and rejects missing bases', () => {
    const ingredient = { name: 'банани', quantity: 500, unit: 'g' as const, modifiers: [] };
    const loose = { id: 'loose', storeId: 'x', title: 'Bananas', price: 2, currency: 'EUR', priceBasis: 'kg' as const, availability: 'available' as const, provenance: 'live' as const, productUrl: 'https://example.com/loose' };
    expect(assessOffer(ingredient, loose).purchaseCost).toBe(1);
    expect(assessOffer({ ...ingredient, quantity: undefined }, loose).status).toBe('incomplete');
  });

  it('uses the consolidated quantity when calculating package purchases', () => {
    const ingredient = { name: 'домати', quantity: 2800, unit: 'g' as const, modifiers: [] };
    const offer = { id: 'pack', storeId: 'x', title: 'Tomatoes 800g', packageQuantity: 800, packageUnit: 'g' as const, price: 2.2, currency: 'EUR', priceBasis: 'package' as const, availability: 'available' as const, provenance: 'demo' as const, productUrl: 'https://example.com/tomatoes' };
    expect(assessOffer(ingredient, offer)).toMatchObject({ packagesNeeded: 4, purchasedQuantity: 3200, excessQuantity: 400, purchaseCost: 8.8 });
  });

  it('does not rank offers whose availability is unknown', () => {
    const ingredient = { name: 'брашно', quantity: 500, unit: 'g' as const, modifiers: [] };
    const offer = { id: 'unknown', storeId: 'x', title: 'Flour 1kg', packageQuantity: 1, packageUnit: 'kg' as const, price: 2, currency: 'EUR', priceBasis: 'package' as const, availability: 'unknown' as const, provenance: 'live' as const, productUrl: 'https://example.com/flour' };
    expect(assessOffer(ingredient, offer)).toMatchObject({ status: 'incomplete', reason: 'Availability is unknown.' });
  });

  it('uses the recipe quantity for cup-based ingredients when comparing litre-priced offers', () => {
    const ingredient = { name: 'extra-virgin olive oil', quantity: 0.25, unit: 'cup' as const, modifiers: [] };
    const offer = { id: 'oil', storeId: 'x', title: 'Olive oil 1 l', price: 4, currency: 'EUR', priceBasis: 'l' as const, availability: 'available' as const, provenance: 'live' as const, productUrl: 'https://example.com/oil' };

    expect(assessOffer(ingredient, offer)).toMatchObject({ status: 'complete', purchaseCost: 0.24 });
  });

  it('derives a complete subtotal from a selected 6400g tomato requirement', () => {
    const ingredient = { name: 'tomatoes', quantity: 6400, unit: 'g' as const, modifiers: [] };
    const offer = { id: 'tomato-pack', storeId: 'vmv', title: 'Tomatoes 1 kg', packageQuantity: 1, packageUnit: 'kg' as const, price: 12.45, currency: 'EUR', priceBasis: 'package' as const, availability: 'available' as const, provenance: 'live' as const, productUrl: 'https://vmv.bg/products/tomatoes' };
    const assessment = assessOffer(ingredient, offer);
    const [subtotal] = recalculateShoppingSubtotals({
      lines: [{ id: 'tomatoes', ingredient, requiredQuantity: 6400, requiredUnit: 'g', semanticKey: 'tomatoes', offers: [offer], selectedOfferId: offer.id, included: true }],
      assessments: [assessment],
    });

    expect(assessment).toMatchObject({ packagesNeeded: 7, purchasedQuantity: 7000, excessQuantity: 600, purchaseCost: 87.15 });
    expect(subtotal).toMatchObject({ storeId: 'vmv', total: 87.15, status: 'complete', includedLineCount: 1, incompleteLineCount: 0 });
  });

  it('keeps a store subtotal incomplete when any selected line is incomplete', () => {
    const completeIngredient = { name: 'tomatoes', quantity: 6400, unit: 'g' as const, modifiers: [] };
    const completeOffer = { id: 'tomato-pack', storeId: 'vmv', title: 'Tomatoes 1 kg', packageQuantity: 1, packageUnit: 'kg' as const, price: 12.45, currency: 'EUR', priceBasis: 'package' as const, availability: 'available' as const, provenance: 'live' as const, productUrl: 'https://vmv.bg/products/tomatoes' };
    const incompleteIngredient = { name: 'onions', quantity: 500, unit: 'g' as const, modifiers: [] };
    const incompleteOffer = { id: 'onion-unknown', storeId: 'vmv', title: 'Onions', price: 2, currency: 'EUR', priceBasis: 'package' as const, availability: 'available' as const, provenance: 'live' as const, productUrl: 'https://vmv.bg/products/onions' };
    const completeAssessment = assessOffer(completeIngredient, completeOffer);
    const incompleteAssessment = assessOffer(incompleteIngredient, incompleteOffer);
    const [subtotal] = recalculateShoppingSubtotals({
      lines: [
        { id: 'tomatoes', ingredient: completeIngredient, requiredQuantity: 6400, requiredUnit: 'g', semanticKey: 'tomatoes', offers: [completeOffer], selectedOfferId: completeOffer.id, included: true },
        { id: 'onions', ingredient: incompleteIngredient, requiredQuantity: 500, requiredUnit: 'g', semanticKey: 'onions', offers: [incompleteOffer], selectedOfferId: incompleteOffer.id, included: true },
      ],
      assessments: [completeAssessment, incompleteAssessment],
    });

    expect(subtotal).toMatchObject({ status: 'incomplete', total: undefined, includedLineCount: 2, incompleteLineCount: 1 });
  });
});
