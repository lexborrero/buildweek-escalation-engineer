# Escalation Engineer

Escalation Engineer is a working B2B SaaS MVP that turns customer escalation reports into structured, implementation-ready engineering tickets. It analyzes a sanitized report against a read-only repository snapshot, cites relevant paths and symbols, labels root-cause claims as hypotheses, and keeps a human approval step before engineering handoff.

The project includes a complete local demo workflow, so no AI credential or repository integration is required.

## What is included

- Dashboard with open escalation counts, severity distribution, workflow status, and recent activity
- Email/password sign-up and sign-in with protected app access and sign-out
- Persistent D1 user accounts, login timestamps, and revocable server-side sessions
- Validated escalation intake for customer impact, behavior, reproduction, logs, attachments, and repository selection
- Read-only repository context with indexed files, code symbols, tests, documentation, and snapshot metadata
- Multi-stage analysis experience with explicit privacy and repository-access boundaries
- Deterministic demo AI provider that matches report terms to real entries in the demo repository index
- Structured ticket generator with summary, impact, behavior, findings, hypothesis confidence, cited evidence, implementation plan, acceptance criteria, tests, risks, edge cases, and definition of done
- Two-column evidence and ticket review editor
- Explicit approval and sent-to-engineering status transitions
- Markdown, JSON, and clipboard exports suitable for Jira, Linear, and GitHub Issues
- Escalation detail view joining the original report, analysis, evidence, and final ticket
- Repository, AI-provider, redaction, evidence-threshold, and export settings UI
- Responsive layouts, keyboard focus states, semantic controls, reduced-motion support, and clear empty/error/loading/success states

## Technology

- TypeScript 5.9
- React 19 and Next.js-compatible App Router components
- Vinext and Vite for a Cloudflare Worker-compatible production build
- Cloudflare D1 for user and session persistence
- Plain CSS design system with no runtime component dependency
- Node test runner through `tsx`
- ESLint and Prettier

This repository started with only a two-line README and no application stack, models, or conventions. The MVP therefore uses typed domain models and a clean component/service/library boundary without introducing a database or live external integration prematurely.

## Quick start

Requirements:

- Node.js 22.13 or newer
- npm 10 or newer

Install and run:

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. The application starts in demo mode with realistic escalation, repository, analysis, and ticket data.

Production validation:

```bash
npm run validate
```

Individual commands:

```bash
npm run format
npm run typecheck
npm run lint
npm run test
npm run build
```

## Environment configuration

Copy `.env.example` to `.env.local` when adding integrations:

```bash
cp .env.example .env.local
```

No variables are required for demo mode.

| Variable                  | Required | Purpose                                                                     |
| ------------------------- | -------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_AI_PROVIDER` | No       | Defaults the UI to `demo`. Do not put secrets in a `NEXT_PUBLIC_` variable. |
| `OPENAI_API_KEY`          | No       | Reserved for a future server-side OpenAI adapter.                           |
| `OPENAI_MODEL`            | No       | Reserved model override for a future server-side adapter.                   |
| `GITHUB_APP_ID`           | No       | Reserved for a future read-only GitHub App connector.                       |
| `GITHUB_PRIVATE_KEY`      | No       | Reserved server-side GitHub App credential.                                 |
| `GITHUB_WEBHOOK_SECRET`   | No       | Reserved server-side webhook verification secret.                           |

The settings screen never persists or sends a browser-entered API key. Live-provider choices deliberately return a configuration error until a reviewed server-side adapter is added.

## Architecture

```text
app/
  api/auth/                        Sign-up, sign-in, and sign-out route handlers
  login/ and signup/               Account access pages
  layout.tsx                         Metadata and application shell document
  page.tsx                           Application entry
  globals.css                        Enterprise design system and responsive UI
components/
  auth-page.tsx                    Clean account access UI
  escalation-engineer-app.tsx       Screens, workflow orchestration, and interactions
data/
  demo-data.ts                       Repository snapshots and realistic escalation fixtures
lib/
  auth.ts                           Password hashing, sessions, and user lookup
  repository-analysis.ts             Evidence ranking and hypothesis construction
  security.ts                        Sensitive-pattern redaction and excerpt limits
  ticket-generation.ts               Structured ticket and export generation
  validation.ts                      Intake validation
  workflow.ts                        Explicit ticket-status transition rules
services/
  ai-provider.ts                     Replaceable provider interface and demo adapter
