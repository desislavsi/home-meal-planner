import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MongoClient, type Collection, type Db } from 'mongodb';
import {
  mealPlanSchema,
  recipeSchema,
  shoppingComparisonSchema,
  storeSettingSchema,
  type MealPlan,
  type MealPlanInput,
  type Recipe,
  type RecipeInput,
  type ShoppingComparison,
  type StoreSetting,
} from '@home-meal-planner/contracts';

export interface Repository {
  listRecipes(): Promise<Recipe[]>
  getRecipe(id: string): Promise<Recipe | undefined>
  createRecipe(input: RecipeInput): Promise<Recipe>
  updateRecipe(id: string, input: Partial<RecipeInput>): Promise<Recipe | undefined>
  deleteRecipe(id: string): Promise<boolean>
  createMealPlan(input: MealPlanInput): Promise<MealPlan>
  listMealPlans(): Promise<MealPlan[]>
  getMealPlan(id: string): Promise<MealPlan | undefined>
  updateMealPlan(id: string, input: Partial<MealPlanInput>): Promise<MealPlan | undefined>
  saveComparison(comparison: ShoppingComparison): Promise<ShoppingComparison>
  getComparison(id: string): Promise<ShoppingComparison | undefined>
  updateComparison(id: string, comparison: ShoppingComparison): Promise<ShoppingComparison>
  listStores(): Promise<StoreSetting[]>
  updateStore(id: string, input: Partial<StoreSetting>): Promise<StoreSetting | undefined>
}

type RepositorySnapshot = {
  recipes: Recipe[]
  plans: MealPlan[]
  comparisons: ShoppingComparison[]
  stores: StoreSetting[]
}

const now = () => new Date().toISOString();

export const defaultStores: StoreSetting[] = [
  { id: 'vmv', name: 'VMV', enabled: true, priority: 1, location: 'Sofia', lastLiveCheckStatus: 'not-run' },
  { id: 'randi', name: 'Randi', enabled: true, priority: 2, location: 'Sofia', lastLiveCheckStatus: 'not-run' },
  { id: 'ebag', name: 'eBag', enabled: false, priority: 3, location: 'Sofia', lastLiveCheckStatus: 'failed' },
  { id: 'kaufland', name: 'Kaufland', enabled: false, priority: 4, location: 'Sofia', lastLiveCheckStatus: 'not-run' },
  { id: 'billa', name: 'BILLA', enabled: false, priority: 5, location: 'Sofia', lastLiveCheckStatus: 'not-run' },
];

const demoRecipe: Recipe = {
  id: 'demo-shakshuka',
  title: 'Бърза шакшука',
  servings: 2,
  ingredients: [
    { name: 'домати', raw: '400 г домати', quantity: 400, unit: 'g', form: 'fresh', modifiers: [] },
    { name: 'лук', raw: '1 глава лук', quantity: 1, unit: 'pcs', form: 'fresh', modifiers: [] },
    { name: 'яйца', raw: '4 яйца', quantity: 4, unit: 'pcs', modifiers: [] },
    { name: 'зехтин', raw: '30 мл зехтин', quantity: 30, unit: 'ml', modifiers: [] },
  ],
  instructions: ['Нарежете зеленчуците.', 'Задушете лука и доматите.', 'Добавете яйцата и гответе до готовност.'],
  tags: ['quick', 'vegetarian'],
  suitableMealSlots: ['breakfast', 'lunch', 'dinner'],
  sourceUrl: undefined,
  createdAt: now(),
  updatedAt: now(),
};

export class MemoryRepository implements Repository {
  protected recipes: Map<string, Recipe>;
  protected plans: Map<string, MealPlan>;
  protected comparisons: Map<string, ShoppingComparison>;
  protected stores: Map<string, StoreSetting>;

  constructor(snapshot?: Partial<RepositorySnapshot>) {
    this.recipes = new Map((snapshot?.recipes ?? [demoRecipe]).map((recipe) => { const parsed = recipeSchema.parse(recipe); return [parsed.id, parsed] as const; }));
    this.plans = new Map((snapshot?.plans ?? []).map((plan) => [plan.id, plan]));
    this.comparisons = new Map((snapshot?.comparisons ?? []).map((comparison) => [comparison.id, comparison]));
    const stores = new Map(defaultStores.map((store) => [store.id, store]));
    for (const store of snapshot?.stores ?? []) stores.set(store.id, store);
    this.stores = stores;
  }

