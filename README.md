# AI Smart Contract Auditor

AI-first smart contract audit SaaS for Solidity projects. It combines file/editor input, Slither and Mythril static analysis, Solidity parser heuristics, OpenRouter-powered remediation, scoring, gas guidance, and professional report generation.

## Stack

- Frontend: Next.js 15, TypeScript, TailwindCSS, shadcn-style components, Framer Motion, Monaco Editor, React Query, Zustand
- Backend: NestJS, Prisma, PostgreSQL, Redis, BullMQ, JWT auth, rate limiting
- Analysis: Slither, Mythril, Solidity AST parser heuristics
- AI: OpenRouter with GPT-4.1 or Claude Sonnet compatible structured JSON prompts
- Deployment: Docker Compose with frontend, backend, postgres, redis, slither, mythril

## Quick Start

```bash
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
docker compose up --build
```

Frontend: http://localhost:3000  
API: http://localhost:4000

## Local Development

```bash
docker compose up postgres redis -d
npm run dev -w apps/api
npm run dev -w apps/web
```

If your machine already uses the default database ports:

```bash
POSTGRES_PORT=15432 REDIS_PORT=16379 docker compose up postgres redis -d
DATABASE_URL="postgresql://auditor:auditor@localhost:15432/auditor?schema=public" npm run prisma:migrate -w apps/api -- --name init
PORT=4000 DATABASE_URL="postgresql://auditor:auditor@localhost:15432/auditor?schema=public" REDIS_URL="redis://localhost:16379" JWT_SECRET="dev-secret-change-me" npm run dev -w apps/api
NEXT_PUBLIC_API_URL="http://localhost:4000" NEXT_PUBLIC_WS_URL="ws://localhost:4000" npm run dev -w apps/web -- -p 3001
```

## Environment

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `JWT_SECRET`: strong signing secret
- `OPENROUTER_API_KEY`: OpenRouter API key
- `OPENROUTER_MODEL`: `openai/gpt-4.1`, `anthropic/claude-sonnet-4`, or compatible model
- `UPLOAD_DIR`: secure upload storage path
- `REPORT_DIR`: generated report storage path

## API

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /audit/upload`
- `POST /audit`
- `GET /audit/:id`
- `GET /audit/history`
- `GET /reports/:id`

## Security Notes

Uploads are limited to Solidity files, filenames are randomized, shell execution uses argument arrays rather than string interpolation, and external analyzer execution is isolated behind service adapters. Enable HTTPS, strong JWT secrets, object storage malware scanning, and per-tenant RBAC before public production launch.

## Example Vulnerability JSON

```json
{
  "title": "Reentrancy in withdraw",
  "category": "REENTRANCY",
  "severity": "CRITICAL",
  "confidence": 0.92,
  "file": "Vault.sol",
  "lineStart": 42,
  "lineEnd": 58,
  "snippet": "msg.sender.call{value: amount}(\"\")",
  "explanation": "External control is transferred before state is updated, allowing repeated withdrawals.",
  "recommendation": "Update balances before the external call and add ReentrancyGuard.",
  "fixedCode": "balances[msg.sender] -= amount; (bool ok,) = msg.sender.call{value: amount}(\"\"); require(ok);"
}
```
