import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { createStoreAdapters, checkStore } from './stores.js';

const adapters = createStoreAdapters({ ...config, storeMode: 'live' }, 'live');
const queries = ['мляко', 'домати', 'банани', 'брашно'];
const reports = [];
for (const adapter of adapters) reports.push(await checkStore(adapter, queries, config.storeLocation));
const reportDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../../reports');
await mkdir(reportDirectory, { recursive: true });
await writeFile(resolve(reportDirectory, 'live-store-smoke.json'), JSON.stringify({ generatedAt: new Date().toISOString(), mode: 'live', reports }, null, 2));
const passed = reports.filter((report) => report.pass);
console.log(JSON.stringify({ pass: passed.length >= 2, passedStores: passed.map((report) => report.storeId), reports }, null, 2));
if (passed.length < 2) process.exit(1);