types/
  domain.ts                          Escalation, analysis, repository, and ticket models
tests/
  auth.test.ts                      Credential validation and password hashing
  ticket-generation.test.ts          Evidence, redaction, generation, and export tests
  workflow.test.ts                   Validation and critical state-flow tests
worker/
  index.ts                           Cloudflare-compatible application entry
```

### Authentication

Accounts are stored in the configured Cloudflare D1 database. Passwords are
PBKDF2-SHA-256 hashed with a unique salt before storage. Successful sign-in
creates a random seven-day session token; only its SHA-256 hash is stored in
the database, while the browser receives an `HttpOnly`, `SameSite=Lax` cookie.
The dashboard is server-protected and unauthenticated visitors are sent to the
login page.

The D1 schema is defined in `db/schema.ts` and the deployment migration is in
`drizzle/0000_auth.sql`. Local development initializes the same schema through
prepared D1 statements.

### Core data flow

1. Intake validates the customer report and associates a repository snapshot.
2. The analysis boundary sanitizes report text before evidence matching.
3. The provider abstraction receives the escalation and read-only repository model.
4. The demo adapter ranks indexed files by report terms and returns cited evidence.
5. Ticket generation converts the report and analysis into the complete engineering schema.
6. A human edits and approves the ticket before any sent-to-engineering status change.
7. Export functions serialize only the engineering ticket and cited evidence, not raw logs or attachments.

### Provider abstraction

`services/ai-provider.ts` defines the `AiProvider` contract. `DemoAiProvider` is deterministic and local. A production provider should be implemented server-side and must preserve the same response schema, redaction boundary, evidence citations, uncertainty labels, and error behavior.

### Repository analysis

The MVP repository index is a typed demo snapshot. Every visible technical reference maps to an actual `RepositoryFile` record containing:

- Path
- Symbol, when applicable
- Line range
- File category
- Sanitized excerpt
- Architectural description
- Search tags

The repository matcher is intentionally read-only. It does not clone, execute, edit, commit, or open issues against a repository.

## Security and privacy controls

- Demo analysis removes common API keys, bearer tokens, passwords, secrets, and email addresses from submitted text.
- Repository excerpts are sanitized and limited to 420 characters.
- Environment files and credentials are not part of the repository snapshot model.
- Raw customer logs and attachments are excluded from Markdown and JSON ticket exports.
- Root-cause statements always include a confidence score and an explicit hypothesis disclaimer.
- No product code, repository state, or external ticket system is modified.
- External handoff requires an explicit user action and remains simulated in demo mode.

These controls demonstrate the intended boundary but do not replace a production security review, tenant authorization, audit logging, retention policy, or data-loss-prevention program.

## Demo workflow

For the fastest walkthrough:

1. Open `ESC-1042` from the dashboard.
2. Compare the original report with its repository analysis and cited evidence.
3. Open the engineering ticket and edit any section in the right-hand pane.
4. Copy the ticket or export Markdown/JSON.
5. Approve it, then explicitly mark it sent to engineering.
6. Create a new escalation to exercise validation, attachments, the analysis state, and fresh ticket generation.
7. Visit Repositories and Settings to review evidence and provider boundaries.

## Current limitations

- Escalation workflow state is still session-local and resets on refresh; user accounts and login sessions are persistent.
- Repository content is represented by curated demo snapshots rather than a GitHub/GitLab installation.
- The demo matcher is deterministic and does not call a large language model.
- Attachment contents are not uploaded, parsed, or retained.
- Jira, Linear, and GitHub exports are copy/download flows; API-based issue creation is intentionally not implemented.
- Status history, comments, assignments, SLAs, and audit logs are not persisted.

## Recommended next steps

1. Add organizations, role-based access control, and an append-only audit log.
2. Persist escalations, analysis runs, evidence, revisions, and ticket status history in a tenant-aware database.
3. Add a read-only GitHub App with allowlisted repositories, ref pinning, secret scanning, and incremental indexing.
4. Implement a server-side AI adapter with structured output validation, provider timeouts, cost controls, and prompt/version observability.
5. Add attachment malware scanning, text extraction, retention controls, and customer-data classification.
6. Add explicit, permissioned Jira/Linear/GitHub delivery with preview, field mapping, idempotency, and reconciliation.
7. Expand browser-level accessibility and regression testing across intake, analysis, editing, approval, and export flows.
