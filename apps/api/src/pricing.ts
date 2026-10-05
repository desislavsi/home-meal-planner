import type { Ingredient, OfferAssessment, ProductOffer, ShoppingComparison, ShoppingLine, StoreSubtotal } from '@home-meal-planner/contracts';
import { baseQuantity } from './ingredients.js';
import { productMatchesIngredient } from './ingredient-search.js';

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const compatible = (unit?: string, basis?: ProductOffer['priceBasis']) => {
  const normalized = baseQuantity(1, unit).unit;
  if (basis === 'kg') return normalized === 'g';
  if (basis === 'l') return normalized === 'ml';
  if (basis === 'item') return normalized === 'pcs';
  return true;
};

export function assessOffer(ingredient: Ingredient, offer: ProductOffer): OfferAssessment {
  const group = ingredient.brand && offer.brand && ingredient.brand.toLocaleLowerCase() === offer.brand.toLocaleLowerCase()
    ? 'exact-brand'
    : 'alternative';
  if (offer.availability !== 'available') return { offerId: offer.id, group, status: 'incomplete', reason: offer.availability === 'unavailable' ? 'Product is unavailable.' : 'Availability is unknown.' };
  if (ingredient.quantity == null) return { offerId: offer.id, group, status: 'incomplete', reason: 'Recipe amount is unspecified. Add an amount and unit to the recipe, then refresh this comparison.' };
  if (ingredient.unit == null) return { offerId: offer.id, group, status: 'incomplete', reason: 'Recipe unit is missing. Add a unit to the recipe, then refresh this comparison.' };
  if (offer.price == null || offer.priceBasis == null) return { offerId: offer.id, group, status: 'incomplete', reason: 'Price or price basis is unknown.' };
  if (!compatible(ingredient.unit, offer.priceBasis)) return { offerId: offer.id, group, status: 'incomplete', reason: 'Price basis is incompatible with the required unit.' };

  const required = baseQuantity(ingredient.quantity, ingredient.unit);
  if (!required.unit) return { offerId: offer.id, group, status: 'incomplete', reason: 'Required unit cannot be normalized.' };

  if (offer.priceBasis === 'package') {
    if (!offer.packageQuantity || !offer.packageUnit) return { offerId: offer.id, group, status: 'incomplete', reason: 'Package size is unknown.' };
    const pack = baseQuantity(offer.packageQuantity, offer.packageUnit);
    if (!pack.unit || pack.unit !== required.unit) return { offerId: offer.id, group, status: 'incomplete', reason: 'Package unit is incompatible.' };
    const packagesNeeded = Math.ceil(required.value / pack.value);
    const purchasedQuantity = packagesNeeded * pack.value;
    return {
      offerId: offer.id,
      group,
      status: 'complete',
      packagesNeeded,
      purchasedQuantity,
      excessQuantity: purchasedQuantity - required.value,
      purchaseCost: roundCurrency(packagesNeeded * offer.price),
      normalizedUnitPrice: offer.price / pack.value,
    };
  }

  const basisUnit = offer.priceBasis === 'kg' ? 'g' : offer.priceBasis === 'l' ? 'ml' : 'pcs';
  const divisor = offer.priceBasis === 'kg' || offer.priceBasis === 'l' ? 1000 : 1;
  if (required.unit !== basisUnit) return { offerId: offer.id, group, status: 'incomplete', reason: 'Price basis is incompatible.' };
  const purchasedQuantity = required.value;
  const purchaseCost = roundCurrency((required.value / divisor) * offer.price);
  return {
    offerId: offer.id,
    group,
    status: 'complete',
    packagesNeeded: 1,
    purchasedQuantity,
    excessQuantity: 0,
    purchaseCost,
    normalizedUnitPrice: offer.price / divisor,
  };
}

