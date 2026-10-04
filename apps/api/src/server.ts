import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import {
  ingredientSchema,
  mealPlanInputSchema,
  mealPlanSchema,
  mealSuggestionsSchema,
  recipeInputSchema,
  shoppingComparisonSchema,
  storeSettingSchema,
  type Ingredient,
  type MealPlan,
  type ProductOffer,
  type ShoppingComparison,
} from '@home-meal-planner/contracts';
import type { AppConfig } from './config.js';
import { importRecipeFromUrl } from './recipe-import.js';
import { consolidateIngredients } from './ingredients.js';
import { applyPriceBasisDefaults, buildIngredientSearchProfile, productMatchesIngredient } from './ingredient-search.js';
import { assessOffer, rankAssessments, recalculateShoppingSubtotals } from './pricing.js';
import { suggestMeals } from './ai.js';
import type { Repository } from './repository.js';
import { createStoreAdapters } from './stores.js';
import { validateMealSuggestions } from './suggestions.js';

type Session = { id: string; createdAt: number };

function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }

function validateMealPlanDomain(plan: Pick<MealPlan, 'startDate' | 'endDate' | 'entries'>, recipeIds: Set<string>) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateOnly.test(plan.startDate) || !dateOnly.test(plan.endDate) || plan.startDate > plan.endDate) throw new Error('Meal plan dates must be valid YYYY-MM-DD values with startDate on or before endDate.');
  for (const entry of plan.entries) {
    if (!recipeIds.has(entry.recipeId)) throw new Error(`Meal entry ${entry.id} references a recipe that is not saved.`);
    if (entry.date < plan.startDate || entry.date > plan.endDate) throw new Error(`Meal entry ${entry.id} falls outside the meal plan range.`);
  }
}

function validateStoreProductUrl(config: AppConfig, storeId: string, productUrl: string) {
  const configuredUrl = config.storeSearchUrls[storeId];
  if (!configuredUrl) return false;
  try {
    const expectedHost = new URL(configuredUrl.replace('{query}', 'probe')).hostname;
    const actualHost = new URL(productUrl).hostname;
    return actualHost === expectedHost || actualHost.endsWith(`.${expectedHost}`);
  } catch {
    return false;
  }
}

async function learnRecipeMealSlots(repository: Repository, plan: Pick<MealPlan, 'entries'>) {
  const recipes = new Map((await repository.listRecipes()).map((recipe) => [recipe.id, recipe]));
  for (const entry of plan.entries) {
    const recipe = recipes.get(entry.recipeId);
    if (!recipe || recipe.suitableMealSlots.includes(entry.slot)) continue;
    const updated = await repository.updateRecipe(recipe.id, { suitableMealSlots: [...recipe.suitableMealSlots, entry.slot] });
    if (updated) recipes.set(updated.id, updated);
  }
}

