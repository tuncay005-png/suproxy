import type { ParsedVlessProfile } from "@/lib/vpn/types";

interface BuildXrayConfigOptions {
  socksPort?: number;
  tunInbound?: boolean;
}

function buildStreamSettings(profile: ParsedVlessProfile): Record<string, unknown> {
  const streamSettings: Record<string, unknown> = {
    network: profile.network,
    security: profile.security,
  };

  if (profile.security === "reality" && profile.reality) {
    streamSettings.realitySettings = {
      show: false,
      fingerprint: profile.reality.fingerprint,
      serverName: profile.reality.serverName,
      publicKey: profile.reality.publicKey,
      shortId: profile.reality.shortId,
      ...(profile.reality.spiderX ? { spiderX: profile.reality.spiderX } : {}),
    };
  }

  if (profile.security === "tls" && profile.tls) {
    streamSettings.tlsSettings = {
      serverName: profile.tls.serverName,
      ...(profile.tls.fingerprint
        ? { fingerprint: profile.tls.fingerprint }
        : {}),
      ...(profile.tls.alpn ? { alpn: profile.tls.alpn } : {}),
    };
  }

  if (profile.network === "xhttp" && profile.xhttp) {
    streamSettings.xhttpSettings = {
      path: profile.xhttp.path,
      ...(profile.xhttp.mode ? { mode: profile.xhttp.mode } : {}),
      ...(profile.xhttp.host ? { host: profile.xhttp.host } : {}),
    };
  }

  if (profile.network === "ws" && profile.ws) {
    streamSettings.wsSettings = {
      path: profile.ws.path,
      ...(profile.ws.host ? { headers: { Host: profile.ws.host } } : {}),
    };
  }

  if (profile.network === "grpc" && profile.grpc) {
    streamSettings.grpcSettings = {
      serviceName: profile.grpc.serviceName,
    };
  }

  return streamSettings;
}

export function buildXrayClientConfig(
  profile: ParsedVlessProfile,
  options: BuildXrayConfigOptions = {},
): string {
  const socksPort = options.socksPort ?? 10808;

  const user: Record<string, string> = {
    id: profile.id,
    encryption: profile.encryption,
  };
  if (profile.flow) {
    user.flow = profile.flow;
  }

  const inbounds: Record<string, unknown>[] = options.tunInbound
    ? [
        {
          tag: "tun-in",
          protocol: "tun",
          settings: {
            mtu: 9000,
          },
          sniffing: {
            enabled: true,
            destOverride: ["http", "tls", "quic"],
          },
        },
      ]
    : [
        {
          tag: "socks-in",
          listen: "127.0.0.1",
          port: socksPort,
          protocol: "socks",
          settings: {
            auth: "noauth",
            udp: true,
          },
          sniffing: {
            enabled: true,
            destOverride: ["http", "tls", "quic"],
          },
        },
      ];

  const config = {
    log: {
      loglevel: "warning",
    },
    dns: {
      servers: ["1.1.1.1", "8.8.8.8"],
    },
    inbounds,
    outbounds: [
      {
        tag: "proxy",
        protocol: "vless",
        settings: {
          vnext: [
            {
              address: profile.address,
              port: profile.port,
              users: [user],
            },
          ],
        },
        streamSettings: buildStreamSettings(profile),
      },
      {
        tag: "direct",
        protocol: "freedom",
      },
      {
        tag: "block",
        protocol: "blackhole",
      },
    ],
    routing: {
      domainStrategy: "AsIs",
      rules: [
        {
          type: "field",
          outboundTag: "proxy",
          network: "tcp,udp",
        },
      ],
    },
  };

  return JSON.stringify(config);
}
