# Contributing

Thank you for your interest in contributing to Agent Brain API.

## Getting Started

1. Fork the repository on GitHub
2. Clone your fork
3. Copy `.env.example` to `.env` and fill in your MongoDB URI
4. Install dependencies: `pnpm install`
5. Start the API server: `pnpm --filter @workspace/api-server run dev`
6. Start the dashboard: `pnpm --filter @workspace/dashboard run dev`

## Project Structure

```
artifacts/api-server/src/
├── routes/      # Add new endpoints here
├── models/      # Add new Mongoose models here
├── middleware/  # Express middleware
└── lib/
    └── swagger.ts   # Update this when adding endpoints
```

## Adding a New Endpoint

1. Create your route file in `artifacts/api-server/src/routes/your-route.ts`
2. Register it in `artifacts/api-server/src/routes/index.ts`
3. Add the path and schema to `artifacts/api-server/src/lib/swagger.ts`
4. If you need a new MongoDB collection, add a model in `artifacts/api-server/src/models/`

## Code Style

- TypeScript everywhere
- Explicit error handling in every route (`try/catch`, descriptive error messages)
- No hardcoded secrets — use environment variables only
- Keep routes thin; put business logic in models or lib

## Pull Requests

- One feature or fix per PR
- Describe what the PR does and why in the description
- All endpoints must have Swagger documentation

## Reporting Issues

Open a GitHub issue with:
- What you expected to happen
- What actually happened
- Steps to reproduce
