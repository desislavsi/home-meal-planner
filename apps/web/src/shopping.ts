import type { OfferAssessment, ShoppingComparison, ShoppingLine } from '@home-meal-planner/contracts';

export async function restoreShoppingComparison(planId: string, comparisonId: string, fetchComparison: (id: string) => Promise<ShoppingComparison>) {
  const comparison = await fetchComparison(comparisonId);
  return comparison.mealPlanId === planId ? comparison : undefined;
}

export function shouldCollapseShoppingLine(line: { included: boolean; selectedOfferId?: string | null }) {
  return !line.included || Boolean(line.selectedOfferId);
}

export function getOfferAssessment(comparison: ShoppingComparison, line: ShoppingLine, offerId: string): OfferAssessment | undefined {
  const scoped = comparison.assessments.find((item) => item.lineId === line.id && item.offerId === offerId);
  if (scoped) return scoped;
  const legacy = comparison.assessments.filter((item) => !item.lineId && item.offerId === offerId);
  // Ambiguous old snapshots need an API refresh, never another line's price.
  return legacy.length === 1 ? legacy[0] : undefined;
}

export function incompleteSelectedLines(comparison: ShoppingComparison, storeId: string) {
  return comparison.lines.flatMap((line) => {
    if (!line.included || !line.selectedOfferId) return [];
    const offer = line.offers.find((offer) => offer.id === line.selectedOfferId);
    if (!offer || offer.storeId !== storeId) return [];
    const assessment = getOfferAssessment(comparison, line, offer.id);
    if (assessment?.status === 'complete' && assessment.purchaseCost != null) return [];
    return [{ line, reason: assessment?.reason ?? 'Refresh this comparison to calculate the selected product.' }];
  });
}
