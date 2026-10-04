import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

// The workspace starts this package from apps/api, while the documented
// configuration lives in the monorepo root. Resolve it from this source file
// so both `npm run dev` and built runs use the same .env file.
loadEnv({ path: fileURLToPath(new URL('../../../.env', import.meta.url)) });
loadEnv();

export type AppConfig = {
  port: number
  webOrigin: string
  mongodbUri?: string
  mongodbDb: string
  localDataFile?: string
  householdPasswordHash?: string
  sessionSecret: string
  ollamaBaseUrl: string
  ollamaModel: string
  aiMode: 'live' | 'fixture'
  storeMode: 'live' | 'fixtures'
  storeLocation: string
  storeSearchUrls: Record<string, string>
}

const boolMode = <T extends string>(value: string | undefined, fallback: T): T => (value ?? fallback) as T;

export const config: AppConfig = {
  port: Number(process.env.PORT ?? 3215),
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  mongodbUri: process.env.MONGODB_URI || undefined,
  mongodbDb: process.env.MONGODB_DB ?? 'home_meal_planner',
  localDataFile: process.env.LOCAL_DATA_FILE ?? fileURLToPath(new URL('../../../.data/home-meal-planner.json', import.meta.url)),
  householdPasswordHash: process.env.HOUSEHOLD_PASSWORD_HASH || undefined,
  sessionSecret: process.env.SESSION_SECRET ?? 'local-development-session-secret-change-me',
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
  ollamaModel: process.env.OLLAMA_MODEL ?? 'gemma4:e4b',
  aiMode: boolMode(process.env.AI_MODE, 'live'),
  storeMode: boolMode(process.env.STORE_MODE, 'fixtures'),
  storeLocation: process.env.STORE_LOCATION ?? 'Sofia',
  storeSearchUrls: {
    ebag: process.env.EBAG_SEARCH_URL_TEMPLATE ?? 'https://www.ebag.bg/en/search?query={query}',
    vmv: process.env.VMV_SEARCH_URL_TEMPLATE ?? 'https://vmv.bg/search?q={query}',
    randi: process.env.RANDI_SEARCH_URL_TEMPLATE ?? 'https://randi.bg/index.php?route=product/search&search={query}',
    kaufland: process.env.KAUFLAND_SEARCH_URL_TEMPLATE ?? 'https://www.kaufland.bg/tursene.html?query={query}',
    billa: process.env.BILLA_SEARCH_URL_TEMPLATE ?? 'https://www.billa.bg/?search={query}',
  },
};
