"use client";

import { useEffect, useMemo, useState } from "react";
import { DEMO_ESCALATIONS, DEMO_REPOSITORIES } from "@/data/demo-data";
import { ticketToJson, ticketToMarkdown } from "@/lib/ticket-generation";
import { validateEscalationDraft, type DraftErrors } from "@/lib/validation";
import { transitionStatus } from "@/lib/workflow";
import { createAiProvider } from "@/services/ai-provider";
import type {
  AiSettings,
  Attachment,
  EngineeringTicket,
  Escalation,
  EscalationDraft,
  EscalationStatus,
  RepositoryEvidence,
  RepositorySnapshot,
  Severity,
} from "@/types/domain";

type Screen =
  | "dashboard"
  | "new"
  | "repository"
  | "analyzing"
  | "review"
  | "detail"
  | "settings";

const EMPTY_DRAFT: EscalationDraft = {
  organization: "",
  title: "",
  description: "",
  severity: "High",
  urgency: "High",
  customerImpact: "",
  expectedBehavior: "",
  observedBehavior: "",
  reproductionSteps: "",
  logs: "",
  repositoryId: "repo-atlas-billing",
};

const DEFAULT_SETTINGS: AiSettings = {
  provider: "Demo provider",
  model: "Repository evidence model",
  apiKeyPresent: false,
  redactSensitiveData: true,
  minimumEvidenceCount: 2,
};

const ANALYSIS_STAGES = [
  {
    label: "Sanitizing report",
    detail: "Removing credentials and customer identifiers",
  },
  {
    label: "Mapping repository",
    detail: "Locating relevant paths, symbols, models, and APIs",
  },
  {
    label: "Correlating evidence",
    detail: "Comparing observed behavior with implementation paths",
  },
  {
    label: "Checking coverage",
    detail: "Finding related tests, docs, risks, and missing context",
  },
  {
    label: "Drafting ticket",
    detail: "Building an implementation-ready engineering brief",
  },
];

const ICONS: Record<string, string> = {
  dashboard: "▦",
  new: "+",
  repository: "⌘",
  settings: "⚙",
  search: "⌕",
  ticket: "↗",
  copy: "⧉",
  download: "↓",
  check: "✓",
  clock: "◷",
  shield: "◆",
  menu: "☰",
  close: "×",
  chevron: "›",
  branch: "⑂",
  file: "≡",
  info: "i",
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <span className="icon" aria-hidden="true">
      {ICONS[name]}
    </span>
  );
}

