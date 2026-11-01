# RAG Evaluation Platform

A developer-focused platform for benchmarking, validating, and monitoring Retrieval-Augmented Generation (RAG) applications.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Angular (v20+, Standalone Components, Signals, Router Guards, HTTP Interceptors) |
| **Backend** | FastAPI (Python 3.11+, Pydantic v2, Motor, Uvicorn, Bcrypt, PyJWT) |
| **Database** | MongoDB (v7.0) with Motor Async Driver & Indexes on `userId`, `projectId`, `datasetId` |
| **AI / Orchestration** | LangChain & Google Gemini API (`google-genai`, `langchain-google-genai`) |
| **Infrastructure** | Docker & Docker Compose |

---

## Project Structure

```text
rag-evaluation-platform/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI application factory, lifespan & CORS
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py              # Dependencies: get_current_user, get_project_service, get_dataset_service
│   │   │   ├── router.py            # API router aggregator (/api prefix)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── auth.py          # /api/auth endpoints
│   │   │       ├── health.py        # /api/health endpoints
│   │   │       ├── projects.py      # /api/projects endpoints
│   │   │       └── datasets.py      # /api/datasets endpoints
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── config.py            # Pydantic Settings (.env)
│   │   │   ├── exceptions.py        # Centralized exception handlers
│   │   │   ├── logging.py           # Structured logging
│   │   │   └── security.py          # Bcrypt hashing & JWT creation/decoding
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   └── mongodb.py           # Motor async MongoDB client & health check
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py              # User model
│   │   │   ├── project.py           # Project model
│   │   │   ├── dataset.py           # Dataset model
│   │   │   └── dataset_item.py      # DatasetItem evaluation question model
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── user_repository.py
│   │   │   ├── project_repository.py
│   │   │   ├── dataset_repository.py
│   │   │   └── dataset_item_repository.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── project.py
│   │   │   ├── dataset.py
│   │   │   └── dataset_item.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── auth_service.py
│   │       ├── project_service.py
│   │       └── dataset_service.py
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_auth.py             # Auth test suite
│   │   ├── test_health.py           # Health endpoint tests
│   │   ├── test_projects.py         # Projects CRUD & auth boundary tests
│   │   └── test_datasets.py         # Datasets & evaluation question tests
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── core/
│   │   │   │   ├── guards/
│   │   │   │   │   └── auth.guard.ts          # authGuard & guestGuard
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── auth.interceptor.ts    # Bearer token & 401 handling
│   │   │   │   ├── models/
│   │   │   │   │   ├── project.model.ts       # Project TypeScript interfaces
│   │   │   │   │   └── dataset.model.ts       # Dataset & Item TypeScript interfaces
│   │   │   │   └── services/
│   │   │   │       ├── auth.service.ts
│   │   │   │       ├── health.service.ts
│   │   │   │       ├── project.service.ts
│   │   │   │       └── dataset.service.ts
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── health/
│   │   │   │   ├── projects/
│   │   │   │   │   ├── project-list/          # /projects
│   │   │   │   │   ├── project-create/        # /projects/new
│   │   │   │   │   └── project-detail/        # /projects/:id & /projects/:id/datasets
│   │   │   │   └── datasets/
│   │   │   │       └── dataset-detail/        # /datasets/:id (Table, Add/Edit, CSV/JSON Import)
│   │   │   ├── layout/
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   ├── app.ts
│   │   │   ├── app.html
│   │   │   └── app.scss
│   │   ├── environments/
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.scss
│   ├── .dockerignore
│   ├── .env.example
│   ├── angular.json
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── .dockerignore
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## API Endpoints Reference

### Projects

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects` | List all projects belonging to the authenticated user |
| `POST` | `/api/projects` | Create a new evaluation project |
| `GET` | `/api/projects/{id}` | Get project details and dataset counts |
| `PUT` | `/api/projects/{id}` | Update project name or description |
| `DELETE` | `/api/projects/{id}` | Delete project (cascades to all datasets and items) |

