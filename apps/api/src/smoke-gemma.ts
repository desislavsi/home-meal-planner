import { config } from './config.js';
import { smokeGemma } from './ai.js';

try {
  const result = await smokeGemma({ ...config, aiMode: 'live' });
  console.log(JSON.stringify({ pass: true, result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ pass: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exit(1);
}