function formatDate(value: string, includeTime = true) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function statusClass(status: EscalationStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function StatusBadge({ status }: { status: EscalationStatus }) {
  return (
    <span className={`badge status-badge ${statusClass(status)}`}>
      <span className="badge-dot" />
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge severity-badge ${severity.toLowerCase()}`}>
      {severity}
    </span>
  );
}

function Avatar({ name, tone = "blue" }: { name: string; tone?: string }) {
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
  return (
    <span className={`avatar ${tone}`} title={name} aria-label={name}>
      {initials}
    </span>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {action ? <div className="section-actions">{action}</div> : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name="info" />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function EscalationEngineerApp() {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [navOpen, setNavOpen] = useState(false);
  const [escalations, setEscalations] = useState<Escalation[]>(() =>
    structuredClone(DEMO_ESCALATIONS),
  );
  const [selectedId, setSelectedId] = useState("ESC-1042");
  const [selectedRepositoryId, setSelectedRepositoryId] =
    useState("repo-atlas-billing");
  const [draft, setDraft] = useState<EscalationDraft>(EMPTY_DRAFT);
  const [draftErrors, setDraftErrors] = useState<DraftErrors>({});
  const [draftAttachments, setDraftAttachments] = useState<Attachment[]>([]);
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [settingsDraft, setSettingsDraft] =
    useState<AiSettings>(DEFAULT_SETTINGS);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [analysisStage, setAnalysisStage] = useState(0);
  const [analysisError, setAnalysisError] = useState("");
  const [toast, setToast] = useState("");
  const [detailTab, setDetailTab] = useState<"report" | "analysis" | "ticket">(
    "report",
  );

  const selectedEscalation = useMemo(
    () => escalations.find((item) => item.id === selectedId) ?? escalations[0],
    [escalations, selectedId],
  );
  const selectedRepository = useMemo(
    () =>
      DEMO_REPOSITORIES.find((item) => item.id === selectedRepositoryId) ??
      DEMO_REPOSITORIES[0],
    [selectedRepositoryId],
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (screen !== "analyzing") return;
    const escalation = escalations.find((item) => item.id === selectedId);
    if (!escalation || escalation.analysis || escalation.status !== "Analyzing")
      return;
    const activeEscalation = escalation;

    let cancelled = false;
    const wait = (duration: number) =>
      new Promise<void>((resolve) => window.setTimeout(resolve, duration));

    async function runAnalysis() {
      try {
        setAnalysisError("");
        for (let index = 0; index < ANALYSIS_STAGES.length; index += 1) {
          if (cancelled) return;
          setAnalysisStage(index);
          await wait(index === 0 ? 750 : 620);
        }

        const repository = DEMO_REPOSITORIES.find(
          (item) => item.id === activeEscalation.repositoryId,
        );
        if (!repository)
          throw new Error("The selected repository snapshot is unavailable.");

        const provider = createAiProvider(settings.provider);
        const result = await provider.analyze(activeEscalation, repository);
        if (cancelled) return;

        setEscalations((items) =>
          items.map((item) =>
            item.id === activeEscalation.id
              ? {
                  ...item,
                  status: transitionStatus(item.status, "Ready for Review"),
                  analysis: result.analysis,
                  ticket: result.ticket,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        setScreen("review");
        setToast("Repository analysis complete. Ticket is ready for review.");
      } catch (error) {
        if (cancelled) return;
        setAnalysisError(
          error instanceof Error ? error.message : "Analysis failed.",
        );
      }
    }

    void runAnalysis();
    return () => {
      cancelled = true;
    };
    // The selected record is intentionally captured when analysis begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, selectedId, settings.provider]);

  function navigate(next: Screen) {
    setScreen(next);
    setNavOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showEscalation(id: string, target: "detail" | "review" = "detail") {
    const escalation = escalations.find((item) => item.id === id);
    if (!escalation) return;
    setSelectedId(id);
    setSelectedRepositoryId(escalation.repositoryId);
    setDetailTab("report");
    navigate(target === "review" && escalation.ticket ? "review" : "detail");
  }

  function updateDraft<K extends keyof EscalationDraft>(
    field: K,
    value: EscalationDraft[K],
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (draftErrors[field]) {
      setDraftErrors((current) => ({ ...current, [field]: undefined }));
    }
  }

  function buildEscalation(status: "New" | "Analyzing"): Escalation {
    const highestId = Math.max(
      ...escalations.map((item) => Number(item.id.replace("ESC-", ""))),
    );
    const now = new Date().toISOString();
    return {
      id: `ESC-${highestId + 1}`,
      ...draft,
      organization: draft.organization.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      customerImpact: draft.customerImpact.trim(),
      expectedBehavior: draft.expectedBehavior.trim(),
      observedBehavior: draft.observedBehavior.trim(),
      reproductionSteps: draft.reproductionSteps
        .split(/\r?\n/)
        .map((step) => step.trim())
        .filter(Boolean),
      logs: draft.logs.trim(),
      attachments: draftAttachments,
      status,
      createdAt: now,
      updatedAt: now,
      reporter: "Alex Morgan",
    };
  }

  function submitDraft(mode: "save" | "analyze") {
    const errors = validateEscalationDraft(draft);
    setDraftErrors(errors);
    if (Object.keys(errors).length) {
      setToast("Please complete the highlighted fields before continuing.");
      document.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
      return;
    }

    const escalation = buildEscalation(
      mode === "analyze" ? "Analyzing" : "New",
    );
    setEscalations((items) => [escalation, ...items]);
    setSelectedId(escalation.id);
    setSelectedRepositoryId(escalation.repositoryId);
    setDraft(EMPTY_DRAFT);
    setDraftAttachments([]);
    setDraftErrors({});

    if (mode === "analyze") {
      setAnalysisStage(0);
      navigate("analyzing");
    } else {
      navigate("detail");
      setToast(`${escalation.id} saved as a new escalation.`);
    }
  }

  function updateTicket(patch: Partial<EngineeringTicket>) {
    setEscalations((items) =>
      items.map((item) =>
        item.id === selectedId && item.ticket
          ? {
              ...item,
              ticket: {
                ...item.ticket,
                ...patch,
                lastEditedAt: new Date().toISOString(),
              },
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
  }

  function approveTicket() {
    setEscalations((items) =>
      items.map((item) =>
        item.id === selectedId && item.status === "Ready for Review"
          ? {
              ...item,
              status: transitionStatus(item.status, "Approved"),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setToast("Ticket approved. No external issue was created.");
  }

  function sendToEngineering() {
    setEscalations((items) =>
      items.map((item) =>
        item.id === selectedId && item.status === "Approved"
          ? {
              ...item,
              status: transitionStatus(item.status, "Sent to Engineering"),
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    setToast(
      "Marked as sent to engineering. External connectors remain disabled in demo mode.",
    );
  }

  async function copyTicket() {
    if (!selectedEscalation.ticket) return;
    try {
      await navigator.clipboard.writeText(
        ticketToMarkdown(selectedEscalation.ticket),
      );
      setToast("Markdown ticket copied to your clipboard.");
    } catch {
      setToast("Clipboard access was blocked. Use Markdown export instead.");
    }
  }

  function exportTicket(format: "markdown" | "json") {
    if (!selectedEscalation.ticket) return;
    const isMarkdown = format === "markdown";
    const content = isMarkdown
      ? ticketToMarkdown(selectedEscalation.ticket)
      : ticketToJson(selectedEscalation.ticket);
    const blob = new Blob([content], {
      type: isMarkdown
        ? "text/markdown;charset=utf-8"
        : "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${selectedEscalation.id.toLowerCase()}-engineering-ticket.${isMarkdown ? "md" : "json"}`;
    link.click();
    URL.revokeObjectURL(url);
    setToast(`${isMarkdown ? "Markdown" : "JSON"} export created.`);
  }

  function saveSettings() {
    setSettings({
      ...settingsDraft,
      apiKeyPresent: Boolean(apiKeyDraft) || settings.apiKeyPresent,
    });
    setApiKeyDraft("");
    setToast(
      settingsDraft.provider === "Demo provider"
        ? "Demo analysis settings saved for this session."
        : "Provider preference saved. A server-side connector is still required for live analysis.",
    );
  }

  const pageMeta: Record<Screen, { title: string; description: string }> = {
    dashboard: {
      title: "Escalation command center",
      description:
        "Turn customer context into repository-backed engineering action.",
    },
    new: {
      title: "Create escalation",
      description:
        "Capture support context and select the codebase engineering should inspect.",
    },
    repository: {
      title: "Repository context",
      description:
        "Review the read-only code snapshot available to ticket analysis.",
    },
    analyzing: {
      title: "Analyzing escalation",
      description:
        "Correlating sanitized support context with repository evidence.",
    },
    review: {
      title: "Ticket review",
      description:
        "Validate the evidence, edit the engineering brief, then approve it.",
    },
    detail: {
      title: selectedEscalation.id,
      description: selectedEscalation.title,
    },
    settings: {
      title: "Settings",
      description:
        "Configure repositories, evidence controls, and AI providers.",
    },
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside
        className={`sidebar ${navOpen ? "open" : ""}`}
        aria-label="Primary navigation"
      >
        <div className="brand-row">
          <button
            className="brand"
            onClick={() => navigate("dashboard")}
            aria-label="Home"
          >
            <span className="brand-mark">E</span>
            <span>
              <strong>Escalation</strong>
              <small>ENGINEER</small>
            </span>
          </button>
          <button
            className="icon-button sidebar-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <Icon name="close" />
          </button>
        </div>

        <button
          className="primary-button create-button"
          onClick={() => navigate("new")}
        >
          <Icon name="new" />
          New escalation
        </button>

        <nav>
          <p className="nav-label">Workspace</p>
          <button
            className={screen === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            <Icon name="dashboard" /> Dashboard
          </button>
          <button
            className={screen === "new" ? "active" : ""}
            onClick={() => navigate("new")}
          >
            <Icon name="ticket" /> Escalations
            <span className="nav-count">
              {escalations.filter((item) => item.status !== "Resolved").length}
            </span>
          </button>
          <button
            className={screen === "repository" ? "active" : ""}
            onClick={() => navigate("repository")}
          >
            <Icon name="repository" /> Repositories
            <span className="nav-count">{DEMO_REPOSITORIES.length}</span>
          </button>
          <button
            className={screen === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Icon name="settings" /> Settings
          </button>
        </nav>

        <div className="sidebar-spacer" />
        <div className="demo-card">
          <span className="demo-chip">DEMO MODE</span>
          <p>Repository-aware analysis works without credentials.</p>
          <button onClick={() => navigate("settings")}>
            Configure provider <Icon name="chevron" />
          </button>
        </div>
        <div className="user-card">
          <Avatar name="Alex Morgan" />
          <span>
            <strong>Alex Morgan</strong>
            <small>Support engineering</small>
          </span>
          <span className="presence" title="Online" />
        </div>
      </aside>

      {navOpen ? (
        <button
          className="nav-scrim"
          onClick={() => setNavOpen(false)}
          aria-label="Close navigation"
        />
      ) : null}

      <div className="main-column">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" />
          </button>
          <div className="page-title">
            <h1>{pageMeta[screen].title}</h1>
            <p>{pageMeta[screen].description}</p>
          </div>
          <div className="topbar-actions">
            <button
              className="search-button"
              onClick={() =>
                setToast("Search is scoped to loaded demo records.")
              }
            >
              <Icon name="search" />
              <span>Search escalations</span>
              <kbd>⌘ K</kbd>
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() => setToast("You have no new notifications.")}
            >
              <span aria-hidden="true">◌</span>
            </button>
            <Avatar name="Alex Morgan" />
          </div>
        </header>

        <main id="main-content" className="content" tabIndex={-1}>
          {screen === "dashboard" ? (
            <Dashboard
              escalations={escalations}
              onOpen={showEscalation}
              onCreate={() => navigate("new")}
            />
          ) : null}
          {screen === "new" ? (
            <IntakeForm
              draft={draft}
              errors={draftErrors}
              attachments={draftAttachments}
              onChange={updateDraft}
              onAttachments={setDraftAttachments}
              onSave={() => submitDraft("save")}
              onAnalyze={() => submitDraft("analyze")}
              onCancel={() => navigate("dashboard")}
            />
          ) : null}
          {screen === "repository" ? (
            <RepositoryContext
              repositories={DEMO_REPOSITORIES}
              selected={selectedRepository}
              onSelect={setSelectedRepositoryId}
              onToast={setToast}
            />
          ) : null}
          {screen === "analyzing" ? (
            <AnalysisLoading
              escalation={selectedEscalation}
              repository={
                DEMO_REPOSITORIES.find(
                  (item) => item.id === selectedEscalation.repositoryId,
                ) ?? DEMO_REPOSITORIES[0]
              }
              stage={analysisStage}
              error={analysisError}
              onUseDemo={() => {
                setSettings((current) => ({
                  ...current,
                  provider: "Demo provider",
                }));
                setAnalysisError("");
              }}
              onCancel={() => navigate("detail")}
            />
          ) : null}
          {screen === "review" ? (
            <TicketReview
              escalation={selectedEscalation}
              onUpdate={updateTicket}
              onApprove={approveTicket}
              onSend={sendToEngineering}
              onCopy={copyTicket}
              onExport={exportTicket}
              onDetail={() => navigate("detail")}
            />
          ) : null}
          {screen === "detail" ? (
            <EscalationDetail
              escalation={selectedEscalation}
              repository={
                DEMO_REPOSITORIES.find(
                  (item) => item.id === selectedEscalation.repositoryId,
                ) ?? DEMO_REPOSITORIES[0]
              }
              tab={detailTab}
              onTab={setDetailTab}
              onReview={() => navigate("review")}
              onAnalyze={() => {
                if (selectedEscalation.status === "New") {
                  setEscalations((items) =>
                    items.map((item) =>
                      item.id === selectedId
                        ? {
                            ...item,
                            status: transitionStatus(item.status, "Analyzing"),
                          }
                        : item,
                    ),
                  );
                  setAnalysisStage(0);
                  navigate("analyzing");
                }
              }}
              onRepository={() => {
                setSelectedRepositoryId(selectedEscalation.repositoryId);
                navigate("repository");
              }}
            />
          ) : null}
          {screen === "settings" ? (
            <Settings
              settings={settingsDraft}
              apiKey={apiKeyDraft}
              onChange={setSettingsDraft}
              onApiKey={setApiKeyDraft}
              onSave={saveSettings}
              onToast={setToast}
            />
          ) : null}
        </main>
      </div>

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <Icon name="check" /> {toast}
        </div>
      ) : null}
    </div>
  );
}

