// Runs an isolated copy of the saved household data. All changes stay in
// memory. Store searches are live; no orders or basket actions are performed.
// Run: node --import tsx scripts/debug-shopping.mts
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { config } from '../apps/api/src/config.js';
import { MemoryRepository } from '../apps/api/src/repository.js';
import { buildServer } from '../apps/api/src/server.js';

const snapshot = JSON.parse(await readFile(config.localDataFile!, 'utf8'));
const latest = snapshot.comparisons.toSorted((a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt))[0];
const repository = new MemoryRepository(snapshot);
const api = await buildServer({ ...config, port: 3216, webOrigin: 'http://127.0.0.1:5174', householdPasswordHash: await bcrypt.hash('shopping-debug', 4), sessionSecret: 'isolated-shopping-debug', aiMode: 'fixture' }, repository);
await api.listen({ port: 3216, host: '127.0.0.1' });
const web = await createServer({ configFile: false, root: fileURLToPath(new URL('../apps/web', import.meta.url)), plugins: [react()], server: { host: '127.0.0.1', port: 5174, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3216', '/health': 'http://127.0.0.1:3216' } } });
await web.listen();
console.log(JSON.stringify({ url: 'http://127.0.0.1:5174', password: 'shopping-debug', planId: latest?.mealPlanId, comparisonId: latest?.id, mode: config.storeMode, persistence: 'memory only' }));
process.on('SIGINT', async () => { await web.close(); await api.close(); process.exit(0); });
