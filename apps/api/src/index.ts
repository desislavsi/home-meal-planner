import { buildServer } from './server.js';
import { config } from './config.js';
import { createRepository } from './repository.js';

const { repository, close } = await createRepository(config.mongodbUri, config.mongodbDb, config.localDataFile);
const app = await buildServer(config, repository);
await app.listen({ port: config.port, host: '127.0.0.1' });
console.log(`Home Meal Planner API listening on http://127.0.0.1:${config.port}`);

const shutdown = async () => { await app.close(); await close(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