  snapshot(): RepositorySnapshot {
    return {
      recipes: [...this.recipes.values()],
      plans: [...this.plans.values()],
      comparisons: [...this.comparisons.values()],
      stores: [...this.stores.values()],
    };
  }

  async listRecipes() { return [...this.recipes.values()]; }
  async getRecipe(id: string) { return this.recipes.get(id); }
  async createRecipe(input: RecipeInput) {
    const timestamp = now();
    const recipe = recipeSchema.parse({ ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp });
    this.recipes.set(recipe.id, recipe);
    return recipe;
  }
  async updateRecipe(id: string, input: Partial<RecipeInput>) {
    const current = this.recipes.get(id);
    if (!current) return undefined;
    const recipe = recipeSchema.parse({ ...current, ...input, id, updatedAt: now() });
    this.recipes.set(id, recipe);
    return recipe;
  }
  async deleteRecipe(id: string) { return this.recipes.delete(id); }
  async createMealPlan(input: MealPlanInput) {
    const timestamp = now();
    const plan = mealPlanSchema.parse({ ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp });
    this.plans.set(plan.id, plan);
    return plan;
  }
  async listMealPlans() { return [...this.plans.values()]; }
  async getMealPlan(id: string) { return this.plans.get(id); }
  async updateMealPlan(id: string, input: Partial<MealPlanInput>) {
    const current = this.plans.get(id);
    if (!current) return undefined;
    const plan = mealPlanSchema.parse({ ...current, ...input, id, updatedAt: now() });
    this.plans.set(id, plan);
    return plan;
  }
  async saveComparison(comparison: ShoppingComparison) { this.comparisons.set(comparison.id, comparison); return comparison; }
  async getComparison(id: string) { return this.comparisons.get(id); }
  async updateComparison(id: string, comparison: ShoppingComparison) { this.comparisons.set(id, comparison); return comparison; }
  async listStores() { return [...this.stores.values()].sort((a, b) => a.priority - b.priority); }
  async updateStore(id: string, input: Partial<StoreSetting>) {
    const current = this.stores.get(id);
    if (!current) return undefined;
    const store = storeSettingSchema.parse({ ...current, ...input, id });
    this.stores.set(id, store);
    return store;
  }
}

export class FileRepository implements Repository {
  private constructor(private readonly filePath: string, private readonly memory: MemoryRepository) {}

  static async create(filePath: string) {
    let snapshot: Partial<RepositorySnapshot> | undefined;
    try {
      snapshot = JSON.parse(await readFile(filePath, 'utf8')) as Partial<RepositorySnapshot>;
    } catch {
      snapshot = undefined;
    }
    const repository = new FileRepository(filePath, new MemoryRepository(snapshot));
    await repository.persist();
    return repository;
  }

  private async persist() {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.memory.snapshot(), null, 2), 'utf8');
  }

  listRecipes() { return this.memory.listRecipes(); }
  getRecipe(id: string) { return this.memory.getRecipe(id); }
  async createRecipe(input: RecipeInput) { const value = await this.memory.createRecipe(input); await this.persist(); return value; }
  async updateRecipe(id: string, input: Partial<RecipeInput>) { const value = await this.memory.updateRecipe(id, input); if (value) await this.persist(); return value; }
  async deleteRecipe(id: string) { const deleted = await this.memory.deleteRecipe(id); if (deleted) await this.persist(); return deleted; }
  createMealPlan(input: MealPlanInput) { return this.createAndPersist(() => this.memory.createMealPlan(input)); }
  listMealPlans() { return this.memory.listMealPlans(); }
  getMealPlan(id: string) { return this.memory.getMealPlan(id); }
  async updateMealPlan(id: string, input: Partial<MealPlanInput>) { const value = await this.memory.updateMealPlan(id, input); if (value) await this.persist(); return value; }
  async saveComparison(comparison: ShoppingComparison) { const value = await this.memory.saveComparison(comparison); await this.persist(); return value; }
  getComparison(id: string) { return this.memory.getComparison(id); }
  async updateComparison(id: string, comparison: ShoppingComparison) { const value = await this.memory.updateComparison(id, comparison); await this.persist(); return value; }
  listStores() { return this.memory.listStores(); }
  async updateStore(id: string, input: Partial<StoreSetting>) { const value = await this.memory.updateStore(id, input); if (value) await this.persist(); return value; }

  private async createAndPersist<T>(create: () => Promise<T>) { const value = await create(); await this.persist(); return value; }
}

