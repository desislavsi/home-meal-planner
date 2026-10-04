import { afterEach, describe, expect, it, vi } from 'vitest';
import { importRecipeFromUrl } from './recipe-import.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('recipe importer preparation handling', () => {
  it('keeps preparation instructions as modifiers instead of part of the ingredient name', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Cucumber salad',
        recipeIngredient: ['1 cucumber (cut lengthwise, seeded, and sliced 1/4-inch thick)'],
        recipeInstructions: ['Slice the cucumber.'],
      })}</script>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));

    const result = await importRecipeFromUrl('https://example.com/cucumber-salad');

    expect(result.ingredients[0]).toMatchObject({
      name: 'cucumber',
      quantity: 1,
      modifiers: ['cut lengthwise, seeded, and sliced 1/4-inch thick'],
    });
  });

  it('keeps Unicode recipe fractions as structured quantity and unit values', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <script type="application/ld+json">${JSON.stringify({ 
        '@type': 'Recipe',
        name: 'Oil dressing',
        recipeIngredient: ['\u00bc cup extra-virgin olive oil'],
        recipeInstructions: ['Whisk the oil.'],
      })}</script>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));

    const result = await importRecipeFromUrl('https://example.com/oil-dressing');

    expect(result.ingredients[0]).toMatchObject({ name: 'extra-virgin olive oil', quantity: 0.25, unit: 'cup' });
  });
});

describe('recipe importer safety', () => {
  it('rejects local and private URLs before fetching', async () => {
    await expect(importRecipeFromUrl('http://127.0.0.1/recipe')).rejects.toThrow('public HTTP');
    await expect(importRecipeFromUrl('file:///tmp/recipe')).rejects.toThrow('public HTTP');
  });

  it('extracts Bulgarian JSON-LD ingredients and instructions', async () => {
    globalThis.fetch = vi.fn(async () => new Response(`
      <script type="application/ld+json">${JSON.stringify({
        '@type': 'Recipe',
        name: 'Домати с яйца',
        recipeYield: '2 порции',
        recipeIngredient: ['400 г домати консерва', '4 яйца', '3.6% кисело мляко'],
        recipeInstructions: [{ '@type': 'HowToStep', text: 'Нарежете доматите.' }, { '@type': 'HowToStep', text: 'Добавете яйцата.' }],
      })}</script>
    `, { status: 200, headers: { 'content-type': 'text/html' } }));
    const result = await importRecipeFromUrl('https://example.com/recipe');
    expect(result.title).toBe('Домати с яйца');
    expect(result.servings).toBe(2);
    expect(result.ingredients[0]).toMatchObject({ name: 'домати консерва', quantity: 400, unit: 'g', form: 'canned' });
    expect(result.ingredients[2]).toMatchObject({ name: 'кисело мляко', fatPercent: 3.6 });
    expect(result.instructions).toEqual(['Нарежете доматите.', 'Добавете яйцата.']);
  });
});
