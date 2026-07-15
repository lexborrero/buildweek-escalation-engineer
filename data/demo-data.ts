import { analyzeEscalation } from "@/lib/repository-analysis";
import { generateEngineeringTicket } from "@/lib/ticket-generation";
import type { Escalation, RepositorySnapshot } from "@/types/domain";

export const DEMO_REPOSITORIES: RepositorySnapshot[] = [
  {
    id: "repo-atlas-billing",
    name: "atlas-billing-platform",
    description:
      "TypeScript billing service for subscriptions, payment attempts, provider webhooks, and invoice reconciliation.",
    provider: "GitHub",
    owner: "Northstar Systems",
    defaultBranch: "main",
    indexedCommit: "8f2c1a7",
    lastIndexedAt: "2026-07-14T17:42:00.000Z",
    primaryLanguage: "TypeScript",
    visibility: "Private",
    status: "Indexed",
    directories: 42,
    indexedFiles: 684,
    files: [
      {
        path: "src/services/payments/retry-payment.ts",
        symbol: "retryPayment",
        kind: "service",
        language: "TypeScript",
        lines: "L42–L91",
        excerpt:
          "for (let attempt = 0; attempt < maxAttempts; attempt++) { const idempotencyKey = createIdempotencyKey(invoiceId, attempt); return provider.charge({ invoiceId, idempotencyKey }); }",
        description:
          "Owns payment timeout retries and derives a provider idempotency key for every attempt.",
        tags: [
          "payment",
          "retry",
          "charge",
          "timeout",
          "duplicate",
          "idempotency",
        ],
      },
      {
        path: "src/services/payments/idempotency.ts",
        symbol: "createIdempotencyKey",
        kind: "service",
        language: "TypeScript",
        lines: "L11–L28",
        excerpt:
          "export function createIdempotencyKey(invoiceId: string, attempt: number) { return `invoice:${invoiceId}:attempt:${attempt}`; }",
        description:
          "Builds the external payment idempotency key from invoice and attempt identifiers.",
        tags: [
          "payment",
          "retry",
          "charge",
          "invoice",
          "idempotency",
          "duplicate",
        ],
      },
      {
        path: "src/webhooks/stripe/handle-invoice.ts",
        symbol: "handleInvoicePaid",
        kind: "api",
        language: "TypeScript",
        lines: "L67–L128",
        excerpt:
          "const existing = await invoiceAttempts.findByProviderCharge(event.chargeId); if (!existing) await invoiceAttempts.markPaid(event.invoiceId, event.chargeId);",
        description:
          "Reconciles asynchronous provider invoice events using the returned provider charge ID.",
        tags: [
          "stripe",
          "webhook",
          "invoice",
          "payment",
          "duplicate",
          "reconciliation",
        ],
      },
      {
        path: "prisma/schema.prisma",
        symbol: "InvoiceAttempt",
        kind: "model",
        language: "Prisma",
        lines: "L214–L239",
        excerpt:
          "model InvoiceAttempt { id String @id invoiceId String attempt Int providerChargeId String? @unique status AttemptStatus @@index([invoiceId]) }",
        description:
          "Persists billing attempts; uniqueness is enforced on providerChargeId only after the provider responds.",
        tags: ["model", "invoice", "attempt", "charge", "unique", "duplicate"],
      },
      {
        path: "src/api/invoices/[invoiceId]/retry.ts",
        symbol: "POST",
        kind: "api",
        language: "TypeScript",
        lines: "L18–L66",
        excerpt:
          "export async function POST(request: Request, context: InvoiceContext) { await requireBillingRole(request); return retryPayment(context.invoiceId); }",
        description:
          "Authorized support endpoint that initiates a manual invoice payment retry.",
        tags: ["api", "invoice", "retry", "support", "payment"],
      },
      {
        path: "tests/payments/retry-payment.integration.test.ts",
        symbol: "retryPayment",
        kind: "test",
        language: "TypeScript",
        lines: "L31–L118",
        excerpt:
          "it('retries a timed out provider request', async () => { provider.charge.mockRejectedValueOnce(timeout).mockResolvedValue(success); expect(provider.charge).toHaveBeenCalledTimes(2); });",
        description:
          "Covers timeout retries but does not assert that provider attempts share one logical idempotency key.",
        tags: [
          "test",
          "payment",
          "retry",
          "timeout",
          "idempotency",
          "duplicate",
        ],
      },
      {
        path: "tests/webhooks/handle-invoice.test.ts",
        symbol: "handleInvoicePaid",
        kind: "test",
        language: "TypeScript",
        lines: "L44–L102",
        excerpt:
          "it('ignores an already recorded charge id', async () => { await handleInvoicePaid(event); expect(markPaid).not.toHaveBeenCalled(); });",
        description:
          "Verifies duplicate webhook handling for the same provider charge ID.",
        tags: ["test", "webhook", "invoice", "duplicate", "charge"],
      },
      {
        path: "docs/operations/payment-retries.md",
        symbol: "Timeout recovery",
        kind: "docs",
        language: "Markdown",
        lines: "L22–L58",
        excerpt:
          "On provider timeout, the worker retries up to two times. Operators should use the invoice retry endpoint only after reconciliation completes.",
        description:
          "Documents retry behavior and the operational timing requirement for manual attempts.",
        tags: ["docs", "payment", "retry", "timeout", "operator"],
      },
      {
        path: "docs/architecture/billing-lifecycle.md",
        symbol: "Payment attempt lifecycle",
        kind: "docs",
        language: "Markdown",
        lines: "L41–L89",
        excerpt:
          "API request → payment worker → provider charge → webhook reconciliation → invoice ledger.",
        description:
          "Describes the payment request, provider, webhook, and ledger boundaries.",
        tags: ["docs", "architecture", "invoice", "payment", "webhook"],
      },
    ],
  },
  {
    id: "repo-customer-console",
    name: "customer-console",
    description:
      "React customer portal with identity, account management, and organization administration flows.",
    provider: "GitHub",
    owner: "Northstar Systems",
    defaultBranch: "main",
    indexedCommit: "2b791de",
    lastIndexedAt: "2026-07-14T16:18:00.000Z",
    primaryLanguage: "TypeScript",
    visibility: "Private",
    status: "Indexed",
    directories: 31,
    indexedFiles: 512,
    files: [
      {
        path: "src/auth/use-session-refresh.ts",
        symbol: "useSessionRefresh",
        kind: "service",
        language: "TypeScript",
        lines: "L18–L73",
        excerpt:
          "const refresh = async () => { const next = await authClient.refresh(); setSession(next); };",
        description:
          "Refreshes an expiring browser session and commits it to client state.",
        tags: ["session", "auth", "login", "refresh", "expired", "token"],
      },
      {
        path: "src/routing/require-session.tsx",
        symbol: "RequireSession",
        kind: "service",
        language: "TypeScript",
        lines: "L29–L81",
        excerpt:
          "if (!session || session.expiresAt <= Date.now()) return <Navigate to='/login' replace />;",
        description:
          "Guards protected routes using the currently committed session value.",
        tags: ["session", "auth", "login", "route", "redirect", "expired"],
      },
      {
        path: "src/api/auth-client.ts",
        symbol: "refresh",
        kind: "api",
        language: "TypeScript",
        lines: "L52–L88",
        excerpt:
          "return fetch('/api/session/refresh', { method: 'POST', credentials: 'include' });",
        description:
          "Calls the session refresh API with secure browser credentials.",
        tags: ["session", "auth", "api", "refresh", "login"],
      },
      {
        path: "tests/auth/session-refresh.test.tsx",
        symbol: "RequireSession",
        kind: "test",
        language: "TypeScript",
        lines: "L24–L97",
        excerpt:
          "it('redirects an expired session', async () => { render(<RequireSession />); expect(navigate).toHaveBeenCalledWith('/login'); });",
        description:
          "Tests expired sessions but not a refresh and route-guard race.",
        tags: ["test", "session", "auth", "redirect", "refresh"],
      },
      {
        path: "docs/authentication/session-lifecycle.md",
        symbol: "Refresh lifecycle",
        kind: "docs",
        language: "Markdown",
        lines: "L33–L74",
        excerpt:
          "Sessions refresh two minutes before expiry and protected routes require a valid token.",
        description: "Documents the intended session refresh lifecycle.",
        tags: ["docs", "session", "auth", "refresh", "token"],
      },
    ],
  },
  {
    id: "repo-events-pipeline",
    name: "events-pipeline",
    description:
      "Go ingestion and delivery pipeline for customer events, queues, transformations, and destinations.",
    provider: "Local snapshot",
    owner: "Northstar Systems",
    defaultBranch: "main",
    indexedCommit: "c112f90",
    lastIndexedAt: "2026-07-13T22:05:00.000Z",
    primaryLanguage: "Go",
    visibility: "Internal",
    status: "Indexed",
    directories: 28,
    indexedFiles: 401,
    files: [
      {
        path: "internal/delivery/worker.go",
        symbol: "Worker.Deliver",
        kind: "service",
        language: "Go",
        lines: "L88–L164",
        excerpt:
          "func (w *Worker) Deliver(ctx context.Context, event Event) error { return w.destinations.Send(ctx, event) }",
        description: "Coordinates event delivery and retry classification.",
        tags: ["event", "delivery", "retry", "destination", "timeout"],
      },
      {
        path: "internal/queue/consumer.go",
        symbol: "Consumer.Handle",
        kind: "service",
        language: "Go",
        lines: "L41–L119",
        excerpt:
          "if err := c.worker.Deliver(ctx, event); err != nil { return c.retry(event, err) }",
        description:
          "Consumes queued events and routes failures to retry handling.",
        tags: ["event", "queue", "consumer", "retry", "delivery"],
      },
      {
        path: "internal/delivery/worker_test.go",
        symbol: "TestWorkerDeliver",
        kind: "test",
        language: "Go",
        lines: "L26–L96",
        excerpt:
          "func TestWorkerDeliver(t *testing.T) { /* destination success and timeout cases */ }",
        description: "Covers successful and timed-out destination delivery.",
        tags: ["test", "event", "delivery", "timeout", "retry"],
      },
      {
        path: "docs/runbooks/delivery-lag.md",
        symbol: "Queue lag triage",
        kind: "docs",
        language: "Markdown",
        lines: "L12–L63",
        excerpt:
          "Check consumer lag, destination health, and retry queue age before increasing concurrency.",
        description:
          "Operational runbook for delivery delays and retry backlog.",
        tags: ["docs", "event", "delivery", "queue", "lag", "retry"],
      },
    ],
  },
];

