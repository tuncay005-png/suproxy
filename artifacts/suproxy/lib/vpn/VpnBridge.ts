import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import type { VpnStatus } from "@/lib/vpn/types";

export interface NativeVpnModule {
  start(configJson: string): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<VpnStatus>;
  prepare?: () => Promise<boolean>;
}

const MODULE_NAME = "SuProxyVpn";

function getLegacyNativeModule(): NativeVpnModule | null {
  const mod = NativeModules[MODULE_NAME] as NativeVpnModule | undefined;
  if (!mod?.start || !mod?.stop) {
    return null;
  }
  return mod;
}

function getExpoNativeModule(): NativeVpnModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { SuProxyVpnNative } = require("suproxy-vpn") as {
      SuProxyVpnNative?: NativeVpnModule;
    };
    if (SuProxyVpnNative?.start && SuProxyVpnNative?.stop) {
      return SuProxyVpnNative;
    }
  } catch {
    // expo module not linked yet
  }
  return null;
}

function getNativeModule(): NativeVpnModule | null {
  return getExpoNativeModule() ?? getLegacyNativeModule();
}

let mockStatus: VpnStatus = "disconnected";
let mockTimer: ReturnType<typeof setTimeout> | null = null;

const mockModule: NativeVpnModule = {
  async prepare() {
    return true;
  },
  async getStatus() {
    return mockStatus;
  },
  async start(_configJson: string) {
    if (mockTimer) {
      clearTimeout(mockTimer);
    }
    mockStatus = "connecting";
    await new Promise<void>((resolve) => {
      mockTimer = setTimeout(() => {
        mockStatus = "connected";
        mockTimer = null;
        resolve();
      }, 800);
    });
  },
  async stop() {
    if (mockTimer) {
      clearTimeout(mockTimer);
      mockTimer = null;
    }
    mockStatus = "disconnecting";
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        mockStatus = "disconnected";
        resolve();
      }, 300);
    });
  },
};

export function resolveVpnModule(): NativeVpnModule {
  const native = getNativeModule();
  if (native) {
    return native;
  }

  if (Platform.OS === "web") {
    return mockModule;
  }

  if (__DEV__) {
    console.warn(
      `[SuProxyVpn] Native module "${MODULE_NAME}" not found. Using dev mock. ` +
        "Run: npx expo prebuild && npx expo run:android (or run:ios)",
    );
    return mockModule;
  }

  throw new Error(
    `Native VPN module "${MODULE_NAME}" is not linked. Build a dev client with expo prebuild.`,
  );
}

export function subscribeNativeVpnEvents(
  onStatusChange: (status: VpnStatus) => void,
): () => void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { subscribeVpnStatus } = require("suproxy-vpn") as {
      subscribeVpnStatus?: (
        cb: (status: VpnStatus) => void,
      ) => { remove: () => void };
    };
    if (subscribeVpnStatus) {
      const sub = subscribeVpnStatus(onStatusChange);
      return () => sub.remove();
    }
  } catch {
    // fall through to legacy emitter
  }

  const native = getLegacyNativeModule();
  if (!native) {
    return () => {};
  }

  const emitter = new NativeEventEmitter(
    NativeModules[MODULE_NAME] as object | undefined,
  );

  const subscription = emitter.addListener(
    "SuProxyVpnStatusChanged",
    (payload: { status?: VpnStatus }) => {
      if (payload?.status) {
        onStatusChange(payload.status);
      }
    },
  );

  return () => subscription.remove();
}
