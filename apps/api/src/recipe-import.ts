import * as cheerio from 'cheerio';
import { importRecipeResultSchema, type ImportRecipeResult, type Ingredient } from '@home-meal-planner/contracts';
import { parseIngredientAmount, stripIngredientAmount, stripIngredientUnit } from './ingredient-quantities.js';

const privateHost = (hostname: string) => {
  const value = hostname.toLowerCase();
  return value === 'localhost' || value === '::1' || value.startsWith('127.') || value.startsWith('10.') || value.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[0-1])\./.test(value);
};

function parseIngredient(raw: string): Ingredient {
  const { quantity, unit } = parseIngredientAmount(raw);
  const form = /\u043a\u043e\u043d\u0441\u0435\u0440\u0432|canned/i.test(raw) ? 'canned' : /\u0437\u0430\u043c\u0440\u0430\u0437|frozen/i.test(raw) ? 'frozen' : /\u0441\u0443\u0448\u0435\u043d|dried/i.test(raw) ? 'dried' : /fresh|\u043f\u0440\u0435\u0441\u0435\u043d|\u043f\u0440\u0435\u0441\u043d\u0438/i.test(raw) ? 'fresh' : undefined;
  const fat = raw.match(/([0-9]+(?:[.,][0-9]+)?)\s*%/);
  const withoutQuantity = stripIngredientAmount(raw);
  const withoutUnit = stripIngredientUnit(withoutQuantity);
  const preparation = withoutUnit.match(/^(.*?)\s*[\[(]([^\])]+)[\])]\s*$/);
  const name = (preparation?.[1] ?? withoutUnit).trim();
  const modifiers = preparation?.[2]?.trim() ? [preparation[2].trim()] : [];
  return { raw, name: name || raw, quantity, unit, form, fatPercent: fat ? Number(fat[1].replace(',', '.')) : undefined, modifiers };
}

function firstRecipeJsonLd($: cheerio.CheerioAPI): Record<string, unknown> | undefined {
  const candidates: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try {
      const parsed = JSON.parse($(element).text());
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else if (parsed?.['@graph'] && Array.isArray(parsed['@graph'])) candidates.push(...parsed['@graph']);
      else candidates.push(parsed);
    } catch { /* ignore malformed JSON-LD */ }
  });
  return candidates.find((item) => {
    const type = (item as Record<string, unknown>)?.['@type'];
    return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'));
  }) as Record<string, unknown> | undefined;
}

export async function importRecipeFromUrl(url: string, enableHtmlFallback = false): Promise<ImportRecipeResult> {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || privateHost(parsed.hostname)) throw new Error('Only public HTTP(S) recipe URLs are allowed.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  let html = '';
  try {
    const response = await fetch(parsed, { signal: controller.signal, headers: { 'User-Agent': 'HomeMealPlanner/0.1 recipe importer' } });
    if (!response.ok) throw new Error(`Recipe page returned HTTP ${response.status}.`);
    html = await response.text();
    if (html.length > 2_000_000) throw new Error('Recipe page is too large to import safely.');
  } finally {
    clearTimeout(timeout);
  }
  const $ = cheerio.load(html);
  const jsonLd = firstRecipeJsonLd($);
  const warnings: string[] = [];
  if (!jsonLd && !enableHtmlFallback) throw new Error('No Recipe JSON-LD was found. Manual entry is required for this page.');
  const title = typeof jsonLd?.name === 'string' ? jsonLd.name : $('h1').first().text().trim() || undefined;
  const rawIngredients = Array.isArray(jsonLd?.recipeIngredient) ? jsonLd.recipeIngredient.filter((item): item is string => typeof item === 'string') : [];
  const instructionsRaw = Array.isArray(jsonLd?.recipeInstructions)
    ? jsonLd.recipeInstructions.map((item) => typeof item === 'string' ? item : typeof item?.text === 'string' ? item.text : '').filter(Boolean)
    : typeof jsonLd?.recipeInstructions === 'string' ? [jsonLd.recipeInstructions] : [];
  if (!rawIngredients.length) warnings.push('No structured ingredients were found.');
  if (!instructionsRaw.length) warnings.push('No structured instructions were found.');
  if (!jsonLd && enableHtmlFallback) warnings.push('Imported using limited HTML fallback; review every field.');
  const servingsRaw = jsonLd?.recipeYield;
  const servings = typeof servingsRaw === 'number' ? servingsRaw : typeof servingsRaw === 'string' ? Number(servingsRaw.match(/[0-9]+(?:[.,][0-9]+)?/)?.[0]?.replace(',', '.')) : undefined;
  return importRecipeResultSchema.parse({ title, servings: servings && servings > 0 ? servings : undefined, ingredients: rawIngredients.map(parseIngredient), instructions: instructionsRaw, sourceUrl: url, confidence: jsonLd ? 'high' : 'low', warnings });
}