export async function buildServer(config: AppConfig, repository: Repository): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const sessions = new Map<string, Session>();
  const adapters = createStoreAdapters(config, config.storeMode);

  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(cors, { origin: config.webOrigin, credentials: true });

  const requireAuth = async (request: FastifyRequest, reply: { code: (status: number) => { send: (payload: unknown) => void } }) => {
    const token = request.cookies.meal_planner_session;
    if (!token || !sessions.has(token)) {
      reply.code(401).send({ error: 'Authentication required.' });
      return false;
    }
    return true;
  };

  app.get('/health', async () => ({ ok: true, service: 'home-meal-planner' }));
  app.post('/api/auth/login', async (request, reply) => {
    const body = request.body as { password?: string };
    if (!config.householdPasswordHash || !body?.password || !(await bcrypt.compare(body.password, config.householdPasswordHash))) return reply.code(401).send({ error: 'Invalid household password.' });
    const session = randomUUID();
    sessions.set(session, { id: session, createdAt: Date.now() });
    reply.setCookie('meal_planner_session', session, { httpOnly: true, signed: false, sameSite: 'lax', secure: false, path: '/', maxAge: 60 * 60 * 12 });
    return { authenticated: true };
  });
  app.post('/api/auth/logout', async (request, reply) => { const token = request.cookies.meal_planner_session; if (token) sessions.delete(token); reply.clearCookie('meal_planner_session', { path: '/' }); return { authenticated: false }; });
  app.get('/api/auth/session', async (request) => ({ authenticated: Boolean(request.cookies.meal_planner_session && sessions.has(request.cookies.meal_planner_session)) }));

  app.addHook('preHandler', async (request, reply) => {
    if (request.url.startsWith('/api/') && !request.url.startsWith('/api/auth/')) {
      const authenticated = await requireAuth(request, reply);
      if (!authenticated) return;
    }
  });

  app.get('/api/recipes', async () => repository.listRecipes());
  app.post('/api/recipes', async (request, reply) => {
    try { return await repository.createRecipe(recipeInputSchema.parse(request.body)); } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });
  app.patch('/api/recipes/:id', async (request, reply) => {
    try { const recipe = await repository.updateRecipe((request.params as { id: string }).id, recipeInputSchema.partial().parse(request.body)); return recipe ?? reply.code(404).send({ error: 'Recipe not found.' }); } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });
  app.post('/api/recipes/import', async (request, reply) => {
    try { const body = request.body as { url?: string }; if (!body.url) return reply.code(400).send({ error: 'A recipe URL is required.' }); return await importRecipeFromUrl(body.url, false); } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });

  app.post('/api/meal-plans', async (request, reply) => {
    try {
      const input = mealPlanInputSchema.parse(request.body);
      const recipes = await repository.listRecipes();
      validateMealPlanDomain(input, new Set(recipes.map((recipe) => recipe.id)));
      const plan = await repository.createMealPlan(input);
      await learnRecipeMealSlots(repository, plan);
      return plan;
    } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });
  app.get('/api/meal-plans/:id', async (request, reply) => { const plan = await repository.getMealPlan((request.params as { id: string }).id); return plan ?? reply.code(404).send({ error: 'Meal plan not found.' }); });
  app.patch('/api/meal-plans/:id', async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      const current = await repository.getMealPlan(id);
      if (!current) return reply.code(404).send({ error: 'Meal plan not found.' });
      const input = mealPlanInputSchema.partial().parse(request.body);
      const candidate = mealPlanSchema.parse({ ...current, ...input });
      const recipes = await repository.listRecipes();
      validateMealPlanDomain(candidate, new Set(recipes.map((recipe) => recipe.id)));
      const plan = await repository.updateMealPlan(id, input);
      if (plan) await learnRecipeMealSlots(repository, plan);
      return plan;
    } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });
  app.post('/api/meal-plans/:id/suggest', async (request, reply) => {
    const plan = await repository.getMealPlan((request.params as { id: string }).id);
    if (!plan) return reply.code(404).send({ error: 'Meal plan not found.' });
    const recipes = await repository.listRecipes();
    validateMealPlanDomain(plan, new Set(recipes.map((recipe) => recipe.id)));
    return suggestMeals(config, plan, recipes);
  });

  app.post('/api/meal-plans/:id/suggestions/apply', async (request, reply) => {
    try {
      const id = (request.params as { id: string }).id;
      const current = await repository.getMealPlan(id);
      if (!current) return reply.code(404).send({ error: 'Meal plan not found.' });
      const recipes = await repository.listRecipes();
      validateMealPlanDomain(current, new Set(recipes.map((recipe) => recipe.id)));
      const body = request.body as { suggestions?: unknown };
      const suggestions = mealSuggestionsSchema.parse(body);
      validateMealSuggestions(current, recipes, suggestions.suggestions);
      const entries = [...current.entries, ...suggestions.suggestions.map((suggestion) => ({ id: randomUUID(), ...suggestion }))];
      const candidate = mealPlanSchema.parse({ ...current, entries });
      validateMealPlanDomain(candidate, new Set(recipes.map((recipe) => recipe.id)));
      const plan = await repository.updateMealPlan(id, { entries });
      if (!plan) return reply.code(404).send({ error: 'Meal plan not found.' });
      await learnRecipeMealSlots(repository, plan);
      return plan;
    } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); }
  });

  app.post('/api/meal-plans/:id/shopping/compare', async (request, reply) => {
    const plan = await repository.getMealPlan((request.params as { id: string }).id);
    if (!plan) return reply.code(404).send({ error: 'Meal plan not found.' });
    const recipes = await repository.listRecipes();
    validateMealPlanDomain(plan, new Set(recipes.map((recipe) => recipe.id)));
    const recipeMap = new Map(recipes.map((recipe) => [recipe.id, recipe]));
    const lines = consolidateIngredients(plan, recipeMap);
    const stores = (await repository.listStores()).filter((store) => store.enabled).sort((a, b) => a.priority - b.priority);
    const adapterMap = new Map(adapters.map((adapter) => [adapter.id, adapter]));
    const liveResults = await Promise.all(stores.map(async (store) => {
      const adapter = adapterMap.get(store.id);
      if (!adapter) return { store, products: [] as ProductOffer[] };
      const products = await Promise.all(lines.map(async (line) => {
        const profile = buildIngredientSearchProfile(line.ingredient);
        const results = await Promise.all(profile.searchTerms.map(async (query) => {
          try { return await adapter.searchProducts({ query, location: store.location }); } catch { return []; }
        }));
        const uniqueOffers = new Map<string, ProductOffer>();
        for (const rawOffer of results.flat().filter((product) => productMatchesIngredient(line.ingredient, product))) {
          const offer = applyPriceBasisDefaults(line.ingredient, rawOffer);
          uniqueOffers.set(`${offer.storeId}|${offer.productUrl}|${offer.title}`, offer);
        }
        return [...uniqueOffers.values()];
      }));
      return { store, products: products.flat() };
    }));
    const assessments = [];
    for (const line of lines) {
      const offers = liveResults.flatMap((result) => result.products.filter((product) => productMatchesIngredient(line.ingredient, product)));
      line.offers = offers;
      // Assess against the consolidated line quantity, not only the first
      // recipe occurrence represented by line.ingredient.
      const requiredIngredient: Ingredient = {
        ...line.ingredient,
        quantity: line.requiredQuantity,
        unit: line.requiredUnit,
      };
      const ranked = rankAssessments(offers.map((offer) => assessOffer(requiredIngredient, offer)));
      assessments.push(...ranked);
      line.recommendedOfferId = ranked.find((assessment) => assessment.status === 'complete')?.offerId;
    }
    const timestamp = new Date().toISOString();
    const comparison: ShoppingComparison = shoppingComparisonSchema.parse({ id: randomUUID(), mealPlanId: plan.id, lines, assessments, subtotals: recalculateShoppingSubtotals({ lines, assessments }), createdAt: timestamp, updatedAt: timestamp });
    return repository.saveComparison(comparison);
  });
  app.patch('/api/shopping-comparisons/:id/lines/:lineId', async (request, reply) => {
    const comparison = await repository.getComparison((request.params as { id: string }).id);
    if (!comparison) return reply.code(404).send({ error: 'Shopping comparison not found.' });
    const lineId = (request.params as { lineId: string }).lineId;
    const line = comparison.lines.find((item) => item.id === lineId);
    if (!line) return reply.code(404).send({ error: 'Shopping line not found.' });
    const body = request.body as { included?: boolean; selectedOfferId?: string | null };
    if (body.included != null) line.included = body.included;
    if (body.selectedOfferId !== undefined) {
      if (body.selectedOfferId !== null && !line.offers.some((offer) => offer.id === body.selectedOfferId)) return reply.code(400).send({ error: 'Selected offer does not belong to this line.' });
      const selectedOffer = body.selectedOfferId === null ? undefined : line.offers.find((offer) => offer.id === body.selectedOfferId);
      if (selectedOffer && !validateStoreProductUrl(config, selectedOffer.storeId, selectedOffer.productUrl)) return reply.code(400).send({ error: 'Selected offer URL does not belong to its configured store.' });
      line.selectedOfferId = body.selectedOfferId ?? undefined;
    }
    comparison.subtotals = recalculateShoppingSubtotals(comparison);
    comparison.updatedAt = new Date().toISOString();
    return repository.updateComparison(comparison.id, comparison);
  });

  app.get('/api/shopping-comparisons/:id', async (request, reply) => {
    const comparison = await repository.getComparison((request.params as { id: string }).id);
    if (!comparison) return reply.code(404).send({ error: 'Shopping comparison not found.' });
    const refreshed = shoppingComparisonSchema.parse({ ...comparison, subtotals: recalculateShoppingSubtotals(comparison) });
    await repository.updateComparison(refreshed.id, refreshed);
    return refreshed;
  });
  app.get('/api/settings/stores', async () => repository.listStores());
  app.patch('/api/settings/stores/:id', async (request, reply) => { try { const store = await repository.updateStore((request.params as { id: string }).id, storeSettingSchema.partial().parse(request.body)); return store ?? reply.code(404).send({ error: 'Store not found.' }); } catch (error) { return reply.code(400).send({ error: errorMessage(error) }); } });

  return app;
}
