import { afterEach, describe, expect, it, vi } from 'vitest';
import { FixtureStoreAdapter, HtmlStoreAdapter } from './stores.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('live adapter parsing', () => {
  it('parses a recorded Randi-style product card', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <div class="product-layout"><div class="product-thumb">
        <div class="vid"><div class="vid2">1.000 кг.</div></div>
        <div class="name"><a href="https://randi.bg/banani-tsena-za-1kg">Банани - Еквадор</a></div>
        <div class="price"><span class="price-normal">1.84€</span></div>
        <a class="btn-cart">Добави в кошница</a>
      </div></div>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));
    const adapter = new HtmlStoreAdapter('randi', 'Randi', 'https://randi.bg/index.php?route=product/search&search={query}');
    const [offer] = await adapter.searchProducts({ query: 'банани', location: 'Sofia' });
    expect(offer).toMatchObject({ title: 'Банани - Еквадор', price: 1.84, priceBasis: 'kg', availability: 'available' });
    expect(offer.packageUnit).toBeUndefined();
    expect(offer.productUrl).toBe('https://randi.bg/banani-tsena-za-1kg');
  });

  it('parses compact VMV package weights and product links', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <div data-slot="product-card">
        <a data-testid="product-card-name-link" href="/products/tomatoes-400"><h3 data-testid="title">Домати 0,400</h3></a>
        <span data-testid="product-price-regular-price">1,39 €</span>
        <span data-testid="price-container">/ бр. 1,39 €</span>
      </div>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));
    const adapter = new HtmlStoreAdapter('vmv', 'VMV', 'https://vmv.bg/search?q={query}');
    const [offer] = await adapter.searchProducts({ query: 'домати', location: 'Sofia' });
    expect(offer).toMatchObject({ title: 'Домати 0,400', price: 1.39, packageQuantity: 400, packageUnit: 'g', priceBasis: 'package', availability: 'available' });
    expect(offer.productUrl).toBe('https://vmv.bg/products/tomatoes-400');
  });

  it('uses an active listing as available and falls back to the VMV price container', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <div data-slot="product-card">
        <a data-testid="product-card-name-link" href="/products/olive-oil"><h3 data-testid="title">Olive oil 1 l</h3></a>
        <span data-testid="price-container">12,50 EUR</span>
      </div>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));
    const adapter = new HtmlStoreAdapter('vmv', 'VMV', 'https://vmv.bg/search?q={query}');

    const [offer] = await adapter.searchProducts({ query: 'olive oil', location: 'Sofia' });

    expect(offer).toMatchObject({ price: 12.5, availability: 'available' });
  });

  it('keeps an explicit out-of-stock signal unavailable', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <div data-slot="product-card">
        <a data-testid="product-card-name-link" href="/products/olive-oil"><h3 data-testid="title">Olive oil 1 l</h3></a>
        <span data-testid="stock">Out of stock</span>
        <span data-testid="price-container">12,50 EUR</span>
      </div>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));
    const adapter = new HtmlStoreAdapter('vmv', 'VMV', 'https://vmv.bg/search?q={query}');

    const [offer] = await adapter.searchProducts({ query: 'olive oil', location: 'Sofia' });

    expect(offer.availability).toBe('unavailable');
  });

  it('provides deterministic fixture catalogs for Kaufland and BILLA', async () => {
    const kaufland = await new FixtureStoreAdapter('kaufland', 'Kaufland').searchProducts({ query: 'домати', location: 'Sofia' });
    const billa = await new FixtureStoreAdapter('billa', 'BILLA').searchProducts({ query: 'домати', location: 'Sofia' });
    expect(kaufland[0]).toMatchObject({ storeId: 'kaufland', packageQuantity: 500, packageUnit: 'g', priceBasis: 'package', provenance: 'demo' });
    expect(billa[0]).toMatchObject({ storeId: 'billa', packageQuantity: 400, packageUnit: 'g', priceBasis: 'package', provenance: 'demo' });
  });
});
