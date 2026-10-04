# Home Meal Planner demo script

Target length: 2–3 minutes.

## Before recording

- Start Ollama with `gemma4:e4b` available.
- Set `AI_MODE=live` and `STORE_MODE=live`.
- Enable only VMV and Randi in household settings.
- Start the app with `npm run dev`.
- Have one simple recipe ready, or import one with JSON-LD.
- Close unrelated windows and do not show `.env`, passwords, or browser credentials.

## Recording sequence

### 1. Introduce the problem — 15 seconds

“I built Home Meal Planner for a friend who wants to turn recipes into a realistic grocery run without manually rebuilding the shopping list every week.”

### 2. Show the private app — 10 seconds

- Open `http://localhost:5173`.
- Enter the household password.
- Briefly show the local/private indicator.

### 3. Add a recipe — 25 seconds

- Open **Recipes**.
- Either import a public recipe URL or enter a recipe manually.
- Show ingredients, instructions, servings, and meal suitability.
- Save the recipe.

### 4. Plan meals — 25 seconds

- Open **Meal plan**.
- Show the grouped-by-day plan.
- Add one breakfast, lunch, or dinner entry.
- Click **Suggest meals**.
- Show the preview and explain that it only uses saved recipe IDs.
- Apply the suggestions.

### 5. Compare live stores — 35 seconds

- Click **Compare shopping**.
- Point out that ingredient quantities come from the meal plan.
- Show VMV and Randi offers with live provenance, timestamps, package sizes, and availability.
- Highlight one package calculation, for example required quantity, packs needed, purchased quantity, excess, and total price.

### 6. Choose products — 20 seconds

- Select one offer per ingredient.
- Exclude one ingredient to show the list and subtotal update.
- Re-select it and show the corrected subtotal.
- Show the links grouped by store.

### 7. Explain the AI boundary — 20 seconds

“Gemma suggests meals locally through Ollama and Mastra. The application—not the model—validates recipe IDs, dates, ingredients, units, package counts, prices, and store links.”

### 8. Close with the scope — 10 seconds

“The app never logs into stores or checks out. It gives the friend a transparent, reviewable list of links, while fixture mode keeps tests and offline demos deterministic.”

## If live stores fail during recording

Stop and fix the live configuration before presenting the result as live. If the competition deadline makes that impossible, switch to fixture mode and label every offer as demo data in the narration and submission post. Do not describe fixture results as current store prices.

