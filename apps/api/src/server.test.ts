import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { ProductOffer, ShoppingComparison } from '@home-meal-planner/contracts';
import { buildServer } from './server.js';
import { MemoryRepository } from './repository.js';
import type { AppConfig } from './config.js';
import { assessOffer } from './pricing.js';

const testConfig: AppConfig = {
  port: 0,
  webOrigin: 'http://localhost:5173',
  mongodbDb: 'home_meal_planner_test',
  householdPasswordHash: await bcrypt.hash('test-password', 4),
  sessionSecret: 'test-session-secret',
  ollamaBaseUrl: 'http://127.0.0.1:11434',
  ollamaModel: 'gemma4:e4b',
  aiMode: 'fixture',
  storeMode: 'fixtures',
  storeLocation: 'Sofia',
  storeSearchUrls: {
    ebag: 'https://www.ebag.bg/en/search?query={query}',
    vmv: 'https://vmv.bg/catalogsearch/result/?q={query}',
    randi: 'https://randi.bg/?s={query}',
  },
};

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.unstubAllGlobals();
});

async function login(app: FastifyInstance) {
  const response = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { password: 'test-password' } });
  const cookieHeader = response.headers['set-cookie'];
  return Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
}

describe('protected vertical slice', () => {
  it('logs in, plans a recipe, compares fixture stores, and accepts a selected link', async () => {
    app = await buildServer(testConfig, new MemoryRepository());

    const protectedResponse = await app.inject({ method: 'GET', url: '/api/recipes' });
    expect(protectedResponse.statusCode).toBe(401);

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { password: 'test-password' },
    });
    expect(login.statusCode).toBe(200);
    const cookieHeader = login.headers['set-cookie'];
    const cookie = Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader;
    expect(cookie).toContain('meal_planner_session=');

    const recipes = await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } });
    expect(recipes.statusCode).toBe(200);
    const recipe = recipes.json()[0];
    const today = new Date().toISOString().slice(0, 10);

    const plan = await app.inject({
      method: 'POST',
      url: '/api/meal-plans',
      headers: { cookie },
      payload: {
        name: 'Test week',
        startDate: today,
        endDate: today,
        entries: [{ id: 'entry-1', date: today, slot: 'dinner', recipeId: recipe.id, servings: 2 }],
      },
    });
    expect(plan.statusCode).toBe(200);

    const learnedRecipes = await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } });
    expect(learnedRecipes.json().find((item: { id: string }) => item.id === recipe.id).suitableMealSlots).toContain('dinner');
    const clearedRecipe = await app.inject({
      method: 'PATCH',
      url: `/api/recipes/${recipe.id}`,
      headers: { cookie },
      payload: { suitableMealSlots: [] },
    });
    expect(clearedRecipe.statusCode).toBe(200);
    expect(clearedRecipe.json().suitableMealSlots).toEqual([]);
    const relearnedPlan = await app.inject({
      method: 'PATCH',
      url: `/api/meal-plans/${plan.json().id}`,
      headers: { cookie },
      payload: { entries: plan.json().entries },
    });
    expect(relearnedPlan.statusCode).toBe(200);
    const relearnedRecipes = await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } });
    expect(relearnedRecipes.json().find((item: { id: string }) => item.id === recipe.id).suitableMealSlots).toContain('dinner');

    const extendedEndDate = new Date(`${today}T12:00:00`);
    extendedEndDate.setDate(extendedEndDate.getDate() + 6);
    const extendedPlan = await app.inject({
      method: 'PATCH',
      url: `/api/meal-plans/${plan.json().id}`,
      headers: { cookie },
      payload: { endDate: extendedEndDate.toISOString().slice(0, 10) },
    });
    expect(extendedPlan.statusCode).toBe(200);
    expect(extendedPlan.json().endDate).toBe(extendedEndDate.toISOString().slice(0, 10));

    const suggestions = await app.inject({
      method: 'POST',
      url: `/api/meal-plans/${plan.json().id}/suggest`,
      headers: { cookie },
      payload: {},
    });
    expect(suggestions.statusCode).toBe(200);
    expect(suggestions.json().suggestions).toHaveLength(20);
    const firstSuggestion = suggestions.json().suggestions[0];
    const appliedSuggestions = await app.inject({
      method: 'POST',
      url: `/api/meal-plans/${plan.json().id}/suggestions/apply`,
      headers: { cookie },
      payload: { suggestions: [firstSuggestion] },
    });
    expect(appliedSuggestions.statusCode).toBe(200);
    expect(appliedSuggestions.json().entries).toHaveLength(2);
    const duplicateSuggestion = await app.inject({
      method: 'POST',
      url: `/api/meal-plans/${plan.json().id}/suggestions/apply`,
      headers: { cookie },
      payload: { suggestions: [firstSuggestion] },
    });
    expect(duplicateSuggestion.statusCode).toBe(400);

    const enableEbag = await app.inject({
      method: 'PATCH',
      url: '/api/settings/stores/ebag',
      headers: { cookie },
      payload: { enabled: true },
    });
    expect(enableEbag.statusCode).toBe(200);
    for (const storeId of ['kaufland', 'billa']) {
      const enableStore = await app.inject({
        method: 'PATCH',
        url: `/api/settings/stores/${storeId}`,
        headers: { cookie },
        payload: { enabled: true },
      });
      expect(enableStore.statusCode).toBe(200);
    }

    const comparison = await app.inject({
      method: 'POST',
      url: `/api/meal-plans/${plan.json().id}/shopping/compare`,
      headers: { cookie },
      payload: {},
    });
    expect(comparison.statusCode).toBe(200);
    const comparisonBody = comparison.json();
    expect(comparisonBody.lines).toHaveLength(4);
    expect(comparisonBody.lines.every((line: { offers: unknown[] }) => line.offers.length >= 2)).toBe(true);
    expect(new Set(comparisonBody.lines.flatMap((line: { offers: { storeId: string }[] }) => line.offers.map((offer) => offer.storeId)))).toEqual(new Set(['ebag', 'randi', 'vmv', 'kaufland', 'billa']));

    const line = comparisonBody.lines[0];
    const selectedOffer = line.offers.find((offer: { storeId: string; productUrl: string }) => offer.storeId === 'vmv');
    expect(selectedOffer.productUrl).toMatch(/^https:\/\/vmv\.bg\//);
    const selected = await app.inject({
      method: 'PATCH',
      url: `/api/shopping-comparisons/${comparisonBody.id}/lines/${line.id}`,
      headers: { cookie },
      payload: { selectedOfferId: selectedOffer.id },
    });
    expect(selected.statusCode).toBe(200);
    expect(selected.json().subtotals.some((subtotal: { storeId: string; status: string }) => subtotal.storeId === 'vmv' && subtotal.status === 'complete')).toBe(true);

    const editedPlan = await app.inject({
      method: 'PATCH',
      url: `/api/meal-plans/${plan.json().id}`,
      headers: { cookie },
      payload: { entries: [{ id: 'entry-1', date: today, slot: 'lunch', recipeId: recipe.id, servings: 3 }] },
    });
    expect(editedPlan.statusCode).toBe(200);
    expect(editedPlan.json().entries[0]).toMatchObject({ slot: 'lunch', recipeId: recipe.id, servings: 3 });

    const removedPlan = await app.inject({
      method: 'PATCH',
      url: `/api/meal-plans/${plan.json().id}`,
      headers: { cookie },
      payload: { entries: [] },
    });
    expect(removedPlan.statusCode).toBe(200);
    expect(removedPlan.json().entries).toHaveLength(0);
  });
});