const primaryEscalation: Escalation = {
  id: "ESC-1042",
  organization: "Apex Health",
  title: "Checkout retry created duplicate subscription charges",
  description:
    "A payment request that times out during annual plan checkout is retried and can produce two successful provider charges for one invoice.",
  severity: "Critical",
  urgency: "Immediate",
  customerImpact:
    "23 subscription customers were charged twice. Finance has paused automated retry operations while refunds are processed, blocking new annual-plan conversions.",
  expectedBehavior:
    "A timed-out payment may be retried, but every attempt for the same invoice must resolve to one provider charge and one paid ledger entry.",
  observedBehavior:
    "The first provider request completes after the application times out. The automatic retry uses a second idempotency key, and both requests are accepted before webhook reconciliation runs.",
  reproductionSteps: [
    "Create an unpaid annual subscription invoice in the staging tenant.",
    "Configure the payment provider stub to commit the charge but delay its response for 31 seconds.",
    "Submit checkout and allow the worker to retry after the client timeout.",
    "Inspect provider requests and observe two successful charges with different idempotency keys.",
  ],
  logs: "2026-07-14T14:03:12Z WARN payment timeout invoice=inv_demo_482 attempt=0 correlation=req_9182\n2026-07-14T14:03:13Z INFO payment retry invoice=inv_demo_482 attempt=1 correlation=req_9182\n2026-07-14T14:03:15Z INFO invoice paid invoice=inv_demo_482 provider_charges=2",
  attachments: [
    {
      id: "att-1",
      name: "sanitized-provider-timeline.txt",
      type: "text/plain",
      size: "14 KB",
      scanStatus: "Safe",
    },
    {
      id: "att-2",
      name: "checkout-reproduction.har",
      type: "application/json",
      size: "248 KB",
      scanStatus: "Safe",
    },
  ],
  repositoryId: "repo-atlas-billing",
  status: "Ready for Review",
  createdAt: "2026-07-14T14:12:00.000Z",
  updatedAt: "2026-07-14T17:51:00.000Z",
  reporter: "Maya Chen",
};

