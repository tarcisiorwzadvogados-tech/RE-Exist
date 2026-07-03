// Thin PostHog wrapper. No-ops entirely unless POSTHOG_KEY is configured at build
// time, so local dev and BYOK-only deployments ship zero analytics code paths.
type EventProps = Record<string, string | number | boolean | undefined>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;
let initStarted = false;

const KEY = process.env.POSTHOG_KEY;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

async function ensureInit(): Promise<void> {
  if (!KEY || initStarted) return;
  initStarted = true;
  try {
    const { default: posthog } = await import('posthog-js');
    posthog.init(KEY, {
      api_host: HOST,
      autocapture: false,
      capture_pageview: true,
      persistence: 'localStorage',
    });
    client = posthog;
  } catch {
    // Analytics must never break the app
  }
}

export function track(event: string, props?: EventProps): void {
  if (!KEY) return;
  ensureInit().then(() => client?.capture(event, props));
}
