"use client";

import { useState, type FormEvent } from "react";

type Mode = "login" | "signup";
type FieldErrors = { name?: string; email?: string; password?: string };

export function AuthPage({ initialMode = "login" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isSignup = mode === "signup";

  function changeMode(next: Mode) {
    setMode(next);
    setErrors({});
    setFormError("");
    window.history.replaceState(
      null,
      "",
      next === "signup" ? "/signup" : "/login",
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrors({});
    setFormError("");

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const result = (await response.json()) as {
        error?: string;
        fields?: FieldErrors;
      };
      if (!response.ok) {
        setErrors(result.fields ?? {});
        setFormError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      window.location.assign("/");
    } catch {
      setFormError(
        "We couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-story" aria-label="About DevRelay">
        <div className="auth-brand">
          <span className="brand-mark">D</span>
          <span>
            <strong>DevRelay</strong>
            <small>SIGNAL TO ACTION</small>
          </span>
        </div>
        <div className="auth-story-copy">
          <p className="auth-kicker">Support context, engineered</p>
          <h1>Move customer issues into engineering with confidence.</h1>
          <p>
            Turn escalation reports into evidence-backed, implementation-ready
            tickets—without losing the human review step.
          </p>
          <div className="auth-proof-list">
            <span>
              <i>✓</i> Repository-aware evidence
            </span>
            <span>
              <i>✓</i> Structured engineering briefs
            </span>
            <span>
              <i>✓</i> Secure, human-approved handoff
            </span>
          </div>
        </div>
        <p className="auth-story-foot">
          Built for support and engineering teams
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-mobile-brand">
            <span className="brand-mark">D</span>
            <strong>DevRelay</strong>
          </div>
          <div className="auth-heading">
            <p className="eyebrow">
              {isSignup ? "Create your workspace account" : "Welcome back"}
            </p>
            <h2>
              {isSignup ? "Start with DevRelay" : "Sign in to your account"}
            </h2>
            <p>
              {isSignup
                ? "A few details and you're ready to turn reports into action."
                : "Use the email and password connected to your account."}
            </p>
          </div>

          <div
            className="auth-mode-switch"
            role="tablist"
            aria-label="Account options"
          >
            <button
              type="button"
              role="tab"
              aria-selected={!isSignup}
              className={!isSignup ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isSignup}
              className={isSignup ? "active" : ""}
              onClick={() => changeMode("signup")}
            >
              Sign up
            </button>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            {isSignup ? (
              <label>
                <span>Full name</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Alex Morgan"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? "name-error" : undefined}
                  autoFocus
                />
                {errors.name ? (
                  <small id="name-error" className="auth-field-error">
                    {errors.name}
                  </small>
                ) : null}
              </label>
            ) : null}
            <label>
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "email-error" : undefined}
                autoFocus={!isSignup}
              />
              {errors.email ? (
                <small id="email-error" className="auth-field-error">
                  {errors.email}
                </small>
              ) : null}
            </label>
            <label>
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                placeholder={
                  isSignup ? "At least 8 characters" : "Enter your password"
                }
                aria-invalid={Boolean(errors.password)}
                aria-describedby={
                  errors.password ? "password-error" : undefined
                }
              />
              {errors.password ? (
                <small id="password-error" className="auth-field-error">
                  {errors.password}
                </small>
              ) : null}
            </label>

            {formError ? (
              <div className="auth-error" role="alert">
                {formError}
              </div>
            ) : null}

            <button
              className="primary-button auth-submit"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait…"
                : isSignup
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="auth-alternate">
            {isSignup ? "Already have an account?" : "New to DevRelay?"}{" "}
            <button
              type="button"
              onClick={() => changeMode(isSignup ? "login" : "signup")}
            >
              {isSignup ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="auth-terms">
            By continuing, you agree to protect customer information shared in
            the tool.
          </p>
        </div>
      </section>
    </main>
  );
}
