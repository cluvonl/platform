// A return path identifies a view only. Membership and each resource/action
// remain independently authorized by the native server after authentication.
export const mobileReturnHeader = 'x-cluvo-mobile-return';
export const mobileReturnCookie = 'cluvo_app_otp_return';
const screens = new Set(['home','tasks','agenda','teams','more','actions','notifications','manage','profile','household','policies','courses','opportunities','messages','settings','help','install','reports','finance','committees']);
const resourceKeys = new Set(['task','booking','allocation','transfer','reserve','team','member','channel','household','season','committee','card','doc','question','handover']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tabs: Record<string, Set<string>> = {tasks:new Set(['market','mine','takeovers']),teams:new Set(['tasks','progress','organize']),manage:new Set(['plan','confirm','requests']),committees:new Set(['tasks','documents'])};
const views: Record<string, Set<string>> = {tasks:new Set(['filters']),teams:new Set(['handover','distribution','create','goal','deadlines','feedback','assign']),manage:new Set(['create','cluster']),committees:new Set(['create-card']),household:new Set(['invite','question']),help:new Set(['request'])};
export function mobileReturnPath(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 1600 || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  try {
    const parsed = new URL(value, 'https://cluvo.invalid');
    if (parsed.origin !== 'https://cluvo.invalid' || parsed.hash || parsed.username || parsed.password) return null;
    if (parsed.pathname === '/app/workspaces') return parsed.search ? null : '/app/workspaces';
    const match = /^\/app\/c\/([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\/([a-z]+)$/.exec(parsed.pathname);
    if (!match || !screens.has(match[2]) || value.split('?')[0] !== parsed.pathname) return null;
    const selected = new URLSearchParams();
    for (const [key, field] of parsed.searchParams) {
      if (selected.has(key)) return null;
      if (key === 'view' ? !uuid.test(field) && !views[match[2]]?.has(field) : resourceKeys.has(key) ? !uuid.test(field) : key !== 'tab' || !tabs[match[2]]?.has(field)) return null;
      selected.set(key, field);
    }
    return parsed.pathname + (selected.size ? '?' + selected.toString() : '');
  } catch { return null; }
}
export function mobileReturnTenant(value: string): string | null {
  const safe = mobileReturnPath(value);
  return safe ? /^\/app\/c\/([^/]+)\//.exec(safe)?.[1] ?? null : null;
}
export function mobileLoginPath(value: unknown): string {
  const safe = mobileReturnPath(value);
  return safe ? '/app/login?next=' + encodeURIComponent(safe) : '/app/login';
}
