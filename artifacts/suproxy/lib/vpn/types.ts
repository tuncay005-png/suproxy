export type VpnStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "disconnecting"
  | "error";

export interface ParsedVlessProfile {
  id: string;
  address: string;
  port: number;
  remark?: string;
  encryption: string;
  flow?: string;
  network: string;
  security: "reality" | "tls" | "none";
  reality?: {
    serverName: string;
    fingerprint: string;
    publicKey: string;
    shortId: string;
    spiderX?: string;
  };
  tls?: {
    serverName: string;
    fingerprint?: string;
    alpn?: string[];
  };
  xhttp?: {
    path: string;
    mode?: string;
    host?: string;
  };
  ws?: {
    path: string;
    host?: string;
  };
  grpc?: {
    serviceName: string;
  };
}

export interface VpnState {
  status: VpnStatus;
  error: string | null;
  connectedAt: number | null;
}

export class VpnError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "VpnError";
  }
}
