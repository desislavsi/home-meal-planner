import { z } from 'zod';

export const mealSlotSchema = z.enum(['breakfast', 'lunch', 'dinner']);
export type MealSlot = z.infer<typeof mealSlotSchema>;

export const ingredientUnitSchema = z.enum([
  'g', 'kg', 'ml', 'l', 'pcs', 'piece', 'tbsp', 'tsp', 'cup', 'unknown',
]);

export const ingredientFormSchema = z.enum(['fresh', 'canned', 'frozen', 'dried', 'other']);

export const ingredientSchema = z.object({
  name: z.string().min(1),
  raw: z.string().optional(),
  quantity: z.number().positive().optional(),
  unit: ingredientUnitSchema.optional(),
  brand: z.string().min(1).optional(),
  form: ingredientFormSchema.optional(),
  fatPercent: z.number().nonnegative().optional(),
  modifiers: z.array(z.string()).default([]),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const recipeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  servings: z.number().positive(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(z.string().min(1)),
  notes: z.string().optional(),
  tags: z.array(z.string()).default([]),
  suitableMealSlots: z.array(mealSlotSchema).default([]),
  sourceUrl: z.string().url().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Recipe = z.infer<typeof recipeSchema>;

export const recipeInputSchema = recipeSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type RecipeInput = z.infer<typeof recipeInputSchema>;

export const importRecipeResultSchema = z.object({
  title: z.string().optional(),
  servings: z.number().positive().optional(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(z.string().min(1)),
  sourceUrl: z.string().url(),
  confidence: z.enum(['high', 'medium', 'low']),
  warnings: z.array(z.string()),
});
export type ImportRecipeResult = z.infer<typeof importRecipeResultSchema>;

export const mealPlanEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: mealSlotSchema,
  recipeId: z.string().min(1),
  servings: z.number().positive(),
});
export type MealPlanEntry = z.infer<typeof mealPlanEntrySchema>;

export const mealPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  entries: z.array(mealPlanEntrySchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type MealPlan = z.infer<typeof mealPlanSchema>;

export const mealPlanInputSchema = mealPlanSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type MealPlanInput = z.infer<typeof mealPlanInputSchema>;

export const mealSuggestionSchema = z.object({
  date: z.string(),
  slot: mealSlotSchema,
  recipeId: z.string(),
  servings: z.number().positive(),
  reason: z.string().min(1),
});
export type MealSuggestion = z.infer<typeof mealSuggestionSchema>;
export const mealSuggestionsSchema = z.object({ suggestions: z.array(mealSuggestionSchema) });
export type MealSuggestions = z.infer<typeof mealSuggestionsSchema>;

export const priceBasisSchema = z.enum(['package', 'kg', 'l', 'item']);
export type PriceBasis = z.infer<typeof priceBasisSchema>;
export const packageUnitSchema = z.enum(['g', 'kg', 'ml', 'l', 'pcs']);
export type PackageUnit = z.infer<typeof packageUnitSchema>;

export const productOfferSchema = z.object({
  id: z.string().min(1),
  storeId: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().optional(),
  packageQuantity: z.number().positive().optional(),
  packageUnit: packageUnitSchema.optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  priceBasis: priceBasisSchema.optional(),
  priceBasisAssumed: z.boolean().optional(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  provenance: z.enum(['live', 'cached', 'demo']),
  productUrl: z.string().url(),
  fetchedAt: z.string().optional(),
});
export type ProductOffer = z.infer<typeof productOfferSchema>;

export const shoppingLineSchema = z.object({
  id: z.string(),
  ingredient: ingredientSchema,
  requiredQuantity: z.number().positive().optional(),
  requiredUnit: ingredientUnitSchema.optional(),
  semanticKey: z.string(),
  offers: z.array(productOfferSchema),
  recommendedOfferId: z.string().optional(),
  selectedOfferId: z.string().optional(),
  included: z.boolean(),
});
export type ShoppingLine = z.infer<typeof shoppingLineSchema>;

export const offerAssessmentSchema = z.object({
  offerId: z.string(),
  group: z.enum(['exact-brand', 'alternative']),
  status: z.enum(['complete', 'incomplete']),
  reason: z.string().optional(),
  packagesNeeded: z.number().positive().optional(),
  purchasedQuantity: z.number().positive().optional(),
  excessQuantity: z.number().nonnegative().optional(),
  purchaseCost: z.number().nonnegative().optional(),
  normalizedUnitPrice: z.number().nonnegative().optional(),
});
export type OfferAssessment = z.infer<typeof offerAssessmentSchema>;

export const storeSubtotalSchema = z.object({
  storeId: z.string(),
  currency: z.string().optional(),
  total: z.number().nonnegative().optional(),
  status: z.enum(['complete', 'incomplete']),
  includedLineCount: z.number().int().nonnegative(),
  incompleteLineCount: z.number().int().nonnegative(),
});
export type StoreSubtotal = z.infer<typeof storeSubtotalSchema>;

export const shoppingComparisonSchema = z.object({
  id: z.string(),
  mealPlanId: z.string(),
  lines: z.array(shoppingLineSchema),
  assessments: z.array(offerAssessmentSchema),
  subtotals: z.array(storeSubtotalSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type ShoppingComparison = z.infer<typeof shoppingComparisonSchema>;

export const storeSettingSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  priority: z.number().int(),
  location: z.string(),
  lastLiveCheckAt: z.string().optional(),
  lastLiveCheckStatus: z.enum(['passed', 'failed', 'not-run']).default('not-run'),
});
export type StoreSetting = z.infer<typeof storeSettingSchema>;

export const domainErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