const primaryAnalysis = analyzeEscalation(
  primaryEscalation,
  DEMO_REPOSITORIES[0],
  {
    generatedAt: "2026-07-14T17:49:00.000Z",
    provider: "Demo provider · deterministic repository matcher",
  },
);

primaryEscalation.analysis = primaryAnalysis;
primaryEscalation.ticket = generateEngineeringTicket(
  primaryEscalation,
  primaryAnalysis,
  "2026-07-14T17:51:00.000Z",
);

export const DEMO_ESCALATIONS: Escalation[] = [
  primaryEscalation,
  {
    id: "ESC-1041",
    organization: "Orchid Financial",
    title: "Users redirected to login during active sessions",
    description:
      "Users navigating between organization settings pages are intermittently redirected to login even though session refresh succeeds.",
    severity: "High",
    urgency: "High",
    customerImpact:
      "Administrators lose unsaved organization settings and must repeat their work.",
    expectedBehavior:
      "An active session refresh should keep protected routes available.",
    observedBehavior:
      "The route guard redirects to login milliseconds before the refreshed session is stored.",
    reproductionSteps: [
      "Sign in with a session that expires within two minutes.",
      "Open organization settings and navigate between tabs during refresh.",
    ],
    logs: "Browser trace requested; correlation ID not yet provided.",
    attachments: [],
    repositoryId: "repo-customer-console",
    status: "Needs Information",
    createdAt: "2026-07-14T12:24:00.000Z",
    updatedAt: "2026-07-14T16:02:00.000Z",
    reporter: "Jon Bell",
  },
  {
    id: "ESC-1039",
    organization: "Beacon Retail",
    title: "EU destination events delayed by retry backlog",
    description:
      "A slow destination caused retry backlog growth and elevated delivery latency for EU tenants.",
    severity: "High",
    urgency: "Standard",
    customerImpact:
      "Event delivery was delayed by up to 47 minutes for 18 EU workspaces.",
    expectedBehavior:
      "One degraded destination should not delay unrelated tenant deliveries.",
    observedBehavior:
      "Consumer capacity is shared across normal and retry queues.",
    reproductionSteps: [
      "Configure one destination to respond in 25 seconds.",
      "Send a sustained event batch and observe normal queue lag.",
    ],
    logs: "queue=eu-retry oldest_age=2820s normal_lag=19240",
    attachments: [],
    repositoryId: "repo-events-pipeline",
    status: "Sent to Engineering",
    createdAt: "2026-07-13T18:46:00.000Z",
    updatedAt: "2026-07-14T11:18:00.000Z",
    reporter: "Sam Rivera",
  },
  {
    id: "ESC-1037",
    organization: "Vela Logistics",
    title: "Invoice retry action remains enabled after payment",
    description:
      "The support console can show a stale retry action briefly after webhook reconciliation.",
    severity: "Medium",
    urgency: "Standard",
    customerImpact: "Support agents may attempt a redundant payment retry.",
    expectedBehavior:
      "The retry control should disable after payment reconciliation.",
    observedBehavior:
      "The action remains enabled until the invoice cache refreshes.",
    reproductionSteps: [
      "Open an unpaid invoice.",
      "Complete payment in another tab.",
    ],
    logs: "No errors. UI cache age was 58 seconds.",
    attachments: [],
    repositoryId: "repo-atlas-billing",
    status: "Approved",
    createdAt: "2026-07-12T15:08:00.000Z",
    updatedAt: "2026-07-13T09:44:00.000Z",
    reporter: "Maya Chen",
  },
  {
    id: "ESC-1034",
    organization: "Lumen Labs",
    title: "Organization switcher shows stale permissions",
    description:
      "Switching between organizations can temporarily retain permissions from the prior session scope.",
    severity: "Medium",
    urgency: "High",
    customerImpact:
      "Users see actions they cannot complete for several seconds.",
    expectedBehavior:
      "Permissions should update atomically with organization context.",
    observedBehavior:
      "Navigation updates before the permission query finishes.",
    reproductionSteps: [
      "Open organization A.",
      "Switch rapidly to organization B.",
    ],
    logs: "permission_query duration_ms=1840 cache_hit=false",
    attachments: [],
    repositoryId: "repo-customer-console",
    status: "Analyzing",
    createdAt: "2026-07-11T21:19:00.000Z",
    updatedAt: "2026-07-14T17:38:00.000Z",
    reporter: "Jon Bell",
  },
  {
    id: "ESC-1028",
    organization: "Cedar Analytics",
    title: "Webhook signature errors after key rotation",
    description:
      "A subset of webhook deliveries failed validation during a signing-key rotation window.",
    severity: "Low",
    urgency: "Low",
    customerImpact: "Seven non-critical test events required manual replay.",
    expectedBehavior:
      "Old and new signing keys should overlap during rotation.",
    observedBehavior:
      "The previous key was removed before all workers refreshed configuration.",
    reproductionSteps: [
      "Rotate the signing key.",
      "Send an event to a worker with stale config.",
    ],
    logs: "signature_invalid worker=delivery-07 key_version=previous",
    attachments: [],
    repositoryId: "repo-events-pipeline",
    status: "Resolved",
    createdAt: "2026-07-08T09:14:00.000Z",
    updatedAt: "2026-07-10T14:35:00.000Z",
    reporter: "Sam Rivera",
  },
  {
    id: "ESC-1043",
    organization: "Quarry Works",
    title: "Billing receipt omits purchase order reference",
    description:
      "Downloaded annual-plan receipts omit a purchase order reference present on the invoice.",
    severity: "Low",
    urgency: "Standard",
    customerImpact:
      "Finance teams manually annotate receipts before reconciliation.",
    expectedBehavior: "Receipts include the invoice purchase order reference.",
    observedBehavior:
      "The generated PDF leaves the purchase order field blank.",
    reproductionSteps: [
      "Create an invoice with a PO reference.",
      "Download its receipt.",
    ],
    logs: "receipt_template po_reference=null invoice_po=PO-TEST-104",
    attachments: [],
    repositoryId: "repo-atlas-billing",
    status: "New",
    createdAt: "2026-07-14T18:06:00.000Z",
    updatedAt: "2026-07-14T18:06:00.000Z",
    reporter: "Maya Chen",
  },
];
