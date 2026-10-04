# Project development rule

- Every code or behavior change must add or update regression tests covering the changed behavior.
- Before reporting a completed change, run `npm.cmd test` and `npm.cmd run build` from the project root.
- If a change cannot be meaningfully tested automatically, explain why and perform the relevant manual verification instead.
