// Provider-independent boundary shared by outgoing staging mail. Values and
// tokens never become client configuration. Local SMTP accepts only test data.
export function isAllowedMailRecipient(email, {environment, allowlist = ''}) {
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return false;
  const normalized = email.trim().toLowerCase();
  if (environment === 'local') return normalized.endsWith('@example.test');
  if (environment !== 'staging') return false;
  return allowlist.split(/[\s,;]+/).filter(Boolean).some((allowed) => allowed.toLowerCase() === normalized);
}
