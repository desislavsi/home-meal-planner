# Gemma live smoke test

- **Test date:** 2026-10-05 (Europe/Sofia; run at 06:51)
- **Model:** `gemma4:e4b`
- **Command:** `npm run smoke:gemma` (invoked as `npm.cmd run smoke:gemma` on Windows)
- **Result:** PASS — 21 suggestions returned and validated.

Ollama was running locally at `http://127.0.0.1:11434`, and its `/api/tags` endpoint listed `gemma4:e4b`. The smoke script forces live mode and invokes the Mastra agent using Ollama's local OpenAI-compatible endpoint. Its structured response is checked against the Zod schema and the application’s domain rules. This strict smoke path throws on model errors rather than falling back to fixture suggestions.

The test uses synthetic Bulgarian recipe and plan data; no household recipe data is included.

## Successful terminal output

This excerpt is from the actual command output; the two dotenv environment-count diagnostics are omitted.

```text
> home-meal-planner@0.1.0 smoke:gemma
> npm run smoke:gemma -w apps/api


> @home-meal-planner/api@0.1.0 smoke:gemma
> tsx src/smoke-gemma.ts

{
  "pass": true,
  "result": {
    "suggestions": [
      {
        "date": "2099-01-03",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-03",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-03",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-04",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-04",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-04",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-05",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-05",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-05",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-06",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-06",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-06",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-07",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-07",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-07",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-08",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-08",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-08",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      },
      {
        "date": "2099-01-09",
        "slot": "breakfast",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for breakfast; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-09",
        "slot": "lunch",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "No recipes are marked suitable for lunch; selected the lowest-use saved recipe."
      },
      {
        "date": "2099-01-09",
        "slot": "dinner",
        "recipeId": "smoke-recipe",
        "servings": 2,
        "reason": "Българска вечеря (Bulgarian Dinner)"
      }
    ]
  }
}
```