export function rankAssessments(assessments: OfferAssessment[]): OfferAssessment[] {
  return [...assessments].sort((a, b) => {
    const groupA = a.group === 'exact-brand' ? 0 : 1;
    const groupB = b.group === 'exact-brand' ? 0 : 1;
    if (groupA !== groupB) return groupA - groupB;
    if (a.status !== b.status) return a.status === 'complete' ? -1 : 1;
    return (a.purchaseCost ?? Number.POSITIVE_INFINITY) - (b.purchaseCost ?? Number.POSITIVE_INFINITY)
      || (a.excessQuantity ?? Number.POSITIVE_INFINITY) - (b.excessQuantity ?? Number.POSITIVE_INFINITY)
      || (a.normalizedUnitPrice ?? Number.POSITIVE_INFINITY) - (b.normalizedUnitPrice ?? Number.POSITIVE_INFINITY);
  });
}

function assessmentForLine(line: ShoppingLine, offerId: string, assessments: OfferAssessment[]) {
  const lineMatches = assessments.filter((assessment) => assessment.lineId === line.id && assessment.offerId === offerId);
  if (lineMatches.length) return lineMatches[0];

  // Legacy/global offer IDs cannot identify a requirement. Recalculate from
  // this line rather than borrowing a cheaper or complete result elsewhere.
  const offer = line.offers.find((offer) => offer.id === offerId);
  return offer ? assessOffer({ ...line.ingredient, quantity: line.requiredQuantity, unit: line.requiredUnit }, offer) : undefined;
}

export function calculateSubtotals(lines: ShoppingLine[], assessments: OfferAssessment[]): StoreSubtotal[] {
  const totals = new Map<string, StoreSubtotal>();
  for (const line of lines) {
    if (!line.included || !line.selectedOfferId) continue;
    const offer = line.offers.find((item) => item.id === line.selectedOfferId);
    if (!offer) continue;
    const subtotal = totals.get(offer.storeId) ?? {
      storeId: offer.storeId,
      currency: offer.currency,
      total: 0,
      knownTotal: 0,
      status: 'complete' as const,
      includedLineCount: 0,
      incompleteLineCount: 0,
    };
    const assessment = assessmentForLine(line, offer.id, assessments);
    subtotal.includedLineCount += 1;
    if (!assessment || assessment.status === 'incomplete' || assessment.purchaseCost == null || !Number.isFinite(assessment.purchaseCost)) {
      subtotal.status = 'incomplete';
      subtotal.total = undefined;
      subtotal.incompleteLineCount += 1;
    } else {
      subtotal.knownTotal = roundCurrency((subtotal.knownTotal ?? 0) + assessment.purchaseCost);
      if (subtotal.status === 'complete') subtotal.total = subtotal.knownTotal;
    }
    totals.set(offer.storeId, subtotal);
  }
  return [...totals.values()];
}

export function recalculateShoppingSubtotals(comparison: Pick<ShoppingComparison, 'lines' | 'assessments'>): StoreSubtotal[] {
  return calculateSubtotals(comparison.lines, comparison.assessments);
}

export function recalculateShoppingComparison(comparison: ShoppingComparison): ShoppingComparison {
  const assessments = comparison.lines.flatMap((line) => {
    const required = { ...line.ingredient, quantity: line.requiredQuantity, unit: line.requiredUnit };
    const ranked = rankAssessments(line.offers.map((offer) => {
      const assessment = assessOffer(required, offer);
      return productMatchesIngredient(line.ingredient, offer)
        ? { ...assessment, lineId: line.id }
        : { offerId: offer.id, lineId: line.id, group: assessment.group, status: 'incomplete' as const, reason: 'This product does not match the ingredient. Choose another product or refresh stores.' };
    }));
    line.recommendedOfferId = ranked.find((assessment) => assessment.status === 'complete')?.offerId;
    const order = new Map(ranked.map((assessment, index) => [assessment.offerId, index]));
    line.offers.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    return ranked;
  });
  return { ...comparison, assessments, subtotals: calculateSubtotals(comparison.lines, assessments) };
}
