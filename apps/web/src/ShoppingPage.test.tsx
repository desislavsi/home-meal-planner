import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ShoppingComparison } from '@home-meal-planner/contracts';
import { ShoppingPage } from './ShoppingPage';
import { getOfferAssessment, incompleteSelectedLines, restoreShoppingComparison } from './shopping';

const comparison: ShoppingComparison = {
  id: 'comparison', mealPlanId: 'plan', createdAt: '2026-10-05T01:00:00Z', updatedAt: '2026-10-05T01:00:00Z',
  lines: [
    { id: 'measured', semanticKey: 'oil', ingredient: { name: 'зехтин', modifiers: [] }, requiredQuantity: 510, requiredUnit: 'ml', included: true, selectedOfferId: 'oil', offers: [{ id: 'oil', storeId: 'vmv', title: 'Зехтин 750 ml', price: 12.58, currency: 'EUR', productUrl: 'https://vmv.bg/products/oil', availability: 'available', provenance: 'demo' }] },
    { id: 'unmeasured', semanticKey: 'oil', ingredient: { name: 'Oil for drizzling', modifiers: [] }, included: true, selectedOfferId: 'oil', offers: [{ id: 'oil', storeId: 'vmv', title: 'Зехтин 750 ml', price: 12.58, currency: 'EUR', productUrl: 'https://vmv.bg/products/oil', availability: 'available', provenance: 'demo' }] },
  ],
  assessments: [
    { lineId: 'measured', offerId: 'oil', status: 'complete', group: 'alternative', purchaseCost: 12.58 },
    { lineId: 'unmeasured', offerId: 'oil', status: 'incomplete', group: 'alternative', reason: 'Recipe amount is unspecified.' },
  ],
  subtotals: [{ storeId: 'vmv', currency: 'EUR', status: 'incomplete', knownTotal: 12.58, includedLineCount: 2, incompleteLineCount: 1 }],
};

describe('shopping pricing explanations', () => {
  it('renders an explicit Select action for each product when editing a line', () => {
    const editing = { ...comparison, lines: comparison.lines.map((line) => ({ ...line, selectedOfferId: undefined })) };
    const html = renderToStaticMarkup(<ShoppingPage comparison={editing} setComparison={() => {}} onRefresh={async () => {}} onError={() => {}} />);
    expect(html.match(/class="offer-select"/g)).toHaveLength(2);
    expect(html.match(/>Select<\/button>/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Select Зехтин 750 ml for зехтин"');
  });

  it('restores server-calculated totals after reload only for the current plan', async () => {
    const current = { ...comparison, subtotals: [{ ...comparison.subtotals[0], total: 12.58, status: 'complete' as const, incompleteLineCount: 0 }] };
    expect(await restoreShoppingComparison('plan', 'comparison', async () => current)).toBe(current);
    expect(await restoreShoppingComparison('different-plan', 'comparison', async () => current)).toBeUndefined();
  });
  it('uses the matching line assessment and shows why a collapsed selection blocks the subtotal', () => {
    expect(getOfferAssessment(comparison, comparison.lines[1], 'oil')?.status).toBe('incomplete');
    expect(incompleteSelectedLines(comparison, 'vmv').map(({ line }) => line.id)).toEqual(['unmeasured']);
    const html = renderToStaticMarkup(<ShoppingPage comparison={comparison} setComparison={() => {}} onRefresh={async () => {}} onError={() => {}} />);
    expect(html).toContain('Incomplete — 1 need review');
    expect(html).toContain('Known items: 12.58 EUR');
    expect(html).toContain('Recipe amount is unspecified.');
    expect(html).toContain('12.58 EUR estimated purchase cost');
    expect(html).not.toContain('Shopping quantity');
    expect(html).not.toContain('Update quantity');
  });

  it('does not borrow another line assessment for a reused offer ID', () => {
    const missing = { ...comparison, assessments: comparison.assessments.slice(0, 1) };
    expect(getOfferAssessment(missing, comparison.lines[1], 'oil')).toBeUndefined();
  });
});