describe('recipe deletion', () => {
  it('deletes recipes and removes their entries from every meal plan', async () => {
    const repository = new MemoryRepository();
    app = await buildServer(testConfig, repository);
    const cookie = await login(app);
    const created = await app.inject({
      method: 'POST', url: '/api/recipes', headers: { cookie },
      payload: { title: 'Disposable recipe', servings: 2, ingredients: [], instructions: ['Mix'], tags: [], suitableMealSlots: [] },
    });
    expect(created.statusCode).toBe(200);
    const unusedDeleted = await app.inject({ method: 'DELETE', url: `/api/recipes/${created.json().id}`, headers: { cookie } });
    expect(unusedDeleted.statusCode).toBe(200);
    expect(unusedDeleted.json()).toEqual({ deleted: true, removedPlannedMeals: 0 });
    expect((await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } })).json().some((recipe: { id: string }) => recipe.id === created.json().id)).toBe(false);
    expect((await app.inject({ method: 'DELETE', url: `/api/recipes/${created.json().id}`, headers: { cookie } })).statusCode).toBe(404);

    const plannedRecipe = (await app.inject({ method: 'GET', url: '/api/recipes', headers: { cookie } })).json()[0];
    const today = new Date().toISOString().slice(0, 10);
    const plan = await app.inject({
      method: 'POST', url: '/api/meal-plans', headers: { cookie },
      payload: { name: 'Clean up deleted recipe', startDate: today, endDate: today, entries: [
        { id: 'breakfast-entry', date: today, slot: 'breakfast', recipeId: plannedRecipe.id, servings: 2 },
        { id: 'lunch-entry', date: today, slot: 'lunch', recipeId: plannedRecipe.id, servings: 2 },
      ] },
    });
    expect(plan.statusCode).toBe(200);
    const deleted = await app.inject({ method: 'DELETE', url: `/api/recipes/${plannedRecipe.id}`, headers: { cookie } });
    expect(deleted.statusCode).toBe(200);
    expect(deleted.json()).toEqual({ deleted: true, removedPlannedMeals: 2 });
    expect(await repository.getRecipe(plannedRecipe.id)).toBeUndefined();
    expect((await repository.getMealPlan(plan.json().id))?.entries).toEqual([]);
  });
});

