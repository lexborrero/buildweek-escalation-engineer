# DevRelay

> Customer signals. Engineering action.

DevRelay is a B2B support-engineering workspace that turns customer escalation reports into structured, evidence-backed engineering tickets. It combines sanitized support context with a read-only repository snapshot, surfaces the most relevant implementation paths, and keeps a human approval step before engineering handoff.

The repository includes a complete local demo workflow, persistent user authentication, realistic escalation data, and a deterministic analysis provider. No AI credentials or live repository integration are required to explore the product.

## Live app

[Open DevRelay](https://escalation-engineer-lexborrero.lblegend7.chatgpt.site)

Access to the hosted version depends on the deployment's workspace policy. You can always run the full product locally using the instructions below.

## Why DevRelay

Customer-facing teams often have the impact, reproduction details, and logs for an urgent issue, while engineering needs code-level context, likely ownership, risks, and a concrete definition of done. Translating between those two views is slow and lossy.

DevRelay creates a reviewable bridge between them:

1. Support captures the customer-visible problem and its impact.
2. Sensitive values are removed before analysis.
3. The report is compared with a read-only repository index.
4. Relevant files, symbols, tests, and documentation are cited as evidence.
5. A structured engineering ticket is generated with explicit uncertainty.
6. A human reviews, edits, and approves the ticket before handoff.

## Features

### Accounts and access

- Clean, responsive sign-in and sign-up experience
- Persistent Cloudflare D1 user accounts
- PBKDF2-SHA-256 password hashing with a unique salt per account
- Revocable, server-side sessions using hashed tokens
- `HttpOnly`, `SameSite=Lax`, seven-day session cookies
- Server-protected application routes and explicit sign-out
- Recorded account creation and last-login timestamps

### Escalation workflow

- Dashboard with open escalation counts, severity distribution, workflow status, and recent activity
- Validated intake for customer impact, behavior, reproduction steps, logs, attachments, and repository selection
- Read-only repository context containing indexed files, symbols, tests, documentation, and snapshot metadata
- Multi-stage analysis experience with clear privacy and repository-access boundaries
- Deterministic demo provider that matches sanitized report terms to repository evidence
- Detailed escalation view joining the original report, analysis, evidence, and final ticket

### Engineering handoff

- Structured ticket generation with:
  - Summary and customer impact
  - Expected and observed behavior
  - Findings and cited repository evidence
  - Root-cause hypothesis with confidence and uncertainty language
  - Implementation plan
  - Acceptance criteria and test plan
  - Risks, edge cases, and definition of done
- Two-column evidence and ticket review editor
- Explicit approval and sent-to-engineering status transitions
- Markdown, JSON, and clipboard exports for Jira, Linear, and GitHub Issues workflows

### Product quality

- Responsive desktop and mobile layouts
- Semantic controls, keyboard focus states, and reduced-motion support
- Purpose-built empty, loading, error, and success states
- Typed domain models and explicit workflow transitions
- Automated authentication, redaction, ticket-generation, validation, and workflow tests
- Cloudflare Worker-compatible production build

## Technology

| Area           | Technology                                                    |
| -------------- | ------------------------------------------------------------- |
| Language       | TypeScript 5.9                                                |
| UI             | React 19, Next.js-compatible App Router components, plain CSS |
| Runtime        | Vinext, Vite, Cloudflare Workers                              |
| Database       | Cloudflare D1                                                 |
| Authentication | Web Crypto PBKDF2-SHA-256 and server-managed sessions         |
| Testing        | Node test runner through `tsx`                                |
| Quality        | ESLint and Prettier                                           |
| Hosting        | OpenAI Sites with Cloudflare-compatible output                |

## Quick start

### Requirements

- Node.js 22.13 or newer
- npm 10 or newer

### Install and run

```bash
npm install
npm run dev
```

Open the local URL printed by the development server. Create an account from the sign-up screen, then use the included demo records to explore the workflow.

The local Cloudflare runtime provides the `DB` binding declared in `.openai/hosting.json`. Authentication tables are initialized through prepared D1 statements when first needed.

### Validate a production build

```bash
npm run validate
```

Individual checks are also available:

```bash
npm run format
npm run typecheck
npm run lint
npm run test
npm run build
```

## Environment configuration

Copy the example file when adding integrations:

```bash
cp .env.example .env.local
```

No environment variables are required for the local demo provider.

| Variable                  | Required | Purpose                                                                      |
| ------------------------- | -------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_AI_PROVIDER` | No       | Defaults the UI to `demo`. Never place secrets in a `NEXT_PUBLIC_` variable. |
| `OPENAI_API_KEY`          | No       | Reserved for a future reviewed server-side OpenAI adapter.                   |
| `OPENAI_MODEL`            | No       | Reserved model override for a future server-side adapter.                    |
| `GITHUB_APP_ID`           | No       | Reserved for a future read-only GitHub App connector.                        |
| `GITHUB_PRIVATE_KEY`      | No       | Reserved server-side GitHub App credential.                                  |
| `GITHUB_WEBHOOK_SECRET`   | No       | Reserved server-side webhook verification secret.                            |

The settings screen never persists or sends a browser-entered API key. Live-provider choices return a configuration error until a reviewed server-side adapter is implemented.

## Authentication and database design

DevRelay stores account and session records in Cloudflare D1.

### Users

The `users` table contains the account ID, display name, normalized email, password hash, unique salt, hashing iteration count, creation time, and last-login time. Email addresses are unique and compared case-insensitively.

Passwords are never stored directly. The deployed Worker runtime supports PBKDF2 counts up to 100,000 iterations, so DevRelay uses that supported maximum with SHA-256 and a unique random salt.

### Sessions

Successful authentication creates a cryptographically random session token. The browser receives the token in a secure cookie, while D1 stores only its SHA-256 hash. Logging out deletes the server-side record and clears the cookie. Expired sessions are rejected and cleaned up during authentication activity.

The schema lives in `db/schema.ts`, with the deployment migration in `drizzle/0000_auth.sql`.

## Architecture

```text
app/
  api/auth/
    login/route.ts                 Account authentication
    logout/route.ts                Session revocation
    signup/route.ts                Account creation
  login/page.tsx                   Sign-in page
  signup/page.tsx                  Sign-up page
  layout.tsx                       Metadata and document shell
  page.tsx                         Protected application entry
  globals.css                      Product design system
components/
  auth-page.tsx                    Shared account access experience
  escalation-engineer-app.tsx     Screens and workflow interactions
data/
  demo-data.ts                     Repository snapshots and escalation fixtures
db/
  index.ts                         D1 access and schema initialization
  schema.ts                        Users and sessions schema
lib/
  auth.ts                          Credential hashing, sessions, and user lookup
  repository-analysis.ts          Evidence ranking and hypothesis construction
  security.ts                     Sensitive-pattern redaction and excerpt limits
  ticket-generation.ts            Structured ticket and export generation
  validation.ts                   Intake validation
  workflow.ts                     Explicit status-transition rules
services/
  ai-provider.ts                   Replaceable provider interface and demo adapter
tests/
  auth.test.ts                     Credential and crypto-policy tests
  ticket-generation.test.ts       Evidence, redaction, generation, and export tests
  workflow.test.ts                Validation and critical workflow tests
types/
  domain.ts                        Product domain models
worker/
  index.ts                         Cloudflare-compatible application entry
```

## Built with Codex and ChatGPT 5.6

DevRelay was developed through an AI-assisted engineering workflow using [Codex](https://developers.openai.com/codex/) and ChatGPT 5.6. They played complementary roles throughout product discovery, implementation, debugging, and delivery.

### How ChatGPT 5.6 helped

- Turned a high-level product idea into a concrete support-to-engineering workflow
- Helped shape the information architecture, feature boundaries, interface copy, and the DevRelay name
- Reasoned through authentication, privacy, uncertainty labeling, and human-approval requirements
- Challenged assumptions and identified missing states, risks, edge cases, and future production concerns
- Helped explain the product clearly for technical and nontechnical readers

### How Codex helped

- Inspected the repository and worked directly in the existing TypeScript codebase
- Implemented the React interface, typed domain models, D1 schema, authentication routes, session handling, and responsive styling
- Added focused regression tests and ran formatting, type, lint, test, and production-build checks
- Diagnosed the hosted login failure from production logs and traced it to the Worker's PBKDF2 iteration limit
- Updated the crypto policy, verified sign-up and sign-in against the deployed database, and republished the repaired app
- Kept implementation changes scoped, reviewable, and aligned with the product requirements

### Human-in-the-loop development

AI accelerated the work, but it did not replace product ownership or review. The human collaborator set the goals, evaluated the experience, reported real production behavior, and guided the product direction. Generated code was treated like any other code: inspected, tested, built, and verified against the running application before delivery.

ChatGPT 5.6 and Codex were development collaborators; they are not runtime dependencies in the current demo. Repository analysis remains deterministic and local unless a future server-side AI provider is deliberately configured.

## Security and privacy controls

- Common API keys, bearer tokens, passwords, secrets, and email addresses are removed from submitted report text before demo analysis.
- Repository excerpts are sanitized and limited to 420 characters.
- Environment files and credentials are excluded from the repository snapshot model.
- Raw customer logs and attachments are excluded from Markdown and JSON ticket exports.
- Root-cause statements include a confidence score and an explicit hypothesis disclaimer.
- Repository analysis is read-only and does not clone, execute, edit, commit, or open external issues.
- External handoff requires an explicit user action and remains simulated in demo mode.

These controls demonstrate the intended boundary, but they do not replace a production security review, tenant authorization model, audit log, retention policy, rate limiting, or data-loss-prevention program.

## Demo walkthrough

1. Create an account or sign in.
2. Open `ESC-1042` from the dashboard.
3. Compare the original report with its repository analysis and cited evidence.
4. Open the engineering ticket and edit a section in the review pane.
5. Copy the ticket or export it as Markdown or JSON.
6. Approve the ticket, then explicitly mark it sent to engineering.
7. Create a new escalation to exercise intake validation, attachments, analysis, and fresh ticket generation.
8. Visit Repositories and Settings to review evidence and provider boundaries.

## Current limitations

- Escalation workflow state is session-local and resets on refresh; user accounts and login sessions are persistent.
- Repository content comes from curated demo snapshots rather than a live GitHub or GitLab installation.
- The demo matcher is deterministic and does not call a large language model.
- Attachment contents are not uploaded, parsed, or retained.
- Jira, Linear, and GitHub delivery remains a copy/download flow rather than direct issue creation.
- Organizations, roles, rate limiting, password recovery, MFA, audit logs, and account administration are not yet implemented.
- Status history, comments, assignments, SLAs, and ticket revisions are not persisted.

## Roadmap

1. Persist escalations, analysis runs, evidence, revisions, and status history in tenant-aware D1 tables.
2. Add organizations, role-based access control, password recovery, optional MFA, rate limiting, and an append-only audit log.
3. Add a read-only GitHub App with allowlisted repositories, ref pinning, secret scanning, and incremental indexing.
4. Implement a server-side AI adapter with structured output validation, timeouts, cost controls, and prompt/version observability.
5. Add attachment malware scanning, text extraction, retention controls, and customer-data classification.
6. Add permissioned Jira, Linear, and GitHub delivery with field mapping, idempotency, and reconciliation.
7. Expand browser-level accessibility and regression testing across intake, analysis, editing, approval, and export flows.
