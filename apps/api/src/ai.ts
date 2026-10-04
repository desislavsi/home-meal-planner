import { createOpenAI } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { mealSuggestionsSchema, type MealPlan, type MealSuggestions, type Recipe } from '@home-meal-planner/contracts';
import type { AppConfig } from './config.js';
import { enforceSuggestionPolicy, generateMealSuggestions, validateMealSuggestions } from './suggestions.js';

function deterministicSuggestions(plan: MealPlan, recipes: Recipe[]): MealSuggestions {
  return generateMealSuggestions(plan, recipes);
}

export function createMealAgent(config: AppConfig) {
  const ollama = createOpenAI({ baseURL: `${config.ollamaBaseUrl.replace(/\/$/, '')}/v1`, apiKey: 'ollama' });
  return new Agent({
    id: 'home-meal-planner-agent',
    name: 'Home Meal Planner',
    instructions: 'You suggest meals only by selecting recipe IDs from the supplied saved recipe collection. Never invent recipe IDs, ingredients, prices, stores, or shopping quantities. Preserve Bulgarian ingredient meanings and provide concise editable reasons.',
    model: ollama(config.ollamaModel),
  });
}

export async function suggestMeals(config: AppConfig, plan: MealPlan, recipes: Recipe[], strictLive = false): Promise<MealSuggestions> {
  if (config.aiMode === 'fixture' && !strictLive) return deterministicSuggestions(plan, recipes);
  const agent = createMealAgent(config);
  const prompt = JSON.stringify({ plan: { startDate: plan.startDate, endDate: plan.endDate, entries: plan.entries }, savedRecipes: recipes.map((recipe) => ({ id: recipe.id, title: recipe.title, servings: recipe.servings, tags: recipe.tags, suitableMealSlots: recipe.suitableMealSlots, ingredients: recipe.ingredients })) });
  try {
    const result = await agent.generate<MealSuggestions>(`Create meal suggestions for this household plan. Return only valid structured data. Input: ${prompt}`, {
      structuredOutput: { schema: mealSuggestionsSchema, errorStrategy: 'strict' },
      maxSteps: 1,
    });
    const output = result.object ?? JSON.parse(result.text);
    const parsed = mealSuggestionsSchema.parse(output);
    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= plan.startDate && date <= plan.endDate;
    if (parsed.suggestions.some((item) => !recipeIds.has(item.recipeId) || !validDate(item.date))) throw new Error('AI returned a recipe ID or date outside the saved domain.');
    validateMealSuggestions(plan, recipes, parsed.suggestions);
    return enforceSuggestionPolicy(plan, recipes, parsed.suggestions);
  } catch (error) {
    if (strictLive) throw error;
    return deterministicSuggestions(plan, recipes);
  }
}

export function createGemmaSmokeFixture() {
  const plan: MealPlan = { id: 'smoke-plan', name: 'Gemma smoke test', startDate: '2099-01-03', endDate: '2099-01-09', entries: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const recipe: Recipe = { id: 'smoke-recipe', title: 'Българска вечеря', servings: 2, ingredients: [{ name: 'картофи', quantity: 500, unit: 'g', form: 'fresh', modifiers: [] }, { name: 'домати', quantity: 400, unit: 'g', form: 'canned', modifiers: [] }, { name: 'кисело мляко', quantity: 400, unit: 'g', fatPercent: 3.6, modifiers: [] }, { name: 'брашно', quantity: 1, unit: 'kg', modifiers: [] }], instructions: ['Гответе.'], tags: [], suitableMealSlots: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  return { plan, recipe };
}

export async function smokeGemma(config: AppConfig) {
  try {
    const response = await fetch(`${config.ollamaBaseUrl.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(2_000) });
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
  } catch (error) {
    throw new Error(`Ollama preflight failed at ${config.ollamaBaseUrl}. Start Ollama and make sure ${config.ollamaModel} is available. ${error instanceof Error ? error.message : String(error)}`);
  }
  const { plan, recipe } = createGemmaSmokeFixture();
  return suggestMeals(config, plan, [recipe], true);
}