describe('shopping subtotal synchronization', () => {
  it('replays legacy oil/vinegar recipes through store parsing, selection, quantity edits and reload', async () => {
    // Product names, quantities and prices from the reported VMV comparison.
    const cards = [
      ['oil', 'Зехтин Екстра Върджин Filippo Berio 0,750', '12,58'],
      ['vinegar', 'Оцет винен червен 0,500', '2,00'],
      ['tomatoes-in-oil', 'Сушени чери домати в слънчогледово олио 0.200', '3,52'],
    ];
    vi.stubGlobal('fetch', vi.fn(async () => new Response(cards.map(([id, title, price]) => `<div data-slot="product-card"><a href="/products/${id}"><h3 data-testid="title">${title}</h3></a><span data-testid="product-price-regular-price">${price} €</span><span data-testid="price-container">/ бр. ${price} €</span></div>`).join(''))));
    const repository = new MemoryRepository();
    for (const store of await repository.listStores()) await repository.updateStore(store.id, { enabled: store.id === 'vmv' });
    const recipe = await repository.createRecipe({ title: 'Legacy salad', servings: 2, ingredients: [
      { name: '¼ cup extra-virgin olive oil', raw: '¼ cup extra-virgin olive oil', modifiers: [] },
      { name: 'red wine vinegar', raw: '3 tablespoons red wine vinegar', quantity: 3, modifiers: [] },
      { name: 'зехтин', quantity: 30, unit: 'ml', modifiers: [] },
      { name: 'Extra-virgin olive oil', raw: 'Extra-virgin olive oil', modifiers: [] },
    ], instructions: ['Mix'], tags: [], suitableMealSlots: [] });
    const plan = await repository.createMealPlan({ name: 'Two weeks', startDate: '2026-10-03', endDate: '2026-10-16', entries: Array.from({ length: 14 }, (_, i) => ({ id: `e-${i}`, date: '2026-10-03', slot: 'lunch', recipeId: recipe.id, servings: 2 })) });
    app = await buildServer({ ...testConfig, storeMode: 'live' }, repository);
    const cookie = await login(app);
    const response = await app.inject({ method: 'POST', url: `/api/meal-plans/${plan.id}/shopping/compare`, headers: { cookie } });
    expect(response.statusCode).toBe(200);
    let comparison = response.json<ShoppingComparison>();
    const oil = comparison.lines.find((line) => line.ingredient.name === 'extra-virgin olive oil')!;
    const vinegar = comparison.lines.find((line) => line.ingredient.name === 'red wine vinegar')!;
    const unknown = comparison.lines.find((line) => line.requiredQuantity == null)!;
    expect(oil).toMatchObject({ requiredQuantity: 840, requiredUnit: 'ml' });
    expect(vinegar).toMatchObject({ requiredQuantity: 630, requiredUnit: 'ml' });
    expect(oil.offers).toHaveLength(1);
    expect(oil.offers[0]).toMatchObject({ packageQuantity: 750, packageUnit: 'ml' });
    const patch = async (lineId: string, payload: object) => {
      const result = await app!.inject({ method: 'PATCH', url: `/api/shopping-comparisons/${comparison.id}/lines/${lineId}`, headers: { cookie }, payload });
      expect(result.statusCode).toBe(200);
      comparison = result.json<ShoppingComparison>();
      return comparison;
    };
    await patch(oil.id, { selectedOfferId: oil.offers[0].id });
    await patch(vinegar.id, { selectedOfferId: vinegar.offers[0].id });
    expect(comparison.subtotals[0]).toMatchObject({ status: 'complete', total: 29.16 });
    await patch(unknown.id, { selectedOfferId: unknown.offers[0].id });
    expect(comparison.subtotals[0]).toMatchObject({ status: 'incomplete', knownTotal: 29.16, incompleteLineCount: 1 });
    await patch(unknown.id, { included: false });
    expect(comparison.subtotals[0]).toMatchObject({ status: 'complete', total: 29.16 });
    await patch(unknown.id, { included: true, requiredQuantity: 0.06, requiredUnit: 'l' });
    expect(comparison.subtotals[0]).toMatchObject({ status: 'complete', total: 41.74 });
    const invalid = await app.inject({ method: 'PATCH', url: `/api/shopping-comparisons/${comparison.id}/lines/${unknown.id}`, headers: { cookie }, payload: { requiredQuantity: -1 } });
    expect(invalid.statusCode).toBe(400);
    const reloaded = await app.inject({ method: 'GET', url: `/api/shopping-comparisons/${comparison.id}`, headers: { cookie } });
    expect(reloaded.json().subtotals[0]).toMatchObject({ status: 'complete', total: 41.74 });
    expect(reloaded.json().lines.find((line: { id: string }) => line.id === unknown.id)).toMatchObject({ requiredQuantity: 60, requiredUnit: 'ml' });
  });
  it('repairs stale subtotals on read and updates them when offers change', async () => {
    const ingredient = { name: 'tomatoes', quantity: 6400, unit: 'g' as const, modifiers: [] };
    const completeOffer: ProductOffer = { id: 'tomato-pack', storeId: 'vmv', title: 'Tomatoes 1 kg', packageQuantity: 1, packageUnit: 'kg', price: 12.45, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'live', productUrl: 'https://vmv.bg/products/tomatoes' };
    const incompleteOffer: ProductOffer = { id: 'tomato-missing-pack', storeId: 'vmv', title: 'Tomatoes', price: 12.45, currency: 'EUR', priceBasis: 'package', availability: 'available', provenance: 'live', productUrl: 'https://vmv.bg/products/tomatoes-missing-pack' };
    const completeAssessment = assessOffer(ingredient, completeOffer);
    const incompleteAssessment = assessOffer(ingredient, incompleteOffer);
    const comparison: ShoppingComparison = {
      id: 'stale-comparison',
      mealPlanId: 'plan-1',
      lines: [{ id: 'tomatoes-line', ingredient, requiredQuantity: 6400, requiredUnit: 'g', semanticKey: 'tomatoes', offers: [completeOffer, incompleteOffer], selectedOfferId: completeOffer.id, included: true }],
      assessments: [completeAssessment, incompleteAssessment],
      subtotals: [{ storeId: 'vmv', currency: 'EUR', status: 'incomplete', includedLineCount: 1, incompleteLineCount: 1 }],
      createdAt: '2026-10-05T00:00:00.000Z',
      updatedAt: '2026-10-05T00:00:00.000Z',
    };
    app = await buildServer(testConfig, new MemoryRepository({ comparisons: [comparison] }));
    const cookie = await login(app);

    const repaired = await app.inject({ method: 'GET', url: '/api/shopping-comparisons/stale-comparison', headers: { cookie } });
    expect(repaired.statusCode).toBe(200);
    expect(repaired.json().subtotals).toEqual([{ storeId: 'vmv', currency: 'EUR', total: 87.15, knownTotal: 87.15, status: 'complete', includedLineCount: 1, incompleteLineCount: 0 }]);

    const incomplete = await app.inject({
      method: 'PATCH',
      url: '/api/shopping-comparisons/stale-comparison/lines/tomatoes-line',
      headers: { cookie },
      payload: { selectedOfferId: incompleteOffer.id },
    });
    expect(incomplete.statusCode).toBe(200);
    expect(incomplete.json().subtotals[0]).toMatchObject({ storeId: 'vmv', status: 'incomplete', incompleteLineCount: 1 });
    expect(incomplete.json().subtotals[0].total).toBeUndefined();

    const deselected = await app.inject({
      method: 'PATCH',
      url: '/api/shopping-comparisons/stale-comparison/lines/tomatoes-line',
      headers: { cookie },
      payload: { included: false, selectedOfferId: null },
    });
    expect(deselected.statusCode).toBe(200);
    expect(deselected.json().subtotals).toEqual([]);

    const selectedAgain = await app.inject({
      method: 'PATCH',
      url: '/api/shopping-comparisons/stale-comparison/lines/tomatoes-line',
      headers: { cookie },
      payload: { included: true, selectedOfferId: completeOffer.id },
    });
    expect(selectedAgain.statusCode).toBe(200);
    expect(selectedAgain.json().subtotals[0]).toMatchObject({ storeId: 'vmv', total: 87.15, status: 'complete', incompleteLineCount: 0 });
  });
});