function Dashboard({
  escalations,
  onOpen,
  onCreate,
}: {
  escalations: Escalation[];
  onOpen: (id: string, target?: "detail" | "review") => void;
  onCreate: () => void;
}) {
  const active = escalations.filter((item) => item.status !== "Resolved");
  const ready = escalations.filter(
    (item) => item.status === "Ready for Review",
  );
  const critical = escalations.filter((item) => item.severity === "Critical");
  const severityCounts = (
    ["Critical", "High", "Medium", "Low"] as Severity[]
  ).map((severity) => ({
    severity,
    count: escalations.filter((item) => item.severity === severity).length,
  }));
  const statusCounts = [
    "New",
    "Analyzing",
    "Needs Information",
    "Ready for Review",
    "Approved",
    "Sent to Engineering",
  ].map((status) => ({
    status: status as EscalationStatus,
    count: escalations.filter((item) => item.status === status).length,
  }));

  return (
    <div className="screen-stack dashboard-screen">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">Tuesday, July 14</p>
          <h2>Good evening, Alex.</h2>
          <p>
            {ready.length} ticket is ready for review and {active.length}{" "}
            escalations need attention.
          </p>
        </div>
        <button className="primary-button" onClick={onCreate}>
          <Icon name="new" /> Create escalation
        </button>
      </div>

      <section className="metric-grid" aria-label="Escalation overview">
        <MetricCard
          label="Open escalations"
          value={String(active.length)}
          detail="Across 6 customers"
          trend="+2 this week"
          icon="ticket"
          tone="blue"
        />
        <MetricCard
          label="Critical severity"
          value={String(critical.length)}
          detail="Requires immediate action"
          trend="23 customers impacted"
          icon="shield"
          tone="red"
        />
        <MetricCard
          label="Ready for review"
          value={String(ready.length)}
          detail="Engineering tickets drafted"
          trend="Evidence attached"
          icon="check"
          tone="green"
        />
        <MetricCard
          label="Median analysis"
          value="3m 42s"
          detail="Last 30 escalations"
          trend="18% faster"
          icon="clock"
          tone="violet"
        />
      </section>

      <div className="dashboard-grid">
        <section className="card severity-card">
          <SectionHeading
            title="Severity distribution"
            description="Current workload by customer impact"
            action={<button className="text-button">Last 30 days⌄</button>}
          />
          <div className="severity-bars">
            {severityCounts.map((item) => (
              <div className="severity-row" key={item.severity}>
                <span>{item.severity}</span>
                <div className="bar-track">
                  <span
                    className={`bar-fill ${item.severity.toLowerCase()}`}
                    style={{
                      width: `${Math.max(12, (item.count / escalations.length) * 100)}%`,
                    }}
                  />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
          <div className="chart-footer">
            <span>
              <i className="pulse-dot" /> 1 critical escalation is within SLA
            </span>
            <button className="text-button">
              View SLA policy <Icon name="chevron" />
            </button>
          </div>
        </section>

        <section className="card status-card">
          <SectionHeading
            title="Workflow status"
            description="Escalations moving toward engineering"
          />
          <div className="status-list">
            {statusCounts.map((item) => (
              <div key={item.status}>
                <span className={`status-symbol ${statusClass(item.status)}`}>
                  <span />
                </span>
                <span>{item.status}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="card table-card">
        <SectionHeading
          title="Recent escalations"
          description="Prioritized by severity and recent activity"
          action={
            <button className="text-button">
              View all escalations <Icon name="chevron" />
            </button>
          }
        />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Escalation</th>
                <th>Customer</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Repository</th>
                <th>Updated</th>
                <th>
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {escalations.slice(0, 6).map((item) => {
                const repository = DEMO_REPOSITORIES.find(
                  (repo) => repo.id === item.repositoryId,
                );
                return (
                  <tr key={item.id} onClick={() => onOpen(item.id)}>
                    <td>
                      <button
                        className="table-title"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(item.id);
                        }}
                      >
                        <strong>{item.id}</strong>
                        <span>{item.title}</span>
                      </button>
                    </td>
                    <td>{item.organization}</td>
                    <td>
                      <SeverityBadge severity={item.severity} />
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td>
                      <span className="repo-cell">
                        <Icon name="repository" />
                        {repository?.name}
                      </span>
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>
                      <button
                        className="icon-button"
                        aria-label={`Open ${item.id}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpen(item.id);
                        }}
                      >
                        <Icon name="chevron" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  trend,
  icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  trend: string;
  icon: keyof typeof ICONS;
  tone: string;
}) {
  return (
    <article className="card metric-card">
      <div className={`metric-icon ${tone}`}>
        <Icon name={icon} />
      </div>
      <p>{label}</p>
      <strong className="metric-value">{value}</strong>
      <span>{detail}</span>
      <small className={tone}>{trend}</small>
    </article>
  );
}

function FormField({
  label,
  hint,
  error,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`form-field ${className}`}>
      <span className="field-label">
        {label}
        {required ? <b aria-hidden="true"> *</b> : null}
      </span>
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

function IntakeForm({
  draft,
  errors,
  attachments,
  onChange,
  onAttachments,
  onSave,
  onAnalyze,
  onCancel,
}: {
  draft: EscalationDraft;
  errors: DraftErrors;
  attachments: Attachment[];
  onChange: <K extends keyof EscalationDraft>(
    field: K,
    value: EscalationDraft[K],
  ) => void;
  onAttachments: (attachments: Attachment[]) => void;
  onSave: () => void;
  onAnalyze: () => void;
  onCancel: () => void;
}) {
  const repository =
    DEMO_REPOSITORIES.find((item) => item.id === draft.repositoryId) ??
    DEMO_REPOSITORIES[0];

  return (
    <div className="intake-layout">
      <div className="screen-stack intake-main">
        <div className="form-progress" aria-label="Intake progress">
          <span className="active">1</span>
          <i />
          <span>2</span>
          <i />
          <span>3</span>
          <div>
            <b>Escalation details</b>
            <b>Repository analysis</b>
            <b>Review ticket</b>
          </div>
        </div>

        <section className="card form-section">
          <SectionHeading
            eyebrow="Step 1 of 3"
            title="Customer and issue"
            description="Start with the customer context engineering needs to prioritize correctly."
          />
          <div className="form-grid two">
            <FormField
              label="Customer or organization"
              required
              error={errors.organization}
            >
              <input
                value={draft.organization}
                onChange={(event) =>
                  onChange("organization", event.target.value)
                }
                placeholder="e.g. Apex Health"
                aria-invalid={Boolean(errors.organization)}
              />
            </FormField>
            <FormField
              label="Relevant repository"
              required
              error={errors.repositoryId}
            >
              <select
                value={draft.repositoryId}
                onChange={(event) =>
                  onChange("repositoryId", event.target.value)
                }
                aria-invalid={Boolean(errors.repositoryId)}
              >
                {DEMO_REPOSITORIES.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Escalation title"
              required
              error={errors.title}
              className="full-span"
            >
              <input
                value={draft.title}
                onChange={(event) => onChange("title", event.target.value)}
                placeholder="Describe the customer-visible failure"
                aria-invalid={Boolean(errors.title)}
              />
            </FormField>
            <FormField label="Severity" required>
              <select
                value={draft.severity}
                onChange={(event) =>
                  onChange(
                    "severity",
                    event.target.value as EscalationDraft["severity"],
                  )
                }
              >
                <option>Critical</option>
                <option>High</option>
                <option>Medium</option>
                <option>Low</option>
              </select>
            </FormField>
            <FormField label="Urgency" required>
              <select
                value={draft.urgency}
                onChange={(event) =>
                  onChange(
                    "urgency",
                    event.target.value as EscalationDraft["urgency"],
                  )
                }
              >
                <option>Immediate</option>
                <option>High</option>
                <option>Standard</option>
                <option>Low</option>
              </select>
            </FormField>
            <FormField
              label="Description"
              required
              error={errors.description}
              className="full-span"
              hint="Include when it started, frequency, and any known scope."
            >
              <textarea
                rows={4}
                value={draft.description}
                onChange={(event) =>
                  onChange("description", event.target.value)
                }
                placeholder="Summarize the issue and operational context…"
                aria-invalid={Boolean(errors.description)}
              />
            </FormField>
            <FormField
              label="Customer impact"
              required
              error={errors.customerImpact}
              className="full-span"
            >
              <textarea
                rows={3}
                value={draft.customerImpact}
                onChange={(event) =>
                  onChange("customerImpact", event.target.value)
                }
                placeholder="Who is affected, how many, and what work is blocked?"
                aria-invalid={Boolean(errors.customerImpact)}
              />
            </FormField>
          </div>
        </section>

        <section className="card form-section">
          <SectionHeading
            title="Behavior and reproduction"
            description="Separate facts from expectations so the analysis can find meaningful code paths."
          />
          <div className="form-grid two">
            <FormField
              label="Observed behavior"
              required
              error={errors.observedBehavior}
            >
              <textarea
                rows={4}
                value={draft.observedBehavior}
                onChange={(event) =>
                  onChange("observedBehavior", event.target.value)
                }
                placeholder="What actually happens?"
                aria-invalid={Boolean(errors.observedBehavior)}
              />
            </FormField>
            <FormField
              label="Expected behavior"
              required
              error={errors.expectedBehavior}
            >
              <textarea
                rows={4}
                value={draft.expectedBehavior}
                onChange={(event) =>
                  onChange("expectedBehavior", event.target.value)
                }
                placeholder="What should happen instead?"
                aria-invalid={Boolean(errors.expectedBehavior)}
              />
            </FormField>
            <FormField
              label="Reproduction steps"
              required
              error={errors.reproductionSteps}
              className="full-span"
              hint="Add one step per line."
            >
              <textarea
                rows={6}
                value={draft.reproductionSteps}
                onChange={(event) =>
                  onChange("reproductionSteps", event.target.value)
                }
                placeholder={"1. Create…\n2. Configure…\n3. Observe…"}
                aria-invalid={Boolean(errors.reproductionSteps)}
              />
            </FormField>
          </div>
        </section>

        <section className="card form-section">
          <SectionHeading
            title="Diagnostics and attachments"
            description="Secrets and common identifiers are redacted before analysis. Repository access remains read-only."
          />
          <div className="form-grid">
            <FormField
              label="Logs and error messages"
              hint="Paste sanitized logs only. API keys, tokens, passwords, and emails are removed by the analysis boundary."
            >
              <textarea
                className="code-input"
                rows={7}
                value={draft.logs}
                onChange={(event) => onChange("logs", event.target.value)}
                placeholder="Paste sanitized logs, request IDs, and stack traces…"
              />
            </FormField>
            <div className="upload-zone">
              <input
                id="attachments"
                type="file"
                multiple
                onChange={(event) => {
                  const next = Array.from(event.target.files ?? []).map(
                    (file, index) => ({
                      id: `upload-${index}-${file.name}`,
                      name: file.name,
                      type: file.type || "application/octet-stream",
                      size: `${Math.max(1, Math.round(file.size / 1024))} KB`,
                      scanStatus: "Safe" as const,
                    }),
                  );
                  onAttachments(next);
                }}
              />
              <label htmlFor="attachments">
                <span className="upload-icon">
                  <Icon name="download" />
                </span>
                <strong>Attach logs, screenshots, or traces</strong>
                <span>
                  Files stay in this local demo session and are not sent
                  externally.
                </span>
                <small>TXT, JSON, HAR, PNG, JPG, or PDF · up to 10 MB</small>
              </label>
            </div>
            {attachments.length ? (
              <div className="attachment-list">
                {attachments.map((item) => (
                  <div key={item.id}>
                    <Icon name="file" />
                    <span>
                      <strong>{item.name}</strong>
                      <small>
                        {item.size} · {item.scanStatus}
                      </small>
                    </span>
                    <button
                      className="icon-button"
                      aria-label={`Remove ${item.name}`}
                      onClick={() =>
                        onAttachments(
                          attachments.filter(
                            (attachment) => attachment.id !== item.id,
                          ),
                        )
                      }
                    >
                      <Icon name="close" />
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <div className="form-footer">
          <button className="secondary-button" onClick={onCancel}>
            Cancel
          </button>
          <span />
          <button className="secondary-button" onClick={onSave}>
            Save as new
          </button>
          <button className="primary-button" onClick={onAnalyze}>
            Analyze with repository <Icon name="chevron" />
          </button>
        </div>
      </div>

      <aside className="intake-side">
        <div className="card repository-preview">
          <p className="eyebrow">Analysis context</p>
          <div className="repo-heading">
            <span className="repo-avatar">
              <Icon name="repository" />
            </span>
            <div>
              <strong>{repository.name}</strong>
              <small>
                {repository.owner} · {repository.visibility}
              </small>
            </div>
          </div>
          <dl>
            <div>
              <dt>Branch</dt>
              <dd>
                <Icon name="branch" /> {repository.defaultBranch}
              </dd>
            </div>
            <div>
              <dt>Snapshot</dt>
              <dd>
                <code>{repository.indexedCommit}</code>
              </dd>
            </div>
            <div>
              <dt>Indexed files</dt>
              <dd>{repository.indexedFiles}</dd>
            </div>
            <div>
              <dt>Last indexed</dt>
              <dd>{formatDate(repository.lastIndexedAt)}</dd>
            </div>
          </dl>
          <div className="safe-callout">
            <Icon name="shield" />
            <p>
              <strong>Read-only analysis</strong>
              <span>
                Source is indexed for evidence. It is never modified, executed,
                or used to open external tickets.
              </span>
            </p>
          </div>
        </div>
        <div className="card intake-tip">
          <span className="tip-number">3×</span>
          <p>
            <strong>Faster engineering handoff</strong>
            <span>
              Complete reproduction steps produce more focused file and test
              matches.
            </span>
          </p>
        </div>
      </aside>
    </div>
  );
}

function RepositoryContext({
  repositories,
  selected,
  onSelect,
  onToast,
}: {
  repositories: RepositorySnapshot[];
  selected: RepositorySnapshot;
  onSelect: (id: string) => void;
  onToast: (message: string) => void;
}) {
  const [filter, setFilter] = useState("");
  const filteredFiles = selected.files.filter((file) =>
    [file.path, file.symbol ?? "", file.kind]
      .join(" ")
      .toLowerCase()
      .includes(filter.toLowerCase()),
  );

  return (
    <div className="repository-layout">
      <aside className="card repository-list">
        <div className="repository-list-heading">
          <span>Connected repositories</span>
          <button
            className="icon-button"
            aria-label="Add repository"
            onClick={() =>
              onToast("Repository connectors are disabled in demo mode.")
            }
          >
            <Icon name="new" />
          </button>
        </div>
        {repositories.map((repository) => (
          <button
            key={repository.id}
            className={selected.id === repository.id ? "active" : ""}
            onClick={() => onSelect(repository.id)}
          >
            <span className="repo-avatar">
              <Icon name="repository" />
            </span>
            <span>
              <strong>{repository.name}</strong>
              <small>
                {repository.primaryLanguage} · {repository.indexedFiles} files
              </small>
            </span>
            <span
              className={`connection-dot ${repository.status.toLowerCase()}`}
            />
          </button>
        ))}
        <div className="repository-list-footer">
          <Icon name="shield" />
          <span>
            <strong>Least-privilege access</strong>
            <small>Contents only · no write scopes</small>
          </span>
        </div>
      </aside>

      <div className="screen-stack repository-main">
        <section className="card repository-hero">
          <div className="repository-hero-top">
            <span className="repo-avatar large">
              <Icon name="repository" />
            </span>
            <div>
              <div className="repo-title-line">
                <h2>{selected.name}</h2>
                <span className="badge neutral">{selected.visibility}</span>
                <span className="badge indexed">
                  <span className="badge-dot" />
                  {selected.status}
                </span>
              </div>
              <p>{selected.description}</p>
            </div>
            <button
              className="secondary-button"
              onClick={() =>
                onToast("Snapshot sync queued. Demo data remains unchanged.")
              }
            >
              <span aria-hidden="true">↻</span> Sync snapshot
            </button>
          </div>
          <div className="repo-stats">
            <div>
              <span>Provider</span>
              <strong>{selected.provider}</strong>
            </div>
            <div>
              <span>Default branch</span>
              <strong>
                <Icon name="branch" /> {selected.defaultBranch}
              </strong>
            </div>
            <div>
              <span>Indexed commit</span>
              <strong>
                <code>{selected.indexedCommit}</code>
              </strong>
            </div>
            <div>
              <span>Indexed files</span>
              <strong>{selected.indexedFiles}</strong>
            </div>
            <div>
              <span>Last indexed</span>
              <strong>{formatDate(selected.lastIndexedAt)}</strong>
            </div>
          </div>
        </section>

        <div className="repo-context-grid">
          <section className="card context-summary">
            <SectionHeading
              title="Architecture context"
              description="Signals available to repository-aware analysis"
            />
            <div className="architecture-list">
              <div>
                <span className="context-icon blue">TS</span>
                <p>
                  <strong>{selected.primaryLanguage} services</strong>
                  <span>Primary implementation language in this snapshot.</span>
                </p>
              </div>
              <div>
                <span className="context-icon violet">API</span>
                <p>
                  <strong>Service and API boundaries</strong>
                  <span>
                    {
                      selected.files.filter(
                        (file) =>
                          file.kind === "api" || file.kind === "service",
                      ).length
                    }{" "}
                    high-signal paths in the demo index.
                  </span>
                </p>
              </div>
              <div>
                <span className="context-icon green">✓</span>
                <p>
                  <strong>Tests and documentation</strong>
                  <span>
                    {
                      selected.files.filter(
                        (file) => file.kind === "test" || file.kind === "docs",
                      ).length
                    }{" "}
                    validation and operations references.
                  </span>
                </p>
              </div>
            </div>
          </section>
          <section className="card security-panel">
            <SectionHeading
              title="Analysis boundary"
              description="Controls applied before evidence reaches a provider"
            />
            <ul className="check-list">
              <li>
                <Icon name="check" />
                Read-only repository snapshot
              </li>
              <li>
                <Icon name="check" />
                Secret-pattern redaction
              </li>
              <li>
                <Icon name="check" />
                Evidence excerpts capped at 420 characters
              </li>
              <li>
                <Icon name="check" />
                No code execution or product writes
              </li>
            </ul>
            <div className="boundary-note">
              <Icon name="info" />
              <span>
                Environment files and common credential formats are excluded
                from analysis context.
              </span>
            </div>
          </section>
        </div>

        <section className="card file-browser">
          <div className="file-browser-head">
            <SectionHeading
              title="Indexed evidence catalog"
              description={`${selected.files.length} high-signal demo paths shown from ${selected.indexedFiles} indexed files`}
            />
            <label className="file-search">
              <Icon name="search" />
              <span className="sr-only">Filter files</span>
              <input
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Filter paths or symbols"
              />
            </label>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Path and symbol</th>
                  <th>Type</th>
                  <th>Lines</th>
                  <th>Analysis signal</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={`${file.path}-${file.symbol}`}>
                    <td>
                      <span className="path-cell">
                        <Icon name="file" />
                        <span>
                          <code>{file.path}</code>
                          {file.symbol ? <small>{file.symbol}</small> : null}
                        </span>
                      </span>
                    </td>
                    <td>
                      <span className={`badge file-kind ${file.kind}`}>
                        {file.kind}
                      </span>
                    </td>
                    <td>
                      <code>{file.lines}</code>
                    </td>
                    <td>{file.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredFiles.length ? (
            <EmptyState
              title="No matching evidence"
              description="Try a broader path, symbol, or file-type filter."
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function AnalysisLoading({
  escalation,
  repository,
  stage,
  error,
  onUseDemo,
  onCancel,
}: {
  escalation: Escalation;
  repository: RepositorySnapshot;
  stage: number;
  error: string;
  onUseDemo: () => void;
  onCancel: () => void;
}) {
  const progress = Math.round(((stage + 1) / ANALYSIS_STAGES.length) * 100);

  if (error) {
    return (
      <div className="analysis-center">
        <section className="card analysis-error">
          <span className="analysis-error-icon">!</span>
          <p className="eyebrow">Analysis paused</p>
          <h2>Provider configuration is incomplete</h2>
          <p>{error}</p>
          <div>
            <button className="secondary-button" onClick={onCancel}>
              Return to escalation
            </button>
            <button className="primary-button" onClick={onUseDemo}>
              Continue in demo mode
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="analysis-center">
      <section className="card analysis-panel">
        <div className="analysis-orbit" aria-hidden="true">
          <span className="orbit-one" />
          <span className="orbit-two" />
          <span className="analysis-core">E</span>
        </div>
        <p className="eyebrow">Read-only repository analysis</p>
        <h2>Building an evidence-backed ticket</h2>
        <p>
          Escalation <strong>{escalation.id}</strong> is being compared with{" "}
          <strong>{repository.name}</strong> at{" "}
          <code>{repository.indexedCommit}</code>.
        </p>
        <div
          className="analysis-progress"
          role="progressbar"
          aria-label="Analysis progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div>
            <span style={{ width: `${progress}%` }} />
          </div>
          <strong>{progress}%</strong>
        </div>
        <ol className="analysis-stages">
          {ANALYSIS_STAGES.map((item, index) => (
            <li
              key={item.label}
              className={
                index < stage ? "complete" : index === stage ? "active" : ""
              }
            >
              <span>{index < stage ? <Icon name="check" /> : index + 1}</span>
              <p>
                <strong>{item.label}</strong>
                <small>{item.detail}</small>
              </p>
              {index === stage ? <i /> : null}
            </li>
          ))}
        </ol>
        <div className="analysis-safety">
          <Icon name="shield" />
          <span>
            <strong>Protected analysis boundary</strong> Secrets are redacted,
            excerpts are limited, and no repository changes can be made.
          </span>
        </div>
      </section>
      <button className="text-button cancel-analysis" onClick={onCancel}>
        Run in background and return to escalation
      </button>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: RepositoryEvidence }) {
  return (
    <article className="evidence-card">
      <div className="evidence-head">
        <span className={`badge file-kind ${evidence.kind}`}>
          {evidence.kind}
        </span>
        <code>{evidence.lines}</code>
      </div>
      <code className="evidence-path">
        {evidence.path}
        {evidence.symbol ? `#${evidence.symbol}` : ""}
      </code>
      <p>{evidence.reason}</p>
      <pre>{evidence.excerpt}</pre>
    </article>
  );
}

function EditableList({
  label,
  value,
  onChange,
  rows = 5,
}: {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  rows?: number;
}) {
  return (
    <FormField label={label} hint="One item per line">
      <textarea
        rows={rows}
        value={value.join("\n")}
        onChange={(event) =>
          onChange(
            event.target.value.split(/\r?\n/).filter((item) => item.trim()),
          )
        }
      />
    </FormField>
  );
}

function TicketReview({
  escalation,
  onUpdate,
  onApprove,
  onSend,
  onCopy,
  onExport,
  onDetail,
}: {
  escalation: Escalation;
  onUpdate: (patch: Partial<EngineeringTicket>) => void;
  onApprove: () => void;
  onSend: () => void;
  onCopy: () => void;
  onExport: (format: "markdown" | "json") => void;
  onDetail: () => void;
}) {
  const ticket = escalation.ticket;
  const analysis = escalation.analysis;
  const [leftTab, setLeftTab] = useState<"evidence" | "report" | "questions">(
    "evidence",
  );
  const [expanded, setExpanded] = useState<
    "core" | "implementation" | "delivery"
  >("core");

  if (!ticket || !analysis) {
    return (
      <EmptyState
        title="No ticket available"
        description="Run repository analysis before reviewing this escalation."
        action={
          <button className="secondary-button" onClick={onDetail}>
            Back to escalation
          </button>
        }
      />
    );
  }

  return (
    <div className="review-screen">
      <div className="review-toolbar card">
        <div>
          <button className="back-button" onClick={onDetail}>
            ‹
          </button>
          <span>
            <small>{escalation.id}</small>
            <strong>{escalation.title}</strong>
          </span>
          <SeverityBadge severity={escalation.severity} />
          <StatusBadge status={escalation.status} />
        </div>
        <div>
          <button className="secondary-button compact" onClick={onCopy}>
            <Icon name="copy" /> Copy
          </button>
          <div className="export-group">
            <button
              className="secondary-button compact"
              onClick={() => onExport("markdown")}
            >
              <Icon name="download" /> Markdown
            </button>
            <button
              className="secondary-button compact split"
              onClick={() => onExport("json")}
              aria-label="Export JSON"
            >
              JSON
            </button>
          </div>
          {escalation.status === "Ready for Review" ? (
            <button className="primary-button" onClick={onApprove}>
              <Icon name="check" /> Approve ticket
            </button>
          ) : escalation.status === "Approved" ? (
            <button className="primary-button" onClick={onSend}>
              Mark sent to engineering <Icon name="chevron" />
            </button>
          ) : (
            <StatusBadge status={escalation.status} />
          )}
        </div>
      </div>

      <div className="review-layout">
        <aside className="card evidence-pane">
          <div className="tabs" role="tablist" aria-label="Source context">
            <button
              role="tab"
              aria-selected={leftTab === "evidence"}
              className={leftTab === "evidence" ? "active" : ""}
              onClick={() => setLeftTab("evidence")}
            >
              Evidence <span>{analysis.evidence.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={leftTab === "report"}
              className={leftTab === "report" ? "active" : ""}
              onClick={() => setLeftTab("report")}
            >
              Report
            </button>
            <button
              role="tab"
              aria-selected={leftTab === "questions"}
              className={leftTab === "questions" ? "active" : ""}
              onClick={() => setLeftTab("questions")}
            >
              Questions <span>{analysis.followUpQuestions.length}</span>
            </button>
          </div>
          <div className="evidence-pane-content">
            {leftTab === "evidence" ? (
              <>
                <div className="pane-intro">
                  <p className="eyebrow">Repository evidence</p>
                  <p>
                    Every technical claim should stay traceable to this indexed
                    snapshot.
                  </p>
                </div>
                {analysis.evidence.map((item) => (
                  <EvidenceCard
                    evidence={item}
                    key={`${item.path}-${item.symbol}`}
                  />
                ))}
                <h3 className="pane-subhead">Related tests</h3>
                {analysis.relatedTests.map((item) => (
                  <EvidenceCard
                    evidence={item}
                    key={`${item.path}-${item.symbol}`}
                  />
                ))}
              </>
            ) : null}
            {leftTab === "report" ? (
              <div className="source-report">
                <p className="eyebrow">Original customer report</p>
                <h3>{escalation.title}</h3>
                <InfoBlock
                  label="Customer impact"
                  value={escalation.customerImpact}
                />
                <InfoBlock
                  label="Observed"
                  value={escalation.observedBehavior}
                />
                <InfoBlock
                  label="Expected"
                  value={escalation.expectedBehavior}
                />
                <h4>Reproduction</h4>
                <ol>
                  {escalation.reproductionSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <h4>Sanitized logs</h4>
                <pre>{escalation.logs}</pre>
              </div>
            ) : null}
            {leftTab === "questions" ? (
              <div className="questions-panel">
                <p className="eyebrow">Missing information</p>
                <p>These answers may raise or lower hypothesis confidence.</p>
                {analysis.followUpQuestions.map((question, index) => (
                  <label key={question}>
                    <span>{index + 1}</span>
                    <p>{question}</p>
                    <textarea rows={2} placeholder="Add an answer or note…" />
                  </label>
                ))}
              </div>
            ) : null}
          </div>
        </aside>

        <section className="card ticket-editor">
          <div className="editor-banner">
            <span className="spark">✦</span>
            <p>
              <strong>AI draft · human approval required</strong>
              <span>
                Edits save in this session. No external ticket is created
                automatically.
              </span>
            </p>
            <small>Edited {formatDate(ticket.lastEditedAt)}</small>
          </div>
          <div className="ticket-title-editor">
            <label>
              <span>Ticket title</span>
              <input
                value={ticket.title}
                onChange={(event) => onUpdate({ title: event.target.value })}
              />
            </label>
            <div>
              <FormField label="Severity">
                <select
                  value={ticket.severity}
                  onChange={(event) =>
                    onUpdate({ severity: event.target.value as Severity })
                  }
                >
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
              </FormField>
              <FormField label="Priority">
                <select
                  value={ticket.priority}
                  onChange={(event) =>
                    onUpdate({
                      priority: event.target
                        .value as EngineeringTicket["priority"],
                    })
                  }
                >
                  <option>P0</option>
                  <option>P1</option>
                  <option>P2</option>
                  <option>P3</option>
                </select>
              </FormField>
            </div>
          </div>

          <EditorSection
            title="Summary and behavior"
            open={expanded === "core"}
            onOpen={() => setExpanded("core")}
            count="5 fields"
          >
            <FormField label="Executive summary">
              <textarea
                rows={5}
                value={ticket.executiveSummary}
                onChange={(event) =>
                  onUpdate({ executiveSummary: event.target.value })
                }
              />
            </FormField>
            <FormField label="Customer impact">
              <textarea
                rows={3}
                value={ticket.customerImpact}
                onChange={(event) =>
                  onUpdate({ customerImpact: event.target.value })
                }
              />
            </FormField>
            <div className="form-grid two">
              <FormField label="Observed behavior">
                <textarea
                  rows={4}
                  value={ticket.observedBehavior}
                  onChange={(event) =>
                    onUpdate({ observedBehavior: event.target.value })
                  }
                />
              </FormField>
              <FormField label="Expected behavior">
                <textarea
                  rows={4}
                  value={ticket.expectedBehavior}
                  onChange={(event) =>
                    onUpdate({ expectedBehavior: event.target.value })
                  }
                />
              </FormField>
            </div>
            <EditableList
              label="Reproduction steps"
              value={ticket.reproductionSteps}
              onChange={(value) => onUpdate({ reproductionSteps: value })}
              rows={5}
            />
          </EditorSection>

          <div className="hypothesis-card">
            <div className="hypothesis-head">
              <span>
                <Icon name="info" />
              </span>
              <p>
                <strong>Root-cause hypothesis</strong>
                <small>Unconfirmed · requires runtime verification</small>
              </p>
              <div className="confidence">
                <small>Confidence</small>
                <strong>{ticket.rootCauseHypothesis.confidence}%</strong>
              </div>
            </div>
            <textarea
              rows={4}
              value={ticket.rootCauseHypothesis.statement}
              onChange={(event) =>
                onUpdate({
                  rootCauseHypothesis: {
                    ...ticket.rootCauseHypothesis,
                    statement: event.target.value,
                  },
                })
              }
              aria-label="Root-cause hypothesis"
            />
            <p>{ticket.rootCauseHypothesis.rationale}</p>
            <div className="confidence-bar">
              <span
                style={{ width: `${ticket.rootCauseHypothesis.confidence}%` }}
              />
            </div>
          </div>

          <EditorSection
            title="Implementation guidance"
            open={expanded === "implementation"}
            onOpen={() => setExpanded("implementation")}
            count="4 sections"
          >
            <EditableList
              label="Technical findings"
              value={ticket.technicalFindings}
              onChange={(value) => onUpdate({ technicalFindings: value })}
              rows={6}
            />
            <EditableList
              label="Recommended implementation plan"
              value={ticket.implementationPlan}
              onChange={(value) => onUpdate({ implementationPlan: value })}
              rows={7}
            />
            <EditableList
              label="Risks and dependencies"
              value={ticket.risksAndDependencies}
              onChange={(value) => onUpdate({ risksAndDependencies: value })}
            />
            <EditableList
              label="Edge cases"
              value={ticket.edgeCases}
              onChange={(value) => onUpdate({ edgeCases: value })}
            />
          </EditorSection>

          <EditorSection
            title="Acceptance and delivery"
            open={expanded === "delivery"}
            onOpen={() => setExpanded("delivery")}
            count="3 sections"
          >
            <EditableList
              label="Acceptance criteria"
              value={ticket.acceptanceCriteria}
              onChange={(value) => onUpdate({ acceptanceCriteria: value })}
              rows={7}
            />
            <EditableList
              label="Testing requirements"
              value={ticket.testingRequirements}
              onChange={(value) => onUpdate({ testingRequirements: value })}
              rows={7}
            />
            <EditableList
              label="Definition of done"
              value={ticket.definitionOfDone}
              onChange={(value) => onUpdate({ definitionOfDone: value })}
              rows={7}
            />
          </EditorSection>
        </section>
      </div>
    </div>
  );
}

function EditorSection({
  title,
  open,
  onOpen,
  count,
  children,
}: {
  title: string;
  open: boolean;
  onOpen: () => void;
  count: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`editor-section ${open ? "open" : ""}`}>
      <button
        className="editor-section-toggle"
        onClick={onOpen}
        aria-expanded={open}
      >
        <span>
          <strong>{title}</strong>
          <small>{count}</small>
        </span>
        <span>{open ? "−" : "+"}</span>
      </button>
      {open ? <div className="editor-section-content">{children}</div> : null}
    </section>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-block">
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function EscalationDetail({
  escalation,
  repository,
  tab,
  onTab,
  onReview,
  onAnalyze,
  onRepository,
}: {
  escalation: Escalation;
  repository: RepositorySnapshot;
  tab: "report" | "analysis" | "ticket";
  onTab: (tab: "report" | "analysis" | "ticket") => void;
  onReview: () => void;
  onAnalyze: () => void;
  onRepository: () => void;
}) {
  const analysis = escalation.analysis;
  const ticket = escalation.ticket;

  return (
    <div className="screen-stack detail-screen">
      <section className="card detail-hero">
        <div className="detail-hero-main">
          <div className="detail-badges">
            <SeverityBadge severity={escalation.severity} />
            <StatusBadge status={escalation.status} />
            <span className="badge neutral">{escalation.urgency} urgency</span>
          </div>
          <h2>{escalation.title}</h2>
          <p>{escalation.description}</p>
          <div className="detail-meta">
            <span>
              <Avatar name={escalation.reporter} tone="slate" /> Reported by{" "}
              <strong>{escalation.reporter}</strong>
            </span>
            <span>Created {formatDate(escalation.createdAt)}</span>
            <span>Updated {formatDate(escalation.updatedAt)}</span>
          </div>
        </div>
        <div className="detail-actions">
          <button className="secondary-button" onClick={onRepository}>
            <Icon name="repository" /> View repository
          </button>
          {ticket ? (
            <button className="primary-button" onClick={onReview}>
              Review ticket <Icon name="chevron" />
            </button>
          ) : escalation.status === "New" ? (
            <button className="primary-button" onClick={onAnalyze}>
              Analyze escalation <Icon name="chevron" />
            </button>
          ) : null}
        </div>
      </section>

      <div
        className="detail-tabs"
        role="tablist"
        aria-label="Escalation detail sections"
      >
        <button
          role="tab"
          aria-selected={tab === "report"}
          className={tab === "report" ? "active" : ""}
          onClick={() => onTab("report")}
        >
          Original report
        </button>
        <button
          role="tab"
          aria-selected={tab === "analysis"}
          className={tab === "analysis" ? "active" : ""}
          onClick={() => onTab("analysis")}
        >
          Analysis {analysis ? <span>{analysis.evidence.length}</span> : null}
        </button>
        <button
          role="tab"
          aria-selected={tab === "ticket"}
          className={tab === "ticket" ? "active" : ""}
          onClick={() => onTab("ticket")}
        >
          Engineering ticket
        </button>
      </div>

      {tab === "report" ? (
        <div className="detail-grid">
          <section className="card detail-report">
            <SectionHeading
              title="Customer report"
              description="Original support context captured for this escalation"
            />
            <div className="report-section">
              <span>Customer impact</span>
              <p>{escalation.customerImpact}</p>
            </div>
            <div className="behavior-grid">
              <div>
                <span>Observed behavior</span>
                <p>{escalation.observedBehavior}</p>
              </div>
              <div>
                <span>Expected behavior</span>
                <p>{escalation.expectedBehavior}</p>
              </div>
            </div>
            <div className="report-section">
              <span>Reproduction steps</span>
              <ol>
                {escalation.reproductionSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
            <div className="report-section">
              <span>Logs and error messages</span>
              <pre>{escalation.logs || "No logs were provided."}</pre>
            </div>
            <div className="report-section">
              <span>Attachments</span>
              {escalation.attachments.length ? (
                <div className="attachment-list compact-list">
                  {escalation.attachments.map((item) => (
                    <div key={item.id}>
                      <Icon name="file" />
                      <span>
                        <strong>{item.name}</strong>
                        <small>
                          {item.type} · {item.size}
                        </small>
                      </span>
                      <span className="badge indexed">
                        <Icon name="check" />
                        {item.scanStatus}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">No attachments were provided.</p>
              )}
            </div>
          </section>
          <aside className="screen-stack detail-side">
            <section className="card detail-customer">
              <p className="eyebrow">Customer</p>
              <div className="customer-logo">{escalation.organization[0]}</div>
              <h3>{escalation.organization}</h3>
              <p>Enterprise plan · North America</p>
              <dl>
                <div>
                  <dt>Open escalations</dt>
                  <dd>1</dd>
                </div>
                <div>
                  <dt>Account health</dt>
                  <dd>
                    <span className="health-dot" /> At risk
                  </dd>
                </div>
                <div>
                  <dt>Support tier</dt>
                  <dd>Premier</dd>
                </div>
              </dl>
            </section>
            <section className="card detail-repo">
              <p className="eyebrow">Repository</p>
              <div className="repo-heading">
                <span className="repo-avatar">
                  <Icon name="repository" />
                </span>
                <div>
                  <strong>{repository.name}</strong>
                  <small>{repository.owner}</small>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Snapshot</dt>
                  <dd>
                    <code>{repository.indexedCommit}</code>
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <span className="connection-dot indexed" />{" "}
                    {repository.status}
                  </dd>
                </div>
                <div>
                  <dt>Access</dt>
                  <dd>Read-only</dd>
                </div>
              </dl>
              <button className="secondary-button full" onClick={onRepository}>
                Inspect repository context
              </button>
            </section>
          </aside>
        </div>
      ) : null}

      {tab === "analysis" ? (
        analysis ? (
          <div className="detail-grid analysis-detail">
            <section className="screen-stack">
              <div className="card analysis-summary-card">
                <div>
                  <span className="spark">✦</span>
                  <p>
                    <strong>Repository analysis complete</strong>
                    <span>{analysis.summary}</span>
                  </p>
                </div>
                <small>
                  {analysis.provider}
                  <br />
                  Generated {formatDate(analysis.generatedAt)}
                </small>
              </div>
              <section className="card">
                <SectionHeading
                  title="Technical findings"
                  description="Claims grounded in the indexed repository snapshot"
                />
                <ul className="finding-list">
                  {analysis.technicalFindings.map((finding, index) => (
                    <li key={finding}>
                      <span>{index + 1}</span>
                      <p>{finding}</p>
                    </li>
                  ))}
                </ul>
              </section>
              <section className="card evidence-detail-section">
                <SectionHeading
                  title="Repository evidence"
                  description={`${analysis.evidence.length} cited implementation references`}
                />
                <div className="evidence-grid">
                  {analysis.evidence.map((item) => (
                    <EvidenceCard
                      evidence={item}
                      key={`${item.path}-${item.symbol}`}
                    />
                  ))}
                </div>
              </section>
              <section className="card evidence-detail-section">
                <SectionHeading
                  title="Tests and documentation"
                  description="Existing validation and operational context"
                />
                <div className="evidence-grid">
                  {[
                    ...analysis.relatedTests,
                    ...analysis.relatedDocumentation,
                  ].map((item) => (
                    <EvidenceCard
                      evidence={item}
                      key={`${item.path}-${item.symbol}`}
                    />
                  ))}
                </div>
              </section>
            </section>
            <aside className="screen-stack detail-side">
              <section className="hypothesis-card side-hypothesis">
                <div className="hypothesis-head">
                  <span>
                    <Icon name="info" />
                  </span>
                  <p>
                    <strong>Root-cause hypothesis</strong>
                    <small>Not a confirmed fact</small>
                  </p>
                  <div className="confidence">
                    <small>Confidence</small>
                    <strong>{analysis.hypothesis.confidence}%</strong>
                  </div>
                </div>
                <p className="hypothesis-statement">
                  {analysis.hypothesis.statement}
                </p>
                <p>{analysis.hypothesis.rationale}</p>
                <div className="confidence-bar">
                  <span
                    style={{ width: `${analysis.hypothesis.confidence}%` }}
                  />
                </div>
                <small>{analysis.hypothesis.disclaimer}</small>
              </section>
              <section className="card follow-up-card">
                <p className="eyebrow">Missing information</p>
                <h3>Follow-up questions</h3>
                <ol>
                  {analysis.followUpQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ol>
              </section>
              <section className="card redaction-card">
                <Icon name="shield" />
                <p>
                  <strong>Privacy check</strong>
                  <span>
                    {analysis.redactions.length
                      ? `${analysis.redactions.join(", ")} redacted before analysis.`
                      : "No common secret or identifier patterns detected in the submitted context."}
                  </span>
                </p>
              </section>
            </aside>
          </div>
        ) : (
          <EmptyState
            title="Analysis is not available"
            description={
              escalation.status === "Needs Information"
                ? "Support must provide the requested context before repository analysis can be completed."
                : "Run analysis to connect this report with repository evidence."
            }
            action={
              escalation.status === "New" ? (
                <button className="primary-button" onClick={onAnalyze}>
                  Analyze escalation
                </button>
              ) : undefined
            }
          />
        )
      ) : null}

      {tab === "ticket" ? (
        ticket ? (
          <section className="card ticket-preview">
            <SectionHeading
              title={ticket.title}
              description={`Priority ${ticket.priority} · last edited ${formatDate(ticket.lastEditedAt)}`}
              action={
                <button className="primary-button" onClick={onReview}>
                  Open editor <Icon name="chevron" />
                </button>
              }
            />
            <TicketPreviewSection title="Executive summary">
              <p>{ticket.executiveSummary}</p>
            </TicketPreviewSection>
            <div className="preview-columns">
              <TicketPreviewSection title="Customer impact">
                <p>{ticket.customerImpact}</p>
              </TicketPreviewSection>
              <TicketPreviewSection title="Behavior">
                <p>
                  <strong>Observed:</strong> {ticket.observedBehavior}
                </p>
                <p>
                  <strong>Expected:</strong> {ticket.expectedBehavior}
                </p>
              </TicketPreviewSection>
            </div>
            <TicketPreviewSection title="Root-cause hypothesis">
              <div className="inline-hypothesis">
                <span>
                  HYPOTHESIS · {ticket.rootCauseHypothesis.confidence}%
                  CONFIDENCE
                </span>
                <p>{ticket.rootCauseHypothesis.statement}</p>
              </div>
            </TicketPreviewSection>
            <div className="preview-columns">
              <TicketPreviewSection title="Implementation plan">
                <ol>
                  {ticket.implementationPlan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </TicketPreviewSection>
              <TicketPreviewSection title="Acceptance criteria">
                <ul>
                  {ticket.acceptanceCriteria.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </TicketPreviewSection>
            </div>
          </section>
        ) : (
          <EmptyState
            title="No engineering ticket yet"
            description="A ticket will appear here after repository analysis is complete."
            action={
              escalation.status === "New" ? (
                <button className="primary-button" onClick={onAnalyze}>
                  Analyze escalation
                </button>
              ) : undefined
            }
          />
        )
      ) : null}
    </div>
  );
}

function TicketPreviewSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="ticket-preview-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Settings({
  settings,
  apiKey,
  onChange,
  onApiKey,
  onSave,
  onToast,
}: {
  settings: AiSettings;
  apiKey: string;
  onChange: (settings: AiSettings) => void;
  onApiKey: (key: string) => void;
  onSave: () => void;
  onToast: (message: string) => void;
}) {
  const update = <K extends keyof AiSettings>(key: K, value: AiSettings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div className="settings-layout">
      <nav className="settings-nav" aria-label="Settings sections">
        <a href="#ai" className="active">
          AI provider
        </a>
        <a href="#repositories">Repositories</a>
        <a href="#security">Security & privacy</a>
        <a href="#exports">Export defaults</a>
      </nav>
      <div className="screen-stack settings-main">
        <section className="card settings-section" id="ai">
          <SectionHeading
            eyebrow="Analysis"
            title="AI provider"
            description="Provider logic is isolated behind a replaceable service interface. Demo mode stays fully functional without a key."
          />
          <div className="provider-options">
            {(
              [
                "Demo provider",
                "OpenAI",
                "Anthropic",
              ] as AiSettings["provider"][]
            ).map((provider) => (
              <button
                key={provider}
                className={settings.provider === provider ? "active" : ""}
                onClick={() => update("provider", provider)}
              >
                <span
                  className={`provider-logo ${provider.toLowerCase().replace(" ", "-")}`}
                >
                  {provider === "Demo provider" ? "E" : provider[0]}
                </span>
                <span>
                  <strong>{provider}</strong>
                  <small>
                    {provider === "Demo provider"
                      ? "Deterministic repository matcher"
                      : "Server-side connector required"}
                  </small>
                </span>
                <i>{settings.provider === provider ? "✓" : ""}</i>
              </button>
            ))}
          </div>
          <div className="form-grid two settings-fields">
            <FormField label="Model">
              <input
                value={settings.model}
                onChange={(event) => update("model", event.target.value)}
                disabled={settings.provider === "Demo provider"}
              />
            </FormField>
            <FormField
              label="API key"
              hint="Never persisted by the demo UI. Production credentials belong in server-side environment configuration."
            >
              <input
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => onApiKey(event.target.value)}
                placeholder={
                  settings.apiKeyPresent
                    ? "Configured server-side"
                    : "Enter for this session only"
                }
                disabled={settings.provider === "Demo provider"}
              />
            </FormField>
          </div>
          <div className="settings-callout">
            <Icon name="info" />
            <p>
              <strong>
                {settings.provider === "Demo provider"
                  ? "Demo mode is active"
                  : "Live provider adapter is intentionally unavailable"}
              </strong>
              <span>
                {settings.provider === "Demo provider"
                  ? "Analysis uses the same evidence and ticket interfaces as a live provider, with deterministic local results."
                  : "This MVP will not send repository content to a provider from the browser. Add a reviewed server-side adapter before enabling live calls."}
              </span>
            </p>
          </div>
        </section>

        <section className="card settings-section" id="repositories">
          <SectionHeading
            eyebrow="Context"
            title="Repositories"
            description="Connected read-only snapshots available for evidence matching"
            action={
              <button
                className="secondary-button"
                onClick={() => onToast("Connectors are disabled in demo mode.")}
              >
                <Icon name="new" /> Connect repository
              </button>
            }
          />
          <div className="settings-repos">
            {DEMO_REPOSITORIES.map((repository) => (
              <div key={repository.id}>
                <span className="repo-avatar">
                  <Icon name="repository" />
                </span>
                <span>
                  <strong>{repository.name}</strong>
                  <small>
                    {repository.provider} · {repository.owner} ·{" "}
                    {repository.defaultBranch}
                  </small>
                </span>
                <span className="badge indexed">
                  <span className="badge-dot" />
                  {repository.status}
                </span>
                <button
                  className="text-button"
                  onClick={() =>
                    onToast(
                      `${repository.name} uses a read-only demo snapshot.`,
                    )
                  }
                >
                  Manage
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card settings-section" id="security">
          <SectionHeading
            eyebrow="Guardrails"
            title="Security and evidence controls"
            description="Controls apply before any analysis provider receives context."
          />
          <div className="settings-control">
            <div>
              <strong>Redact sensitive patterns</strong>
              <span>
                Mask common API keys, bearer tokens, passwords, secrets, and
                email addresses.
              </span>
            </div>
            <button
              role="switch"
              aria-checked={settings.redactSensitiveData}
              className={`switch ${settings.redactSensitiveData ? "on" : ""}`}
              onClick={() =>
                update("redactSensitiveData", !settings.redactSensitiveData)
              }
            >
              <span />
            </button>
          </div>
          <div className="settings-control">
            <div>
              <strong>Minimum repository evidence</strong>
              <span>
                Require this many implementation references before a ticket can
                claim technical findings.
              </span>
            </div>
            <select
              value={settings.minimumEvidenceCount}
              onChange={(event) =>
                update("minimumEvidenceCount", Number(event.target.value))
              }
            >
              <option value={1}>1 reference</option>
              <option value={2}>2 references</option>
              <option value={3}>3 references</option>
            </select>
          </div>
          <ul className="guardrail-list">
            <li>
              <Icon name="shield" />
              <span>
                <strong>Source is never executed</strong>
                <small>Repository analysis reads a curated index only.</small>
              </span>
            </li>
            <li>
              <Icon name="shield" />
              <span>
                <strong>Uncertainty stays visible</strong>
                <small>
                  Root causes are always labeled as hypotheses with confidence.
                </small>
              </span>
            </li>
            <li>
              <Icon name="shield" />
              <span>
                <strong>Human approval is required</strong>
                <small>
                  No product code or external issue is changed automatically.
                </small>
              </span>
            </li>
          </ul>
        </section>

        <section className="card settings-section" id="exports">
          <SectionHeading
            eyebrow="Handoff"
            title="Export defaults"
            description="Generated tickets are portable without exposing the original customer report or raw logs."
          />
          <div className="export-defaults">
            <div>
              <span className="export-icon">M↓</span>
              <p>
                <strong>Markdown</strong>
                <small>
                  Optimized for GitHub Issues, Linear, and Jira descriptions.
                </small>
              </p>
              <span className="badge neutral">Enabled</span>
            </div>
            <div>
              <span className="export-icon">{"{}"}</span>
              <p>
                <strong>Structured JSON</strong>
                <small>
                  Ticket content and cited repository evidence only.
                </small>
              </p>
              <span className="badge neutral">Enabled</span>
            </div>
          </div>
        </section>

        <div className="settings-save">
          <span>Changes apply to this browser session only.</span>
          <button className="primary-button" onClick={onSave}>
            Save settings
          </button>
        </div>
      </div>
    </div>
  );
}
