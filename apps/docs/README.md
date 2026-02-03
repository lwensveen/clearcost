# ClearCost Docs App

Public documentation and playground for the ClearCost API.

## Local development

```bash
bun run --cwd apps/docs dev
```

Runs on `http://localhost:3001`.

## Build

```bash
bun run --cwd apps/docs build
```

## Required env

- `CLEARCOST_API_URL`
- `CLEARCOST_WEB_SERVER_KEY`

These are used by server routes that proxy "try it" requests to the API.
