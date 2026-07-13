# NexusIQ

AI-powered enterprise knowledge base. Upload documents, search across your knowledge base, and get AI-generated answers with source citations.

## Architecture

```
frontend/    React 19 + React Router + Tailwind CSS    →  Vite dev server (port 5173)
gateway/     Express 5 + Prisma (SQLite/PostgreSQL)    →  API server (port 4000)
ml-engine/   FastAPI + FAISS + sentence-transformers   →  ML server (port 8000)
```

The Chrome extension lives in a separate repository.

## Features

- **Document ingestion** — Upload PDF, DOCX, PPTX, MD, TXT (50MB limit). Async processing via BullMQ with in-memory fallback when Redis is unavailable. Real-time status badges (Uploading → Processing → Ready) via polling.
- **Semantic search** — Documents are chunked, embedded with `all-MiniLM-L6-v2`, and indexed in FAISS. Search across your entire knowledge base with relative relevance scores.
- **AI Q&A** — Ask natural-language questions. Query rewriting (llama-3.1-8b) → FAISS best-doc identification → full-document retrieval → answer via Groq LLMs with source citations and relevance scores.
- **Role-based access** — SUPER_ADMIN > ADMIN > EDITOR > VIEWER hierarchy. Folder-level permissions (`minViewRole`/`minEditRole`). Team folders with public/private visibility.
- **Multi-organization** — Create and switch between orgs. Invite users via email. Each org has isolated documents, teams, and permissions.
- **Teams** — CRUD teams, add/remove members, change requests with admin approval workflow.
- **Folders** — Org-level and team-level folders. Batch select/delete. Activity logs for every upload and delete.
- **Analytics dashboard** — Document counts, upload trends, doc type breakdown, recent activity feed.
- **Global search** — `⌘K` shortcut to search across members, folders, files, and logs.

## Quick Start

```bash
# Gateway
cd gateway
npm install
cp .env.example .env    # configure DATABASE_URL, JWT_SECRET
npx prisma db push
npm run dev             # → localhost:4000

# ML Engine
cd ml-engine
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env    # configure GROQ_API_KEY
cd src
uvicorn main:app --port 8000   # → localhost:8000

# Frontend
cd frontend
npm install
npm run dev             # → localhost:5173
```

## Environment Variables

### Gateway
| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./prisma/dev.db` | SQLite for dev, PostgreSQL for production |
| `JWT_SECRET` | — | JWT signing key |
| `ML_ENGINE_URL` | `http://localhost:8000` | ML Engine address |
| `REDIS_URL` | — | Redis for BullMQ (optional, falls back to in-memory) |

### ML Engine
| Variable | Default | Description |
|----------|---------|-------------|
| `GROQ_API_KEY` | — | Groq API key for LLM answers |
| `GATEWAY_URL` | `http://localhost:4000` | Gateway address for file fetching |

## Tech Stack

- **Frontend**: React 19, React Router 7, Tailwind CSS v4, Lucide icons, React Query
- **Gateway**: Express 5, Prisma ORM, BullMQ, JWT, Multer
- **ML Engine**: FastAPI, FAISS, sentence-transformers, Groq SDK, pdfplumber, python-docx, python-pptx
- **Auth**: JWT with bcrypt, role-based middleware, invite-by-email flow
- **Queue**: BullMQ with automatic in-memory fallback
- **Vector Store**: FAISS (IndexFlatL2) on disk, one index per document
