const redactionPatterns: Array<{
  name: string;
  pattern: RegExp;
  replacement: string;
}> = [
  {
    name: "API keys",
    pattern: /\b(?:sk|ghp|github_pat)-[a-z0-9_-]{12,}\b/gi,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "Bearer tokens",
    pattern: /\bBearer\s+[a-z0-9._~+/=-]{12,}/gi,
    replacement: "Bearer [REDACTED_TOKEN]",
  },
  {
    name: "Passwords",
    pattern: /\b(password|passwd|secret)\s*[=:]\s*[^\s,;]+/gi,
    replacement: "$1=[REDACTED]",
  },
  {
    name: "Email addresses",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
];

export function sanitizeSensitiveText(value: string): {
  value: string;
  redactions: string[];
} {
  const redactions: string[] = [];
  let sanitized = value;

  for (const item of redactionPatterns) {
    const matches = sanitized.match(item.pattern);
    if (matches?.length) {
      redactions.push(`${item.name}: ${matches.length}`);
      sanitized = sanitized.replace(item.pattern, item.replacement);
    }
  }

  return { value: sanitized, redactions };
}

export function safeRepositoryExcerpt(value: string): string {
  return sanitizeSensitiveText(value).value.slice(0, 420);
}