### Datasets & Evaluation Items

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/projects/{id}/datasets` | List all datasets associated with a project |
| `POST` | `/api/projects/{id}/datasets` | Create a dataset under a project |
| `GET` | `/api/datasets/{id}` | Get dataset details along with all evaluation questions |
| `POST` | `/api/datasets/{id}/items` | Add a single evaluation question |
| `PUT` | `/api/datasets/{id}/items/{itemId}` | Update an evaluation question item |
| `DELETE` | `/api/datasets/{id}/items/{itemId}` | Delete an evaluation question item |
| `POST` | `/api/datasets/{id}/import` | Batch import evaluation questions from CSV/JSON payload |

### RAG Configurations (Phase 4)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/rag-configurations` | List RAG configurations (supports optional `?projectId=...`) |
| `POST` | `/api/rag-configurations` | Register an external RAG pipeline endpoint |
| `GET` | `/api/rag-configurations/{id}` | Get RAG configuration details (sensitive headers masked) |
| `PUT` | `/api/rag-configurations/{id}` | Update configuration (retains existing secrets if masked) |
| `DELETE` | `/api/rag-configurations/{id}` | Delete RAG configuration |
| `POST` | `/api/rag-configurations/{id}/test` | Send sample question, measure latency, verify answer & contexts |

### Evaluation Engine & Quality Metrics (Phases 5, 6 & 7)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/evaluations` | Start asynchronous background evaluation run with Gemini quality scoring |
| `GET` | `/api/evaluations` | List user evaluation runs (supports optional `?projectId=...`) |
| `GET` | `/api/evaluations/{id}` | Get evaluation run progress and aggregate metrics (`overallScore`, `averageFaithfulness`, etc.) |
| `GET` | `/api/evaluations/{id}/results` | Get question-by-question outcomes, generated answers, contexts, latency, and Gemini metrics |
| `GET` | `/api/evaluations/{id}/results/{resultId}` | Get single question result detail with side-by-side answers, contexts, and Gemini rationale |
| `POST` | `/api/evaluations/{id}/cancel` | Cancel in-progress evaluation run |

### Evaluation Run Comparison (Phase 8)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/comparisons` | Compare two evaluation runs from the same project with metric differences, directional classification, and deterministic summary |

### Internal RAG & MongoDB Atlas Vector Search (Phase 9)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/projects/{id}/documents` | Upload and index document (PDF, TXT, Markdown, JSON) via Loader → Text Splitter → Gemini Embeddings → Atlas Vector Search |
| `GET` | `/api/projects/{id}/documents` | List uploaded documents with chunk counts and parsing metadata |
| `GET` | `/api/projects/{id}/documents/{docId}` | Get single document metadata |
| `DELETE` | `/api/projects/{id}/documents/{docId}` | Delete document and remove all associated vector chunk embeddings |
| `GET` | `/api/projects/{id}/rag-settings` | Get Atlas Vector Search configuration (`chunkSize`, `chunkOverlap`, `topK`) |
| `PUT` | `/api/projects/{id}/rag-settings` | Update Atlas Vector Search parameters |
| `POST` | `/api/projects/{id}/query` | Query internal RAG pipeline directly (`{"question": "..."}` → `{"answer": "...", "contexts": [...]}`) |
| `POST` | `/api/evaluations/{id}/quality-gate` | Evaluate whether a run meets quality thresholds (`{"passed": true, "score": 0.91}`) |
| `GET` | `/api/evaluations/{id}/export/csv` | Download evaluation run and all questions as RFC 4180 CSV |
| `GET` | `/api/evaluations/{id}/export/json` | Download full serialized evaluation run and granular question metrics as JSON |
| `POST` | `/api/evaluations/{id}/results/{resultId}/human-eval` | Attach human reviewer score (1-5 stars) and feedback notes |
| `POST` | `/api/evaluations/{id}/results/{resultId}/annotations` | Tag result with annotations (e.g., `["needs_review", "gold_standard"]`) |
| `GET`, `POST` | `/api/api-keys` | Manage external integration API keys (CI/CD, CLI) |
| `DELETE` | `/api/api-keys/{id}` | Revoke an integration API key |
| `GET`, `PUT` | `/api/projects/{id}/thresholds` | Configure project quality gate thresholds |
| `GET`, `POST`, `DELETE` | `/api/projects/{id}/webhooks` | Configure event-driven webhooks (`evaluation.completed`, `gate.failed`) |
| `GET`, `POST`, `DELETE` | `/api/projects/{id}/schedules` | Configure recurring automated evaluation schedules |
| `GET` | `/api/projects/{id}/trends` | Chronological evaluation metrics trajectory across runs |
| `GET` | `/api/projects/{id}/audit-logs` | Retrieve structured audit events for governance |
| `GET`, `POST` | `/api/workspaces` | Multi-tenant team and workspace collaboration |

