import {
  requireNativeModule,
  NativeModule,
  EventEmitter,
  Subscription,
} from "expo-modules-core";

import type { VpnStatus } from "../../../lib/vpn/types";

export interface SuProxyVpnModule extends NativeModule {
  start(configJson: string): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<VpnStatus>;
  prepare(): Promise<boolean>;
}

let emitter: EventEmitter | null = null;

function getEmitter(): EventEmitter {
  if (!emitter) {
    emitter = new EventEmitter(SuProxyVpnNative);
  }
  return emitter;
}

export const SuProxyVpnNative =
  requireNativeModule<SuProxyVpnModule>("SuProxyVpn");

export function subscribeVpnStatus(
  listener: (status: VpnStatus) => void,
): Subscription {
  return getEmitter().addListener("SuProxyVpnStatusChanged", (event) => {
    if (event?.status) {
      listener(event.status as VpnStatus);
    }
  });
}

export default SuProxyVpnNative;
