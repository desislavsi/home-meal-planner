# Gemma smoke test

- Result: PASS (`pass: true`)
- Run: 2026-10-05 06:51:42 Europe/Sofia
- Command: `npm.cmd run smoke:gemma`
- AI mode: live; the smoke script forces strict live mode, so it fails rather than falling back to fixture suggestions.
- Ollama endpoint: `http://127.0.0.1:11434`
- Configured model: `gemma4:e4b` (also present in Ollama's `/api/tags` response)
- Output: 21 meal suggestions returned and validated.
- Raw command output: [gemma-smoke.log](gemma-smoke.log)

The smoke fixture uses synthetic recipe and plan data, including Bulgarian ingredient names. No household recipe data is included in this report.
