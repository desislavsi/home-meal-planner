# Home Meal Planner

A local household meal planner built for the Hacktoberfest 2026 “Build for a Friend” challenge.

## What works

- Private household login with an HttpOnly session cookie.
- Manual recipe creation and Recipe JSON-LD import.
- Weekly meal planning with Gemma/Mastra suggestions when Ollama is available.
- Deterministic ingredient scaling, semantic consolidation, and package calculations.
- Fixture mode for repeatable testing.
- Live adapter smoke testing for eBag, VMV, and Randi using configurable search URL templates.
- Product selection and store-grouped external links.

## Run locally

1. Install Node 24+ and Ollama. MongoDB Atlas is intentionally outside the competition MVP; the demo uses the local JSON repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Pull the local model:

   ```bash
   ollama pull gemma4:e4b
   ```

4. Create a password hash:

   ```bash
   npm run hash-password -- your-household-password
   ```

5. Copy `.env.example` to `.env` and set `HOUSEHOLD_PASSWORD_HASH` and `SESSION_SECRET`.
6. Start both apps:

   ```bash
   npm install
   npm run dev
   ```

Open http://localhost:5173.

Use `AI_MODE=fixture` and `STORE_MODE=fixtures` for a completely offline deterministic demo. Use `STORE_MODE=live` only after configuring and validating the store search templates.

The local demo persists recipes, plans, comparisons, and store settings in `.data/home-meal-planner.json`, so enabling another store or restarting the API does not discard the household state. The optional MongoDB repository remains out of scope for this competition entry and is not claimed as a partner integration.

The current live smoke report accepts VMV and Randi. eBag, Kaufland, and BILLA are retained as configurable candidates but their public search surfaces did not return usable product cards during the latest check, so they are disabled by default. All three have deterministic fixture catalogues for offline demos and regression tests. `reports/live-store-smoke.json` contains the raw evidence and is never replaced by fixture data.

## Smoke checks

```bash
npm run smoke:gemma
npm run smoke:stores
```

The live store smoke test does not treat fixture data as a passing result. It writes a timestamped report to `reports/live-store-smoke.json`.

## Submission materials

- [`docs/dev-submission-draft.md`](docs/dev-submission-draft.md) contains the DEV post draft using the challenge template.
- [`docs/demo-script.md`](docs/demo-script.md) contains the short recording script and acceptance flow.
- [`docs/friend-feedback.md`](docs/friend-feedback.md) is the trial feedback sheet to complete after handing the app to the friend.
- The entry claims only Best Use of Gemma and Best Use of Mastra. MongoDB Atlas and other partner categories are intentionally excluded.

## Scope boundary

The app never logs into stores, edits carts, or checks out. It compares public product information and gives the household links to add selected products manually.
