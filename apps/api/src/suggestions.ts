import { mealSlotSchema, type MealPlan, type MealSlot, type MealSuggestion, type MealSuggestions, type Recipe } from '@home-meal-planner/contracts';

export const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

const slotKey = (date: string, slot: MealSlot) => `${date}:${slot}`;

function datesBetween(startDate: string, endDate: string) {
  const dates: string[] = [];
  const current = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function compareRecipes(a: Recipe, b: Recipe, slot: MealSlot, usage: Map<string, number>) {
  const aSuitable = a.suitableMealSlots.includes(slot);
  const bSuitable = b.suitableMealSlots.includes(slot);
  if (aSuitable !== bSuitable) return aSuitable ? -1 : 1;
  const usageDifference = (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0);
  if (usageDifference !== 0) return usageDifference;
  return a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id);
}

function candidatesForSlot(recipes: Recipe[], slot: MealSlot, usage: Map<string, number>) {
  const suitable = recipes.filter((recipe) => recipe.suitableMealSlots.includes(slot));
  const candidates = suitable.length ? suitable : recipes;
  return [...candidates].sort((a, b) => compareRecipes(a, b, slot, usage));
}

export function generateMealSuggestions(plan: MealPlan, recipes: Recipe[]): MealSuggestions {
  if (!recipes.length) return { suggestions: [] };
  const occupied = new Set(plan.entries.map((entry) => slotKey(entry.date, entry.slot)));
  const usage = new Map<string, number>();
  for (const entry of plan.entries) usage.set(entry.recipeId, (usage.get(entry.recipeId) ?? 0) + 1);
  const suggestions: MealSuggestion[] = [];

  for (const date of datesBetween(plan.startDate, plan.endDate)) {
    for (const slot of mealSlots) {
      if (occupied.has(slotKey(date, slot))) continue;
      const candidates = candidatesForSlot(recipes, slot, usage);
      const selected = candidates[0];
      if (!selected) continue;
      const suitable = selected.suitableMealSlots.includes(slot);
      suggestions.push({
        date,
        slot,
        recipeId: selected.id,
        servings: selected.servings,
        reason: suitable ? `Marked suitable for ${slot}; selected with the lowest current usage.` : `No recipes are marked suitable for ${slot}; selected the lowest-use saved recipe.`,
      });
      usage.set(selected.id, (usage.get(selected.id) ?? 0) + 1);
    }
  }

  return { suggestions };
}

export function enforceSuggestionPolicy(plan: MealPlan, recipes: Recipe[], proposed: MealSuggestion[]): MealSuggestions {
  if (!recipes.length) return { suggestions: [] };
  const proposedBySlot = new Map(proposed.map((suggestion) => [slotKey(suggestion.date, suggestion.slot), suggestion]));
  const occupied = new Set(plan.entries.map((entry) => slotKey(entry.date, entry.slot)));
  const usage = new Map<string, number>();
  for (const entry of plan.entries) usage.set(entry.recipeId, (usage.get(entry.recipeId) ?? 0) + 1);
  const suggestions: MealSuggestion[] = [];

  for (const date of datesBetween(plan.startDate, plan.endDate)) {
    for (const slot of mealSlots) {
      const key = slotKey(date, slot);
      if (occupied.has(key)) continue;
      const candidates = candidatesForSlot(recipes, slot, usage);
      const selected = candidates[0];
      if (!selected) continue;
      const proposedSuggestion = proposedBySlot.get(key);
      const proposedRecipe = proposedSuggestion && candidates.find((recipe) => recipe.id === proposedSuggestion.recipeId);
      const chosen = proposedRecipe && compareRecipes(proposedRecipe, selected, slot, usage) === 0 ? proposedRecipe : selected;
      const fallbackReason = chosen.suitableMealSlots.includes(slot) ? `Marked suitable for ${slot}; selected with the lowest current usage.` : `No recipes are marked suitable for ${slot}; selected the lowest-use saved recipe.`;
      suggestions.push({ date, slot, recipeId: chosen.id, servings: chosen.servings, reason: chosen.id === proposedSuggestion?.recipeId ? proposedSuggestion.reason : fallbackReason });
      usage.set(chosen.id, (usage.get(chosen.id) ?? 0) + 1);
    }
  }

  return { suggestions };
}

export function validateMealSuggestions(plan: MealPlan, recipes: Recipe[], suggestions: MealSuggestion[]) {
  const recipeIds = new Set(recipes.map((recipe) => recipe.id));
  const occupied = new Set(plan.entries.map((entry) => slotKey(entry.date, entry.slot)));
  const suggestedSlots = new Set<string>();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

  for (const suggestion of suggestions) {
    if (!recipeIds.has(suggestion.recipeId)) throw new Error(`Suggestion references a recipe that is not saved: ${suggestion.recipeId}.`);
    if (!dateOnly.test(suggestion.date) || suggestion.date < plan.startDate || suggestion.date > plan.endDate) throw new Error(`Suggestion date is outside the meal plan range: ${suggestion.date}.`);
    mealSlotSchema.parse(suggestion.slot);
    const key = slotKey(suggestion.date, suggestion.slot);
    if (occupied.has(key)) throw new Error(`Suggestion overlaps an existing ${suggestion.slot} meal on ${suggestion.date}.`);
    if (suggestedSlots.has(key)) throw new Error(`Suggestions contain a duplicate ${suggestion.slot} meal on ${suggestion.date}.`);
    suggestedSlots.add(key);
  }
}
