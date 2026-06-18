import { VpnError, type ParsedVlessProfile } from "@/lib/vpn/types";

function parseHostPort(hostPort: string): { address: string; port: number } {
  if (hostPort.startsWith("[")) {
    const closeBracket = hostPort.indexOf("]");
    if (closeBracket < 0) {
      throw new VpnError("Invalid IPv6 address in VLESS URL", "INVALID_URL");
    }
    const address = hostPort.slice(1, closeBracket);
    const portPart = hostPort.slice(closeBracket + 1);
    if (!portPart.startsWith(":")) {
      throw new VpnError("Missing port in VLESS URL", "INVALID_URL");
    }
    const port = Number.parseInt(portPart.slice(1), 10);
    if (!Number.isFinite(port)) {
      throw new VpnError("Invalid port in VLESS URL", "INVALID_URL");
    }
    return { address, port };
  }

  const colonIndex = hostPort.lastIndexOf(":");
  if (colonIndex <= 0) {
    throw new VpnError("Missing port in VLESS URL", "INVALID_URL");
  }

  const address = hostPort.slice(0, colonIndex);
  const port = Number.parseInt(hostPort.slice(colonIndex + 1), 10);
  if (!Number.isFinite(port)) {
    throw new VpnError("Invalid port in VLESS URL", "INVALID_URL");
  }

  return { address, port };
}

function readSecurity(value: string | null): ParsedVlessProfile["security"] {
  if (value === "reality" || value === "tls" || value === "none") {
    return value;
  }
  return "none";
}

function validateEncryption(raw: string): string {
  // Xray-core supported encryptions (VLESS)
  const validEncryptions = [
    "none",
    "aes-128-gcm",
    "aes-256-gcm",
    "chacha20-poly1305",
    "auto",
  ];
  
  // If encryption contains dots or is very long, it's likely a malformed key exchange param
  if (raw.includes(".") || raw.length > 30) {
    console.warn(
      `Invalid encryption format: "${raw}". This looks like a key exchange parameter, not encryption method.`,
    );
    // Try to extract the base method (first part before dot)
    const base = raw.split(".")[0];
    if (validEncryptions.includes(base)) {
      return base;
    }
    // Default to none if can't parse
    return "none";
  }
  
  // If it's a valid encryption, return it
  if (validEncryptions.includes(raw)) {
    return raw;
  }
  
  // Unknown encryption, default to none
  console.warn(`Unknown encryption: "${raw}", defaulting to "none"`);
  return "none";
}

export function parseVlessUrl(raw: string): ParsedVlessProfile {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith("vless://")) {
    throw new VpnError("URL must start with vless://", "INVALID_URL");
  }

  const withoutScheme = trimmed.slice("vless://".length);
  const hashIndex = withoutScheme.indexOf("#");
  const remark =
    hashIndex >= 0
      ? decodeURIComponent(withoutScheme.slice(hashIndex + 1))
      : undefined;
  const main =
    hashIndex >= 0 ? withoutScheme.slice(0, hashIndex) : withoutScheme;

  const queryIndex = main.indexOf("?");
  const queryString = queryIndex >= 0 ? main.slice(queryIndex + 1) : "";
  const authority = queryIndex >= 0 ? main.slice(0, queryIndex) : main;

  const atIndex = authority.lastIndexOf("@");
  if (atIndex <= 0) {
    throw new VpnError("VLESS URL is missing UUID@host:port", "INVALID_URL");
  }

  const id = decodeURIComponent(authority.slice(0, atIndex));
  const { address, port } = parseHostPort(authority.slice(atIndex + 1));
  const params = new URLSearchParams(queryString);

  const network = params.get("type") ?? "tcp";
  const security = readSecurity(params.get("security"));
  const encryptionRaw = params.get("encryption") ?? "none";
  
  // Validate encryption format - should be simple method, not complex key exchange params
  // Valid: aes-128-gcm, chacha20-poly1305, none
  // Invalid: mlkem768x25519plus.native.0rtt.xxx (this is key exchange, not encryption)
  const encryption = validateEncryption(encryptionRaw);
  const flow = params.get("flow") ?? undefined;

  const profile: ParsedVlessProfile = {
    id,
    address,
    port,
    remark,
    encryption,
    flow,
    network,
    security,
  };

  if (security === "reality") {
    const serverName = params.get("sni") ?? params.get("serverName");
    const publicKey = params.get("pbk") ?? params.get("publicKey");
    const shortId = params.get("sid") ?? params.get("shortId") ?? "";
    const fingerprint = params.get("fp") ?? params.get("fingerprint") ?? "chrome";

    if (!serverName || !publicKey) {
      throw new VpnError(
        "Reality links require sni and pbk query parameters",
        "INVALID_REALITY",
      );
    }

    profile.reality = {
      serverName,
      fingerprint,
      publicKey,
      shortId,
      spiderX: params.get("spx") ?? params.get("spiderX") ?? undefined,
    };
  }

  if (security === "tls") {
    profile.tls = {
      serverName: params.get("sni") ?? params.get("host") ?? address,
      fingerprint: params.get("fp") ?? undefined,
      alpn: params.get("alpn")?.split(",") ?? undefined,
    };
  }

  if (network === "xhttp") {
    profile.xhttp = {
      path: decodeURIComponent(params.get("path") ?? "/"),
      mode: params.get("mode") ?? undefined,
      host: params.get("host") ?? undefined,
    };
  }

  if (network === "ws") {
    profile.ws = {
      path: decodeURIComponent(params.get("path") ?? "/"),
      host: params.get("host") ?? undefined,
    };
  }

  if (network === "grpc") {
    profile.grpc = {
      serviceName: params.get("serviceName") ?? params.get("path") ?? "",
    };
  }

  return profile;
}
