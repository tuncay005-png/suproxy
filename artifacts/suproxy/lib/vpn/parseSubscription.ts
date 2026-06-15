import { parseVlessUrl } from "@/lib/vpn/parseVlessUrl";
import { VpnError, type ParsedVlessProfile } from "@/lib/vpn/types";

export interface SubscriptionNode {
  url: string;
  remark: string;
  profile: ParsedVlessProfile;
}

const SUBSCRIPTION_URL_PATTERN = /^https?:\/\//i;
const VLESS_LINE_PATTERN = /^vless:\/\//i;

function decodeSubscriptionBody(raw: string): string {
  const trimmed = raw.trim();

  if (VLESS_LINE_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const normalized = trimmed.replace(/\s/g, "");
  const padded =
    normalized + "=".repeat((4 - (normalized.length % 4)) % 4);

  try {
    const decoded = atob(padded);
    if (decoded.includes("://")) {
      return decoded;
    }
  } catch {
    // fall through
  }

  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function extractVlessLines(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => VLESS_LINE_PATTERN.test(line));
}

export function parseSubscriptionContent(raw: string): SubscriptionNode[] {
  if (!raw.trim()) {
    throw new VpnError("Subscription content is empty", "EMPTY_SUBSCRIPTION");
  }

  const decoded = decodeSubscriptionBody(raw);
  const lines = extractVlessLines(decoded);

  if (lines.length === 0) {
    throw new VpnError(
      "No vless:// links found in subscription",
      "NO_VLESS_NODES",
    );
  }

  const nodes: SubscriptionNode[] = [];

  for (const url of lines) {
    try {
      const profile = parseVlessUrl(url);
      nodes.push({
        url,
        remark: profile.remark ?? profile.address,
        profile,
      });
    } catch {
      // Skip unsupported or malformed lines (vmess, trojan, etc.)
    }
  }

  if (nodes.length === 0) {
    throw new VpnError(
      "Subscription contains no valid VLESS nodes",
      "NO_VALID_NODES",
    );
  }

  return nodes;
}

export function isSubscriptionUrl(input: string): boolean {
  return SUBSCRIPTION_URL_PATTERN.test(input.trim());
}

export async function fetchSubscription(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!isSubscriptionUrl(trimmed)) {
    throw new VpnError("Invalid subscription URL", "INVALID_SUBSCRIPTION_URL");
  }

  const response = await fetch(trimmed, {
    method: "GET",
    headers: {
      Accept: "*/*",
      "User-Agent": "SuProxy/1.0",
    },
  });

  if (!response.ok) {
    throw new VpnError(
      `Subscription fetch failed (${response.status})`,
      "SUBSCRIPTION_FETCH_FAILED",
    );
  }

  return response.text();
}

export async function resolveSubscriptionInput(
  input: string,
): Promise<SubscriptionNode[]> {
  const trimmed = input.trim();

  if (isSubscriptionUrl(trimmed)) {
    const body = await fetchSubscription(trimmed);
    return parseSubscriptionContent(body);
  }

  if (VLESS_LINE_PATTERN.test(trimmed)) {
    const profile = parseVlessUrl(trimmed);
    return [
      {
        url: trimmed,
        remark: profile.remark ?? profile.address,
        profile,
      },
    ];
  }

  return parseSubscriptionContent(trimmed);
}
