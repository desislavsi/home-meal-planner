---
title: "Home Meal Planner: a calmer grocery run for a friend"
published: false
tags: devchallenge, weekendchallenge, hf26challenge
---

*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

I built Home Meal Planner for a friend who wanted a simpler way to turn the recipes they already cook into a practical shopping list.

The app keeps recipes, plans meals across a date range, consolidates the required ingredients, and compares products from enabled grocery stores. It shows the quantity the meal plan requires, the package count, excess quantity, price basis, availability, and the source timestamp. The friend can select the products they actually want and open store-specific product links to add them to a basket manually.

The first useful slice is deliberately small:

```text
recipe -> planned meal -> consolidated ingredients -> live store comparison -> selected product links
```

## Demo

<!-- Replace this with the recorded video URL before publishing. -->

[Watch the Home Meal Planner demo](VIDEO_URL)

The demo shows the private household login, recipe entry, meal planning, Gemma suggestions, live store comparison, package calculations, product selection, and store-grouped links.

## Code

<!-- Replace this with the public repository URL before publishing. -->

[View the source code](https://github.com/desislavsi/home-meal-planner)

## How I Built It

The application is a TypeScript monorepo with a React/Vite frontend and a Fastify API. Shared Zod contracts keep the browser and API aligned. The local runtime is:

```text
React + Vite -> Fastify -> Ollama -> Gemma 4 E4B
                         |
                    store adapters
```

Gemma is used for meal suggestions and recipe-aware interpretation. Mastra provides the agent layer around the local model. Deterministic application code remains responsible for recipe-ID validation, date and meal-slot validation, ingredient consolidation, unit compatibility, package calculations, ranking, and shopping totals.

The successful live run with Ollama and `gemma4:e4b`, including the terminal output and validated response, is documented in the [Gemma smoke-test evidence](https://github.com/desislavsi/home-meal-planner/blob/main/reports/gemma-smoke.md).

The app supports two modes:

- Live mode checks public product pages from VMV and Randi. Their current smoke-test evidence is stored in [`reports/live-store-smoke.json`](https://github.com/desislavsi/home-meal-planner/blob/main/reports/live-store-smoke.json).
- Fixture mode provides repeatable offline data for testing and for a demo when a store page is unavailable.

The app never signs in to a store, edits a cart, or checks out. It hands the friend the selected product links so they remain in control of the purchase.

## Why Does Open Innovation Matter?

Meal plans and shopping habits are personal household data. Running Gemma locally through Ollama means the recipe collection and meal-planning context can stay on the household computer instead of being sent to a hosted model by default. It also makes the core AI workflow usable without a paid model API or a vendor lock-in.

Using Mastra with an open-weight local model keeps the agent boundary visible and replaceable. The model can suggest recipes, but it cannot silently invent a recipe, change a meal plan, merge semantically different ingredients, or decide that a different brand is equivalent. The application validates the model's output and performs the money and quantity calculations itself.

Local AI does not remove the need for the internet when live grocery prices are requested; the store adapters need access to public product pages. Fixture mode remains fully offline and deterministic.

## What I Learned From the Friend Trial

<!-- Complete this section after the friend tries the app. Do not invent feedback. -->

- What saved the most time: [ADD OBSERVATION]
- What was confusing: [ADD OBSERVATION]
- Change made after feedback: [ADD CHANGE]
- Remaining improvement: [ADD FOLLOW-UP]

## Prize Categories

- Best Use of Gemma
- Best Use of Mastra

No MongoDB Atlas or other partner categories are claimed for this entry.

## My Agent Session

Agent-session capture was not included in this MVP. The repository contains the smoke test and automated validation used to verify the local Gemma path.