type StoredDocument = Record<string, unknown>;

export class MongoRepository implements Repository {
  constructor(private readonly db: Db) {}
  private collection<T extends StoredDocument>(name: string): Collection<T> { return this.db.collection<T>(name); }

  async listRecipes() { return (await this.collection<Recipe>('recipes').find({}).toArray()).map((item) => recipeSchema.parse(item)); }
  async getRecipe(id: string) { const item = await this.collection<Recipe>('recipes').findOne({ id }); return item ? recipeSchema.parse(item) : undefined; }
  async createRecipe(input: RecipeInput) {
    const timestamp = now();
    const recipe = recipeSchema.parse({ ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp });
    await this.collection<Recipe>('recipes').insertOne(recipe);
    return recipe;
  }
  async updateRecipe(id: string, input: Partial<RecipeInput>) {
    const current = await this.getRecipe(id);
    if (!current) return undefined;
    const recipe = recipeSchema.parse({ ...current, ...input, id, updatedAt: now() });
    await this.collection<Recipe>('recipes').replaceOne({ id }, recipe);
    return recipe;
  }
  async deleteRecipe(id: string) {
    const result = await this.collection<Recipe>('recipes').deleteOne({ id });
    return result.deletedCount > 0;
  }
  async createMealPlan(input: MealPlanInput) {
    const timestamp = now();
    const plan = mealPlanSchema.parse({ ...input, id: randomUUID(), createdAt: timestamp, updatedAt: timestamp });
    await this.collection<MealPlan>('mealPlans').insertOne(plan);
    return plan;
  }
  async listMealPlans() { return (await this.collection<MealPlan>('mealPlans').find({}).toArray()).map((item) => mealPlanSchema.parse(item)); }
  async getMealPlan(id: string) { const item = await this.collection<MealPlan>('mealPlans').findOne({ id }); return item ? mealPlanSchema.parse(item) : undefined; }
  async updateMealPlan(id: string, input: Partial<MealPlanInput>) {
    const current = await this.getMealPlan(id);
    if (!current) return undefined;
    const plan = mealPlanSchema.parse({ ...current, ...input, id, updatedAt: now() });
    await this.collection<MealPlan>('mealPlans').replaceOne({ id }, plan);
    return plan;
  }
  async saveComparison(comparison: ShoppingComparison) { await this.collection<ShoppingComparison>('shoppingComparisons').replaceOne({ id: comparison.id }, comparison, { upsert: true }); return comparison; }
  async getComparison(id: string) { const item = await this.collection<ShoppingComparison>('shoppingComparisons').findOne({ id }); return item ? shoppingComparisonSchema.parse(item) : undefined; }
  async updateComparison(id: string, comparison: ShoppingComparison) { return this.saveComparison({ ...comparison, id }); }
  async listStores() {
    const found = (await this.collection<StoreSetting>('storeSettings').find({}).toArray()).map((item) => storeSettingSchema.parse(item));
    if (found.length) return found.sort((a, b) => a.priority - b.priority);
    await this.collection<StoreSetting>('storeSettings').insertMany(defaultStores);
    return defaultStores;
  }
  async updateStore(id: string, input: Partial<StoreSetting>) {
    const current = (await this.listStores()).find((item) => item.id === id);
    if (!current) return undefined;
    const store = storeSettingSchema.parse({ ...current, ...input, id });
    await this.collection<StoreSetting>('storeSettings').replaceOne({ id }, store, { upsert: true });
    return store;
  }
}

export async function createRepository(uri?: string, dbName = 'home_meal_planner', localDataFile?: string): Promise<{ repository: Repository; close: () => Promise<void> }> {
  if (!uri) return { repository: await FileRepository.create(localDataFile ?? '.data/home-meal-planner.json'), close: async () => undefined };
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const repository = new MongoRepository(db);
  await repository.listStores();
  return { repository, close: () => client.close() };
}
