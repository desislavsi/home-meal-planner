import { describe, expect, it } from 'vitest';
import { shouldCollapseShoppingLine } from './shopping';

describe('shopping line collapse state', () => {
  it('keeps an included line without a product open for choosing', () => {
    expect(shouldCollapseShoppingLine({ included: true })).toBe(false);
  });

  it('collapses a line after a product is selected', () => {
    expect(shouldCollapseShoppingLine({ included: true, selectedOfferId: 'offer-1' })).toBe(true);
  });

  it('collapses an excluded line even when no product was selected', () => {
    expect(shouldCollapseShoppingLine({ included: false })).toBe(true);
  });
});