#### CI/CD CLI Integration (`rageval`):
```bash
# Automated evaluation run in CI/CD pipeline with threshold exit codes
python cli/rageval.py run \
  --project customer-support \
  --dataset regression \
  --fail-under 85 \
  --api-key "$RAGEVAL_API_KEY"
```
- **Exit Code 0**: Evaluation meets or exceeds threshold (`passed: true`).
- **Exit Code 1**: Quality gate failed or score dropped below `--fail-under`.

#### Gemini Quality Metrics Evaluated:
1. **Answer Correctness** (0.0 - 1.0): Compares generated answer to ground truth expected answer for semantic and factual equivalence.
2. **Answer Relevance** (0.0 - 1.0): Measures whether the generated answer directly addresses the question without fluff or dodging.
3. **Faithfulness** (0.0 - 1.0): Detects hallucinations by measuring if claims in generated answer are grounded in retrieved contexts.
4. **Context Relevance** (0.0 - 1.0): Measures the pertinence and noise level of retrieved context passages for answering the query.
5. **Context Recall** (0.0 - 1.0, Optional): Evaluates the fraction of ground truth context captured by retrieved passages.

#### Production Features & Enterprise Resilience:
- **Token Usage & Cost Tracking**: Accurately approximates input/output tokens and estimated Gemini costs per question and run.
- **Automated Regression Detection**: Detects score drops $\ge 0.05$ or significant latency spikes compared to the previous baseline run.
- **Observability**: Tracks end-to-end request latency, Gemini evaluation latency, and vector retrieval latency breakdown.
- **Dual Authentication**: Accepts standard Bearer JWT or external `x-api-key` header (`rageval_...`).
- **Human-in-the-Loop**: Supports reviewer scoring (1-5 stars) and freeform feedback notes to calibrate LLM evaluation.

#### Security Guarantees:
- **Sensitive Headers Masked**: API keys, bearer tokens, and secrets are permanently masked (`"********"`) before responses leave the backend.
- **Backend-Only Secrets**: Unmasked secrets are stored exclusively in MongoDB; Angular never receives sensitive values.
- **Zero Key Logging**: Headers and request credentials are never printed to console or application log streams.

---

## Frontend Routes

| Route | Guard | Description |
|---|---|---|
| `/login` | `guestGuard` | User sign-in |
| `/register` | `guestGuard` | Developer account creation |
| `/dashboard` | `authGuard` | Metrics, system status, quick navigation |
| `/projects` | `authGuard` | Projects listing, search, deletion |
| `/projects/new` | `authGuard` | Create new project form |
| `/projects/:id` | `authGuard` | Project details: Datasets, Documents & Internal RAG, Quality Trends, CI/CD & Production Settings |
| `/projects/:id/datasets` | `authGuard` | Datasets listing under project |
| `/projects/:id/compare` | `authGuard` | Evaluation Run Comparison (Run A baseline vs Run B candidate, deterministic summary, metrics table) |
| `/datasets/:id` | `authGuard` | Dataset table, question editor, CSV/JSON import modal |
| `/configurations` | `authGuard` | External RAG pipeline endpoints configuration & interactive testing |
| `/evaluations` | `authGuard` | Configure & launch evaluation runs, live progress tracking, run cards |
| `/evaluations/:id` | `authGuard` | Evaluation Run Overview Dashboard (Quality Gate banner, Export CSV/JSON, Token/Cost metrics, SVG charts, filters) |
| `/evaluations/:id/results/:resultId` | `authGuard` | Detailed question evaluation inspection (Latency breakdown, Token usage, Human Review scoring, Annotations) |
| `/health` | `authGuard` | Real-time system diagnostics & ping |

---

## Testing

```bash
# Activate backend virtual environment
# Windows:
backend\.venv\Scripts\Activate.ps1
# Linux / macOS:
source backend/.venv/bin/activate

# Execute pytest suite
$env:PYTHONPATH="backend"
pytest backend/tests -v
```

All 38 tests across authentication, health, projects, datasets, RAG configurations, evaluation engine, Gemini quality metrics, single result inspection, run comparisons, document loaders (PDF/TXT/MD/JSON), Atlas Vector Search, internal RAG, API keys, quality gates, exports (CSV/JSON), human evaluation, annotations, thresholds, webhooks, schedules, and trends pass cleanly.
