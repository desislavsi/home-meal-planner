import { useEffect, useMemo, useState } from 'react';
import type { Ingredient, MealPlan, MealPlanEntry, MealSlot, MealSuggestions, Recipe, RecipeInput, ShoppingComparison, StoreSetting } from '@home-meal-planner/contracts';
import { api, ApiError } from './api';
import { groupMealEntriesByDay } from './planner';
import { sortRecipesForMeal } from './recipe-order';
import { ShoppingPage } from './ShoppingPage';
import { restoreShoppingComparison } from './shopping';
import { ActivityIndicator, BusyButton } from './busy';

type View = 'dashboard' | 'recipes' | 'planner' | 'shopping' | 'settings';
type BusyOperation = 'creating-plan' | 'comparing-stores' | 'suggesting-meals' | 'applying-suggestions';
const today = new Date().toISOString().slice(0, 10);
const PLAN_STORAGE_KEY = 'home-meal-planner-active-plan';
const COMPARISON_STORAGE_KEY = 'home-meal-planner-active-comparison';
const plusDays = (date: string, days: number) => { const value = new Date(`${date}T12:00:00`); value.setDate(value.getDate() + days); return value.toISOString().slice(0, 10); };
const formatPlanDay = (date: string) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${date}T12:00:00`));

function Login({ onLogin }: { onLogin: () => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }); await onLogin(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  return <main className="login-shell"><div className="login-card"><div className="eyebrow">PRIVATE HOUSEHOLD APP</div><h1>What shall we cook?</h1><p className="muted">A calm place for recipes, weekly plans, and a smarter shopping list.</p><form onSubmit={submit}><label>Household password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus disabled={busy} /></label>{error && <div className="error">{error}</div>}<BusyButton className="primary" type="submit" label="Enter planner" busyLabel="Signing in…" busy={busy} /></form></div></main>;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState<boolean | undefined>();
  const [view, setView] = useState<View>('dashboard');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [plan, setPlan] = useState<MealPlan>();
  const [comparison, setComparison] = useState<ShoppingComparison>();
  const [suggestions, setSuggestions] = useState<MealSuggestions>();
  const [stores, setStores] = useState<StoreSetting[]>([]);
  const [notice, setNotice] = useState('');
  const [busyOperation, setBusyOperation] = useState<BusyOperation | null>(null);
  const load = async () => {
    const session = await api<{ authenticated: boolean }>('/api/auth/session');
    setAuthenticated(session.authenticated);
    if (!session.authenticated) return;
    const [recipeData, storeData] = await Promise.all([api<Recipe[]>('/api/recipes'), api<StoreSetting[]>('/api/settings/stores')]);
    setRecipes(recipeData); setStores(storeData);
    const savedPlanId = window.localStorage.getItem(PLAN_STORAGE_KEY);
    if (!savedPlanId) return;
    try { setPlan(await api<MealPlan>(`/api/meal-plans/${savedPlanId}`)); }
    catch { window.localStorage.removeItem(PLAN_STORAGE_KEY); setPlan(undefined); setComparison(undefined); return; }
    const savedComparisonId = window.localStorage.getItem(COMPARISON_STORAGE_KEY);
    if (savedComparisonId) {
      try {
        const restored = await restoreShoppingComparison(savedPlanId, savedComparisonId, (id) => api<ShoppingComparison>(`/api/shopping-comparisons/${id}`));
        setComparison(restored);
        if (!restored) window.localStorage.removeItem(COMPARISON_STORAGE_KEY);
      } catch { window.localStorage.removeItem(COMPARISON_STORAGE_KEY); setComparison(undefined); }
    }
  };
  useEffect(() => { load().catch((error) => setNotice(error instanceof Error ? error.message : String(error))); }, []);
  useEffect(() => { setSuggestions(undefined); }, [plan?.updatedAt]);
  useEffect(() => { if (comparison) window.localStorage.setItem(COMPARISON_STORAGE_KEY, comparison.id); }, [comparison]);
  useEffect(() => {
    if (plan && comparison && comparison.mealPlanId !== plan.id) {
      setComparison(undefined); window.localStorage.removeItem(COMPARISON_STORAGE_KEY);
    }
  }, [plan?.id, comparison?.mealPlanId]);
  if (authenticated === undefined) return <div className="loading"><ActivityIndicator label="Loading your kitchen…" /></div>;
  if (!authenticated) return <Login onLogin={async () => { setAuthenticated(true); await load(); }} />;
  const logout = async () => { await api('/api/auth/logout', { method: 'POST' }); setAuthenticated(false); };
  const runOperation = async (operation: BusyOperation, action: () => Promise<void>) => { if (busyOperation) return; setBusyOperation(operation); try { await action(); } finally { setBusyOperation(null); } };
  const createStarterPlan = async () => { await runOperation('creating-plan', async () => { const recipe = recipes[0]; if (!recipe) throw new Error('Add a recipe first.'); const created = await api<MealPlan>('/api/meal-plans', { method: 'POST', body: JSON.stringify({ name: 'This week at home', startDate: today, endDate: plusDays(today, 6), entries: [{ id: crypto.randomUUID(), date: today, slot: 'dinner', recipeId: recipe.id, servings: recipe.servings }] }) }); window.localStorage.setItem(PLAN_STORAGE_KEY, created.id); setPlan(created); setView('planner'); setNotice('Starter meal plan created.'); }); };
  const compare = async () => { await runOperation('comparing-stores', async () => { if (!plan) throw new Error('Create a meal plan first.'); const result = await api<ShoppingComparison>(`/api/meal-plans/${plan.id}/shopping/compare`, { method: 'POST' }); setComparison(result); setView('shopping'); setNotice('Comparison refreshed. Review the source and timestamp on every offer.'); }); };
  const suggest = async () => { await runOperation('suggesting-meals', async () => { if (!plan) throw new Error('Create a meal plan first.'); const result = await api<MealSuggestions>(`/api/meal-plans/${plan.id}/suggest`, { method: 'POST' }); setSuggestions(result); setNotice(result.suggestions.length ? `Review ${result.suggestions.length} suggested meal${result.suggestions.length === 1 ? '' : 's'} before applying.` : 'There are no empty meal slots to fill.'); }); };
  const applySuggestions = async () => { await runOperation('applying-suggestions', async () => { if (!plan || !suggestions) return; const updated = await api<MealPlan>(`/api/meal-plans/${plan.id}/suggestions/apply`, { method: 'POST', body: JSON.stringify({ suggestions: suggestions.suggestions }) }); setPlan(updated); setSuggestions(undefined); setNotice('Suggested meals added to the open slots.'); }); };
  const handleError = (error: unknown) => { if (error instanceof ApiError && error.status === 401) { setAuthenticated(false); setNotice('Your local session expired. Please sign in again.'); return; } if (error instanceof ApiError && error.status === 404 && error.message === 'Meal plan not found.') { window.localStorage.removeItem(PLAN_STORAGE_KEY); setPlan(undefined); setComparison(undefined); setView('planner'); setNotice('The saved meal plan was unavailable. Please create it again.'); return; } setNotice(error instanceof Error ? error.message : String(error)); };
  return <div className="app-shell"><aside className="sidebar"><div className="brand-mark">HM</div><div className="brand-copy"><strong>Home Meal Planner</strong><span>for our kitchen</span></div><nav>{([['dashboard', 'Overview'], ['recipes', 'Recipes'], ['planner', 'Meal plan'], ['shopping', 'Shopping'], ['settings', 'Settings']] as [View, string][]).map(([key, label]) => <button key={key} className={view === key ? 'nav-item active' : 'nav-item'} onClick={() => setView(key)}>{label}</button>)}</nav><button className="logout" onClick={logout}>Lock app</button></aside><main className="content"><header className="topbar"><div><div className="eyebrow">PRIVATE / SOFIA</div><h2>{view === 'dashboard' ? 'Good food starts with a little planning.' : view === 'recipes' ? 'Recipes' : view === 'planner' ? 'Meal plan' : view === 'shopping' ? 'Shopping comparison' : 'Household settings'}</h2></div><span className="status-pill"><span className="status-dot" />Local and private</span></header>{notice && <div className="notice" onClick={() => setNotice('')}>{notice}</div>}{busyOperation && <div className="operation-status"><ActivityIndicator label={busyOperation === 'suggesting-meals' ? 'Gemma is thinking…' : busyOperation === 'comparing-stores' ? 'Comparing live stores…' : busyOperation === 'applying-suggestions' ? 'Applying meal suggestions…' : 'Creating your meal plan…'} /></div>}{view === 'dashboard' && <Dashboard recipes={recipes} plan={plan} stores={stores} onCreatePlan={createStarterPlan} onGo={(next) => setView(next)} onError={handleError} />}{view === 'recipes' && <Recipes recipes={recipes} setRecipes={setRecipes} onRecipeDeleted={(recipeId, removedPlannedMeals) => { setPlan((current) => current ? { ...current, entries: current.entries.filter((entry) => entry.recipeId !== recipeId), updatedAt: new Date().toISOString() } : current); setNotice(`Recipe deleted.${removedPlannedMeals ? ` Removed ${removedPlannedMeals} planned meal${removedPlannedMeals === 1 ? '' : 's'}.` : ''}`); }} onError={handleError} />}{view === 'planner' && <Planner recipes={recipes} plan={plan} setPlan={setPlan} suggestions={suggestions} onCreatePlan={createStarterPlan} onSuggest={suggest} onApplySuggestions={applySuggestions} onDiscardSuggestions={() => setSuggestions(undefined)} onCompare={compare} onError={handleError} />}{view === 'shopping' && <ShoppingPage comparison={comparison} setComparison={setComparison} onRefresh={compare} onError={handleError} />}{view === 'settings' && <Settings stores={stores} setStores={setStores} onError={handleError} />}</main></div>;
}

function Dashboard({ recipes, plan, stores, onCreatePlan, onGo, onError }: { recipes: Recipe[]; plan?: MealPlan; stores: StoreSetting[]; onCreatePlan: () => Promise<void>; onGo: (view: View) => void; onError: (error: unknown) => void }) {
  return <section className="dashboard"><div className="hero-card"><div><div className="eyebrow">THE WEEK AHEAD</div><h1>Make the grocery run feel lighter.</h1><p>Keep the recipes that matter, plan meals around real life, and compare what you actually need to buy.</p><button className="primary" onClick={() => onCreatePlan().catch(onError)}>{plan ? 'Start another plan' : 'Create a starter plan'}</button></div><div className="hero-art"><span>🥕</span><span>🍅</span><span>🥖</span><span>🌿</span></div></div><div className="stat-grid"><button className="stat-card" onClick={() => onGo('recipes')}><span>Saved recipes</span><strong>{recipes.length}</strong><small>Add a favorite or import one from the web.</small></button><button className="stat-card" onClick={() => onGo('planner')}><span>Current plan</span><strong>{plan ? plan.entries.length : 0}</strong><small>{plan ? plan.name : 'No meals planned yet.'}</small></button><button className="stat-card" onClick={() => onGo('settings')}><span>Store sources</span><strong>{stores.filter((store) => store.enabled).length}</strong><small>Choose which shops to search.</small></button></div><div className="feature-grid"><div className="soft-card"><div className="icon-chip">AI</div><h3>Suggestions stay grounded</h3><p>Gemma can suggest meals from your saved recipe collection; the app checks every recipe ID before saving anything.</p></div><div className="soft-card"><div className="icon-chip">€</div><h3>Prices stay transparent</h3><p>See package cost, unit price, quantity purchased, and whether the data is live, cached, or demo.</p></div></div></section>;
}

function IngredientEditor({ ingredients, setIngredients }: { ingredients: Ingredient[]; setIngredients: (value: Ingredient[]) => void }) {
  const update = (index: number, patch: Partial<Ingredient>) => setIngredients(ingredients.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  return <div className="ingredient-editor">{ingredients.map((ingredient, index) => <div className="ingredient-row" key={index}><input value={ingredient.name} onChange={(event) => update(index, { name: event.target.value })} placeholder="Ingredient" /><input className="quantity-input" type="number" value={ingredient.quantity ?? ''} onChange={(event) => update(index, { quantity: event.target.value ? Number(event.target.value) : undefined })} placeholder="Qty" /><input className="unit-input" value={ingredient.unit ?? ''} onChange={(event) => update(index, { unit: event.target.value as Ingredient['unit'] })} placeholder="Unit" /><input value={ingredient.brand ?? ''} onChange={(event) => update(index, { brand: event.target.value || undefined })} placeholder="Brand (optional)" /><button type="button" className="icon-button" aria-label={`Remove ${ingredient.name || 'ingredient'}`} onClick={() => setIngredients(ingredients.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}<button type="button" className="text-button" onClick={() => setIngredients([...ingredients, { name: '', quantity: undefined, modifiers: [] }])}>+ Add ingredient</button></div>;
}

function Recipes({ recipes, setRecipes, onRecipeDeleted, onError }: { recipes: Recipe[]; setRecipes: (recipes: Recipe[]) => void; onRecipeDeleted: (recipeId: string, removedPlannedMeals: number) => void; onError: (error: unknown) => void }) {
  const [selected, setSelected] = useState<Recipe>();
  const [title, setTitle] = useState('');
  const [servings, setServings] = useState(2);
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', quantity: undefined, modifiers: [] }]);
  const [instructions, setInstructions] = useState('');
  const [url, setUrl] = useState('');
  const [importWarning, setImportWarning] = useState('');
  const [suitableMealSlots, setSuitableMealSlots] = useState<MealSlot[]>([]);
  const [busyOperation, setBusyOperation] = useState<'saving-recipe' | 'importing-recipe' | 'deleting-recipe' | null>(null);
  const mealLabels: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

  const reset = () => { setSelected(undefined); setTitle(''); setServings(2); setIngredients([{ name: '', quantity: undefined, modifiers: [] }]); setInstructions(''); setUrl(''); setImportWarning(''); setSuitableMealSlots([]); };
  const edit = (recipe: Recipe) => { setSelected(recipe); setTitle(recipe.title); setServings(recipe.servings); setIngredients(recipe.ingredients); setInstructions(recipe.instructions.join('\n')); setUrl(recipe.sourceUrl ?? ''); setSuitableMealSlots(recipe.suitableMealSlots); };
  const deleteRecipe = async (recipe: Recipe) => {
    if (!window.confirm(`Delete “${recipe.title}”? Any planned meals using it will also be removed. This cannot be undone.`)) return;
    setBusyOperation('deleting-recipe');
    try {
      const result = await api<{ deleted: boolean; removedPlannedMeals: number }>(`/api/recipes/${recipe.id}`, { method: 'DELETE' });
      setRecipes(recipes.filter((item) => item.id !== recipe.id));
      if (selected?.id === recipe.id) reset();
      onRecipeDeleted(recipe.id, result.removedPlannedMeals);
    } catch (error) { onError(error); } finally { setBusyOperation(null); }
  };
  const toggleMealSlot = (slot: MealSlot) => setSuitableMealSlots((current) => current.includes(slot) ? current.filter((item) => item !== slot) : [...current, slot]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busyOperation) return;
    setBusyOperation('saving-recipe');
    setImportWarning('Saving recipe…');
    try {
      const input: RecipeInput = { title, servings, ingredients: ingredients.filter((item) => item.name.trim()), instructions: instructions.split('\n').map((line) => line.trim()).filter(Boolean), tags: selected?.tags ?? [], suitableMealSlots, notes: selected?.notes, sourceUrl: url || undefined };
      const recipe = selected ? await api<Recipe>(`/api/recipes/${selected.id}`, { method: 'PATCH', body: JSON.stringify(input) }) : await api<Recipe>('/api/recipes', { method: 'POST', body: JSON.stringify(input) });
      setRecipes(selected ? recipes.map((item) => item.id === recipe.id ? recipe : item) : [...recipes, recipe]);
      reset();
    } catch (error) { setImportWarning(''); onError(error); } finally { setBusyOperation(null); }
  };
  const importUrl = async () => {
    if (busyOperation) return;
    setBusyOperation('importing-recipe');
    setImportWarning('Importing recipe…');
    try {
      const result = await api<{ title?: string; servings?: number; ingredients: Ingredient[]; instructions: string[]; warnings: string[] }>('/api/recipes/import', { method: 'POST', body: JSON.stringify({ url }) });
      setTitle(result.title ?? ''); setServings(result.servings ?? 2); setIngredients(result.ingredients.length ? result.ingredients : [{ name: '', quantity: undefined, modifiers: [] }]); setInstructions(result.instructions.join('\n')); setImportWarning(result.warnings.join(' ')); setSuitableMealSlots([]);
    } catch (error) { setImportWarning(''); onError(error); } finally { setBusyOperation(null); }
  };
  return <section className="two-column"><div className="panel"><div className="section-heading"><div><div className="eyebrow">YOUR COLLECTION</div><h3>Recipes that make home feel like home.</h3></div><button type="button" className="secondary" onClick={reset}>New recipe</button></div><RecipeList recipes={recipes} selectedId={selected?.id} disabled={busyOperation !== null} onSelect={edit} onDelete={(recipe) => deleteRecipe(recipe)} /></div><form className="panel form-panel" onSubmit={save}><div className="eyebrow">{selected ? 'EDIT RECIPE' : 'NEW RECIPE'}</div><h3>{selected ? 'Tune the details' : 'Add something delicious'}</h3><div className="form-grid"><label className="wide">Recipe name<input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="e.g. Sunday tomato pasta" /></label><label>Servings<input type="number" min="1" value={servings} onChange={(event) => setServings(Number(event.target.value))} /></label><label className="wide">Recipe URL <div className="input-action"><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="Paste a Recipe JSON-LD page" /><button type="button" className="secondary compact" onClick={importUrl} disabled={!url}>Import</button></div></label></div>{importWarning && <div className="warning">{importWarning}</div>}<fieldset className="recipe-suitability"><legend>Suitable for meals</legend><div className="meal-slot-options">{(['breakfast', 'lunch', 'dinner'] as MealSlot[]).map((slot) => <label className="meal-slot-option" key={slot}><input type="checkbox" checked={suitableMealSlots.includes(slot)} onChange={() => toggleMealSlot(slot)} /><span>{mealLabels[slot]}</span></label>)}</div><small className="muted">Optional. Using this recipe for a meal will add that slot automatically.</small></fieldset><label>Ingredients</label><IngredientEditor ingredients={ingredients} setIngredients={setIngredients} /><label>Instructions <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="One step per line" rows={5} /></label><div className="form-actions"><button type="button" className="secondary" onClick={reset}>Clear</button><button className="primary" type="submit">{selected ? 'Save changes' : 'Save recipe'}</button></div></form></section>;
}

function RecipeList({ recipes, selectedId, disabled, onSelect, onDelete }: { recipes: Recipe[]; selectedId?: string; disabled: boolean; onSelect: (recipe: Recipe) => void; onDelete: (recipe: Recipe) => void }) {
  return <>{recipes.map((recipe) => <div className="recipe-list-row" key={recipe.id}><button type="button" className={`recipe-list-item ${selectedId === recipe.id ? 'selected' : ''}`} onClick={() => onSelect(recipe)}><span className="recipe-emoji">{recipe.tags.includes('vegetarian') ? '🥬' : '🍲'}</span><span><strong>{recipe.title}</strong><small>{recipe.ingredients.length} ingredients · {recipe.servings} servings</small></span><span className="arrow">→</span></button><button type="button" className="recipe-delete" onClick={() => onDelete(recipe)} disabled={disabled} aria-label={`Delete ${recipe.title}`}>Delete</button></div>)}</>;
}

function Planner({ recipes, plan, setPlan, suggestions, onCreatePlan, onSuggest, onApplySuggestions, onDiscardSuggestions, onCompare, onError }: { recipes: Recipe[]; plan?: MealPlan; setPlan: (plan: MealPlan) => void; suggestions?: MealSuggestions; onCreatePlan: () => Promise<void>; onSuggest: () => Promise<void>; onApplySuggestions: () => Promise<void>; onDiscardSuggestions: () => void; onCompare: () => Promise<void>; onError: (error: unknown) => void }) {
  const [newDate, setNewDate] = useState(plan?.startDate ?? today);
  const [newSlot, setNewSlot] = useState<MealSlot>('dinner');
  const [newRecipeId, setNewRecipeId] = useState(recipes[0]?.id ?? '');
  const [newServings, setNewServings] = useState(recipes[0]?.servings ?? 2);
  const [rangeStart, setRangeStart] = useState(plan?.startDate ?? today);
  const [rangeEnd, setRangeEnd] = useState(plan?.endDate ?? plusDays(today, 6));
  const slots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];
  const newRecipeOptions = useMemo(() => sortRecipesForMeal(recipes, newSlot), [recipes, newSlot]);

  useEffect(() => {
    if (plan) { setRangeStart(plan.startDate); setRangeEnd(plan.endDate); }
  }, [plan?.id, plan?.startDate, plan?.endDate]);

  useEffect(() => {
    if (!recipes.some((recipe) => recipe.id === newRecipeId)) {
      const firstRecipe = recipes[0];
      if (firstRecipe) { setNewRecipeId(firstRecipe.id); setNewServings(firstRecipe.servings); }
    }
  }, [recipes, newRecipeId]);

  const saveRange = async () => {
    if (!plan) return;
    if (rangeStart > rangeEnd) { onError(new Error('The plan start date must be on or before its end date.')); return; }
    try {
      const updated = await api<MealPlan>(`/api/meal-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ startDate: rangeStart, endDate: rangeEnd }) });
      setPlan(updated);
    } catch (error) { onError(error); }
  };

  const addEntry = async () => {
    if (!plan) return onCreatePlan();
    const recipe = recipes.find((item) => item.id === newRecipeId);
    if (!recipe) throw new Error('Choose a saved recipe first.');
    try {
      const entries = [...plan.entries, { id: crypto.randomUUID(), date: newDate, slot: newSlot, recipeId: recipe.id, servings: Number(newServings) }];
      const updated = await api<MealPlan>(`/api/meal-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ startDate: newDate < plan.startDate ? newDate : plan.startDate, endDate: newDate > plan.endDate ? newDate : plan.endDate, entries }) });
      setPlan(updated);
    } catch (error) { onError(error); }
  };

  const updateEntry = async (entryId: string, patch: Partial<MealPlanEntry>) => {
    if (!plan) return;
    try {
      const entries = plan.entries.map((entry) => entry.id === entryId ? { ...entry, ...patch } : entry);
      let startDate = plan.startDate;
      let endDate = plan.endDate;
      for (const entry of entries) { if (entry.date < startDate) startDate = entry.date; if (entry.date > endDate) endDate = entry.date; }
      const updated = await api<MealPlan>(`/api/meal-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ startDate, endDate, entries }) });
      setPlan(updated);
    } catch (error) { onError(error); }
  };

  const removeEntry = async (entryId: string) => {
    if (!plan) return;
    try {
      const updated = await api<MealPlan>(`/api/meal-plans/${plan.id}`, { method: 'PATCH', body: JSON.stringify({ entries: plan.entries.filter((entry) => entry.id !== entryId) }) });
      setPlan(updated);
    } catch (error) { onError(error); }
  };

  const entriesByDay = useMemo(() => groupMealEntriesByDay(plan?.entries ?? []), [plan?.entries]);

  const renderEntryCard = (entry: MealPlanEntry) => {
    const recipe = recipes.find((item) => item.id === entry.recipeId);
    return <div className="plan-card" key={entry.id}><div className="entry-controls"><label>Date<input type="date" value={entry.date} onChange={(event) => updateEntry(entry.id, { date: event.target.value })} /></label><label>Meal<select value={entry.slot} onChange={(event) => updateEntry(entry.id, { slot: event.target.value as MealSlot })}>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label><label>Recipe<select value={entry.recipeId} onChange={(event) => updateEntry(entry.id, { recipeId: event.target.value })}>{sortRecipesForMeal(recipes, entry.slot).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Servings<input type="number" min="1" value={entry.servings} onChange={(event) => updateEntry(entry.id, { servings: Number(event.target.value) })} /></label></div><h4>{recipe?.title ?? 'Missing recipe'}</h4><p>{entry.servings} servings · {entry.slot}</p><button type="button" className="meal-remove" onClick={() => removeEntry(entry.id)}>Remove meal</button></div>;
  };

  if (!plan) return <section className="empty-state"><div className="empty-icon">🗓️</div><h3>Your week is still open.</h3><p>Create a starter plan to connect recipes to your shopping list.</p><button className="primary" onClick={() => onCreatePlan().catch(onError)}>Create starter plan</button></section>;
  const suggestionPreview = suggestions?.suggestions.length ? <div className="suggestion-preview"><div className="section-heading"><div><div className="eyebrow">REVIEW SUGGESTIONS</div><h3>{suggestions.suggestions.length} open meal slots</h3></div><button className="secondary" onClick={onDiscardSuggestions}>Discard</button></div><div className="suggestion-list">{suggestions.suggestions.map((suggestion) => <div className="suggestion-row" key={`${suggestion.date}-${suggestion.slot}`}><div><strong>{suggestion.date} · {suggestion.slot}</strong><span>{recipes.find((recipe) => recipe.id === suggestion.recipeId)?.title ?? suggestion.recipeId}</span></div><small>{suggestion.servings} servings · {suggestion.reason}</small></div>)}</div><button className="primary" onClick={() => onApplySuggestions().catch(onError)}>Apply suggestions</button></div> : null;
  return <section><div className="section-heading"><div><div className="eyebrow">{plan.startDate} — {plan.endDate}</div><h3>{plan.name}</h3></div><div className="button-row"><button className="secondary" onClick={() => onSuggest().catch(onError)}>Suggest meals</button><button className="primary" onClick={() => onCompare().catch(onError)}>Compare shopping</button></div></div><div className="meal-entry-form"><div><div className="eyebrow">PLAN RANGE</div><strong>Choose the dates this plan covers.</strong></div><div className="range-form"><label>Plan starts<input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} /></label><label>Plan ends<input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} /></label><button className="secondary" onClick={() => saveRange().catch(onError)}>Update range</button></div><div><div className="eyebrow">ADD A MEAL</div><strong>Choose the recipe and slot for your plan.</strong></div><div className="entry-form-grid"><label>Date<input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /></label><label>Meal<select value={newSlot} onChange={(event) => setNewSlot(event.target.value as MealSlot)}>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label><label>Recipe<select value={newRecipeId} onChange={(event) => { const recipe = recipes.find((item) => item.id === event.target.value); setNewRecipeId(event.target.value); if (recipe) setNewServings(recipe.servings); }}>{newRecipeOptions.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.title}</option>)}</select></label><label>Servings<input type="number" min="1" value={newServings} onChange={(event) => setNewServings(Number(event.target.value))} /></label></div><button className="primary" onClick={() => addEntry().catch(onError)} disabled={!recipes.length}>Add meal</button></div>{suggestionPreview}<div className="day-groups">{entriesByDay.map(([date, entries]) => <section className="day-group" key={date}><div className="day-group-header"><div><span className="eyebrow">{date === today ? 'TODAY' : 'PLANNED DAY'}</span><h4>{formatPlanDay(date)}</h4></div><span className="day-meal-count">{entries.length} {entries.length === 1 ? 'meal' : 'meals'}</span></div><div className="day-meals">{entries.map(renderEntryCard)}</div></section>)}</div></section>;
}

function Settings({ stores, setStores, onError }: { stores: StoreSetting[]; setStores: (stores: StoreSetting[]) => void; onError: (error: unknown) => void }) {
  const toggle = async (store: StoreSetting) => { try { const next = await api<StoreSetting>(`/api/settings/stores/${store.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !store.enabled }) }); setStores(stores.map((item) => item.id === next.id ? next : item)); } catch (error) { onError(error); } };
  return <section className="narrow"><div className="eyebrow">HOUSEHOLD CONFIGURATION</div><h3>Choose which stores to search.</h3><p className="muted">The app opens public product pages only. It never signs in or edits a store basket.</p>{stores.map((store) => <div className="setting-row" key={store.id}><div><strong>{store.name}</strong><small>{store.location} · live check: {store.lastLiveCheckStatus}</small></div><button className={store.enabled ? 'toggle on' : 'toggle'} onClick={() => toggle(store)}><span />{store.enabled ? 'Enabled' : 'Disabled'}</button></div>)}<div className="info-card"><strong>Local model</strong><span>Ollama · gemma4:e4b</span><small>Credentials and model configuration stay on the API server.</small></div></section>;
}
