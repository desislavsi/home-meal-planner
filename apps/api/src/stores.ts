import { randomUUID } from 'node:crypto';
import * as cheerio from 'cheerio';
import type { ProductOffer, StoreSetting } from '@home-meal-planner/contracts';
import type { AppConfig } from './config.js';
import { isStandaloneLiquidProduct } from './ingredient-search.js';

export type StoreSearchInput = { query: string; location: string };

export interface StoreAdapter {
  id: string
  name: string
  searchProducts(input: StoreSearchInput): Promise<ProductOffer[]>
}

const fixtureCatalog: Record<string, ProductOffer[]> = {
  ebag: [
    { id: 'ebag-milk-1l', storeId: 'ebag', title: 'Прясно мляко Верея 3% 1 л', brand: 'Верея', packageQuantity: 1, packageUnit: 'l', price: 2.91, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-tomato-400', storeId: 'ebag', title: 'Домати 400 г', packageQuantity: 400, packageUnit: 'g', price: 1.39, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-onion-1pc', storeId: 'ebag', title: 'Лук 1 бр.', packageQuantity: 1, packageUnit: 'pcs', price: 0.49, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-eggs-10', storeId: 'ebag', title: 'Яйца 10 бр.', packageQuantity: 10, packageUnit: 'pcs', price: 3.49, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-olive-oil-500ml', storeId: 'ebag', title: 'Зехтин 500 мл', packageQuantity: 500, packageUnit: 'ml', price: 6.49, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-banana-kg', storeId: 'ebag', title: 'Банани на кг', packageUnit: 'kg', price: 1.89, currency: 'EUR', priceBasis: 'kg', availability: 'available', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
    { id: 'ebag-flour-1kg', storeId: 'ebag', title: 'Брашно София Мел 1 кг', brand: 'София Мел', packageQuantity: 1, packageUnit: 'kg', price: 1.65, currency: 'EUR', priceBasis: 'package', availability: 'unknown', provenance: 'demo', productUrl: 'https://www.ebag.bg/en/', },
  ],
  vmv: [
    { id: 'vmv-milk-1l', storeId: 'vmv', title: 'Прясно мляко Верея 3% 1 л', brand: 'Верея', packageQuantity: 1, packageUnit: 'l', price: 3.05, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-cucumber-1kg', storeId: 'vmv', title: 'Cucumber 1 kg', packageQuantity: 1, packageUnit: 'kg', price: 2.45, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-cucumber-detergent', storeId: 'vmv', title: 'Spark Cucumber Dish Detergent', packageQuantity: 1, packageUnit: 'l', price: 4.67, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-tomato-800', storeId: 'vmv', title: 'Домати 800 г', packageQuantity: 800, packageUnit: 'g', price: 2.20, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-onion-500', storeId: 'vmv', title: 'Лук 500 г', packageQuantity: 500, packageUnit: 'g', price: 1.10, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-eggs-6', storeId: 'vmv', title: 'Яйца 6 бр.', packageQuantity: 6, packageUnit: 'pcs', price: 2.25, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-olive-oil-1l', storeId: 'vmv', title: 'Зехтин 1 л', packageQuantity: 1, packageUnit: 'l', price: 10.50, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-banana-kg', storeId: 'vmv', title: 'Банани на кг', packageUnit: 'kg', price: 2.10, currency: 'EUR', priceBasis: 'kg', availability: 'available', provenance: 'demo', productUrl: 'https://vmv.bg/', },
    { id: 'vmv-flour-1kg', storeId: 'vmv', title: 'Брашно 1 кг', packageQuantity: 1, packageUnit: 'kg', price: 1.59, currency: 'EUR', priceBasis: 'package', availability: 'unknown', provenance: 'demo', productUrl: 'https://vmv.bg/', },
  ],
  randi: [
    { id: 'randi-milk-1l', storeId: 'randi', title: 'Прясно мляко 1 л', packageQuantity: 1, packageUnit: 'l', price: 2.99, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
    { id: 'randi-tomato-500', storeId: 'randi', title: 'Домати 500 г', packageQuantity: 500, packageUnit: 'g', price: 1.75, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
    { id: 'randi-onion-1pc', storeId: 'randi', title: 'Лук 1 бр.', packageQuantity: 1, packageUnit: 'pcs', price: 0.55, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
    { id: 'randi-eggs-10', storeId: 'randi', title: 'Яйца 10 бр.', packageQuantity: 10, packageUnit: 'pcs', price: 3.29, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
    { id: 'randi-olive-oil-500ml', storeId: 'randi', title: 'Зехтин 500 мл', packageQuantity: 500, packageUnit: 'ml', price: 6.25, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
    { id: 'randi-banana-kg', storeId: 'randi', title: 'Банани на кг', packageUnit: 'kg', price: 2.05, currency: 'EUR', priceBasis: 'kg', availability: 'available', provenance: 'demo', productUrl: 'https://randi.bg/', },
  ],
  kaufland: [
    { id: 'kaufland-milk-1l', storeId: 'kaufland', title: 'Прясно мляко Верея 3% 1 л', brand: 'Верея', packageQuantity: 1, packageUnit: 'l', price: 2.79, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.kaufland.bg/tursene.html?query=milk' },
    { id: 'kaufland-tomato-500', storeId: 'kaufland', title: 'Домати 500 г', packageQuantity: 500, packageUnit: 'g', price: 1.29, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.kaufland.bg/tursene.html?query=tomatoes' },
    { id: 'kaufland-onion-1pc', storeId: 'kaufland', title: 'Лук 1 бр.', packageQuantity: 1, packageUnit: 'pcs', price: 0.39, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.kaufland.bg/tursene.html?query=onion' },
    { id: 'kaufland-eggs-10', storeId: 'kaufland', title: 'Яйца 10 бр.', packageQuantity: 10, packageUnit: 'pcs', price: 3.19, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.kaufland.bg/tursene.html?query=eggs' },
    { id: 'kaufland-olive-oil-500ml', storeId: 'kaufland', title: 'Зехтин 500 мл', packageQuantity: 500, packageUnit: 'ml', price: 5.99, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.kaufland.bg/tursene.html?query=olive-oil' },
  ],
  billa: [
    { id: 'billa-milk-1l', storeId: 'billa', title: 'Прясно мляко 3% 1 л', packageQuantity: 1, packageUnit: 'l', price: 2.85, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.billa.bg/' },
    { id: 'billa-tomato-400', storeId: 'billa', title: 'Домати 400 г', packageQuantity: 400, packageUnit: 'g', price: 1.49, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.billa.bg/' },
    { id: 'billa-onion-1pc', storeId: 'billa', title: 'Лук 1 бр.', packageQuantity: 1, packageUnit: 'pcs', price: 0.45, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.billa.bg/' },
    { id: 'billa-eggs-10', storeId: 'billa', title: 'Яйца 10 бр.', packageQuantity: 10, packageUnit: 'pcs', price: 3.39, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.billa.bg/' },
    { id: 'billa-olive-oil-500ml', storeId: 'billa', title: 'Зехтин 500 мл', packageQuantity: 500, packageUnit: 'ml', price: 6.19, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'demo', productUrl: 'https://www.billa.bg/' },
  ],
};

export class FixtureStoreAdapter implements StoreAdapter {
  constructor(public readonly id: string, public readonly name: string) {}
  async searchProducts(input: StoreSearchInput) {
    const normalized = input.query.toLocaleLowerCase();
    return (fixtureCatalog[this.id] ?? []).filter((product) => product.title.toLocaleLowerCase().includes(normalized) || normalized.includes(product.title.split(' ')[0].toLocaleLowerCase()));
  }
}

function parseNumber(value: string | undefined) {
  if (!value) return undefined;
  const match = value.replace(',', '.').match(/[0-9]+(?:\.[0-9]+)?/);
  return match ? Number(match[0]) : undefined;
}

const unavailableListingPattern = /out of stock|outofstock|unavailable|not available|sold out|soldout|\u043d\u044f\u043c\u0430 \u043d\u0430\u043b\u0438\u0447\u043d\u043e\u0441\u0442|\u0438\u0437\u0447\u0435\u0440\u043f\u0430\u043d|\u043d\u044f\u043c\u0430 \u0435 \u043d\u0430\u043b\u0438\u0447\u0435\u043d/i;

function availabilityFromActiveListing(text: string): ProductOffer['availability'] {
  return unavailableListingPattern.test(text) ? 'unavailable' : 'available';
}

type InferredOfferDetails = Pick<ProductOffer, 'packageQuantity' | 'packageUnit' | 'priceBasis' | 'priceBasisAssumed'>;

function inferOfferDetails(title: string, context: string): InferredOfferDetails {
  const text = `${title} ${context}`.toLocaleLowerCase();
  if (/(?:^|\s)\d+(?:[,.]\d+)?\s*(?:кг|kg)(?=$|[^\p{L}])/iu.test(context)) return { priceBasis: 'kg' };
  if (/(?:^|\s)\d+(?:[,.]\d+)?\s*(?:л|l)(?=$|[^\p{L}])/iu.test(context)) return { priceBasis: 'l' };
  if (/(?:\/|на|per)\s*(?:кг|kg)(?=$|[^\p{L}])/iu.test(text)) return { priceBasis: 'kg' };
  if (/(?:\/|на|per)\s*(?:л|l)(?=$|[^\p{L}])/iu.test(text)) return { priceBasis: 'l' };

  const explicit = text.match(/(\d+(?:[,.]\d+)?)\s*(кг|kg|мл|ml|гр|г|g|л|l|бр\.?|pcs?|item)(?=$|[^\p{L}])/iu);
  if (explicit) {
    const amount = Number(explicit[1].replace(',', '.'));
    const unit = explicit[2];
    if (/кг|kg/i.test(unit)) return { packageQuantity: amount, packageUnit: 'kg', priceBasis: 'package' };
    if (/мл|ml/i.test(unit)) return { packageQuantity: amount, packageUnit: 'ml', priceBasis: 'package' };
    if (/гр|г|g/i.test(unit)) return { packageQuantity: amount, packageUnit: 'g', priceBasis: 'package' };
    if (/л|l/i.test(unit)) return { packageQuantity: amount, packageUnit: 'l', priceBasis: 'package' };
    return { packageQuantity: amount, packageUnit: 'pcs', priceBasis: 'package' };
  }

  // VMV omits the unit in compact titles: 0,400 for food weight, but
  // 0,750 for an oil bottle means litres. Explicit units above always win.
  const compactWeight = title.match(/(?:^|\s)(0[,.]\d{3})(?:\s|$)/);
  if (compactWeight && /(?:\/|на|per)\s*(?:бр\.?|pcs?|item)(?=$|[^\p{L}])/iu.test(text)) {
    const liquid = isStandaloneLiquidProduct(title, 'oil') || isStandaloneLiquidProduct(title, 'vinegar');
    return { packageQuantity: Number(compactWeight[1].replace(',', '.')) * 1000, packageUnit: liquid ? 'ml' : 'g', priceBasis: 'package', priceBasisAssumed: liquid || undefined };
  }
  if (/(?:\/|на|per)\s*(?:бр\.?|pcs?|item)(?=$|[^\p{L}])/iu.test(text)) return { priceBasis: 'package' };
  return {};
}

export class HtmlStoreAdapter implements StoreAdapter {
  constructor(public readonly id: string, public readonly name: string, private readonly searchTemplate: string) {}
  async searchProducts(input: StoreSearchInput): Promise<ProductOffer[]> {
    const url = this.searchTemplate.replace('{query}', encodeURIComponent(input.query));
    const response = await fetch(url, { headers: { 'User-Agent': 'HomeMealPlanner/0.1 public-catalog-check' }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`${this.name} returned HTTP ${response.status}`);
    const html = await response.text();
    const $ = cheerio.load(html);
    const fetchedAt = new Date().toISOString();
    const offers: ProductOffer[] = [];
    const addOffer = (candidate: Omit<ProductOffer, 'id' | 'storeId' | 'provenance' | 'fetchedAt'>, context = '') => {
      const inferred = inferOfferDetails(candidate.title, `${context} ${candidate.priceBasis ?? ''}`);
      const availability = candidate.availability === 'unknown' ? availabilityFromActiveListing(`${candidate.title} ${context}`) : candidate.availability;
      offers.push({ ...candidate, ...inferred, availability, id: randomUUID(), storeId: this.id, provenance: 'live', fetchedAt });
    };

    if (this.id === 'randi') {
      $('.product-layout').each((_, element) => {
        const card = $(element);
        const title = card.find('.name a').first().text().trim();
        const href = card.find('.name a, .product-img').first().attr('href');
        if (!title || !href) return;
        const cardText = card.text();
        const cartAvailable = card.find('.btn-cart').length > 0;
        addOffer({
          title,
          price: parseNumber(card.find('.price-normal').first().text()),
          currency: 'EUR',
          availability: /out of stock|unavailable|няма наличност|изчерпан/i.test(cardText) ? 'unavailable' : cartAvailable ? 'available' : 'unknown',
          productUrl: new URL(href, url).toString(),
        }, `${card.find('.vid1, .vid2').text()} ${card.find('.price').text()}`);
      });
      return offers;
    }

    if (this.id === 'vmv') {
      $('[data-slot="product-card"]').each((_, element) => {
        const card = $(element);
        const title = card.find('[data-testid="title"]').first().text().trim();
        const href = card.find('a[href^="/products"], a[data-testid*="name-link"]').first().attr('href');
        if (!title || !href) return;
        const stockText = card.find('[data-testid*="stock"]').text();
        addOffer({
          title,
          price: parseNumber(card.find('[data-testid="product-price-regular-price"], [data-testid="price-container"], [data-testid*="price"], .price, [class*="price"]').first().text()),
          currency: 'EUR',
          availability: /out of stock|unavailable|няма наличност|изчерпан/i.test(stockText) ? 'unavailable' : 'unknown',
          productUrl: new URL(href, url).toString(),
        }, card.find('[data-testid="price-container"], [data-testid*="stock"]').text());
      });
      return offers;
    }

    $('script[type="application/ld+json"]').each((_, element) => {
      try {
        const value = JSON.parse($(element).text());
        const products = Array.isArray(value) ? value : value?.['@type'] === 'Product' ? [value] : value?.['@graph'] ?? [];
        for (const product of products) {
          if (product?.['@type'] !== 'Product' || typeof product.name !== 'string') continue;
          const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
          const price = parseNumber(String(offer?.price ?? ''));
          const urlValue = typeof product.url === 'string' ? product.url : typeof offer?.url === 'string' ? offer.url : undefined;
          if (!urlValue) continue;
          addOffer({ title: product.name, brand: typeof product.brand === 'string' ? product.brand : product.brand?.name, price, currency: offer?.priceCurrency, availability: availabilityFromActiveListing(String(offer?.availability ?? '')), productUrl: new URL(urlValue, url).toString() });
        }
      } catch { /* ignore malformed product JSON-LD */ }
    });
    if (offers.length) return offers;
    $('[data-product], .product, .product-item, article').each((_, element) => {
      const card = $(element);
      const title = card.find('[data-product-name], .product-name, .product-title, h2, h3').first().text().trim();
      const href = card.find('a[href]').first().attr('href');
      if (!title || !href) return;
      const price = parseNumber(card.find('[data-price], .price, .product-price, [class*="price"]').first().text());
      addOffer({ title, price, availability: /out of stock|не е наличен|unavailable/i.test(card.text()) ? 'unavailable' : 'unknown', productUrl: new URL(href, url).toString() });
    });
    return offers;
  }
}

export function createStoreAdapters(config: AppConfig, mode: 'live' | 'fixtures'): StoreAdapter[] {
  const definitions = [
    ['ebag', 'eBag'],
    ['vmv', 'VMV'],
    ['randi', 'Randi'],
    ['kaufland', 'Kaufland'],
    ['billa', 'BILLA'],
  ] as const;
  return definitions.map(([id, name]) => mode === 'fixtures' ? new FixtureStoreAdapter(id, name) : new HtmlStoreAdapter(id, name, config.storeSearchUrls[id]));
}

export async function checkStore(adapter: StoreAdapter, queries: string[], location: string) {
  const results = [];
  for (const query of queries) {
    try {
      const products = await adapter.searchProducts({ query, location });
      results.push({ query, products, ok: products.some((product) => Boolean(product.title && product.productUrl && product.price != null && product.priceBasis)) });
    } catch (error) {
      results.push({ query, products: [], ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const liveProducts = results.flatMap((result) => result.products);
  const pass = liveProducts.length >= 3 && liveProducts.some((product) => product.priceBasis === 'kg' || product.priceBasis === 'l') && liveProducts.some((product) => product.priceBasis === 'package');
  return { storeId: adapter.id, name: adapter.name, pass, results };
}
