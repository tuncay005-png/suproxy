import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  resolveSubscriptionInput,
  type SubscriptionNode,
} from "@/lib/vpn/parseSubscription";

const STORAGE_INPUT = "suproxy_active_key";
const STORAGE_NODES = "suproxy_subscription_nodes";
const STORAGE_SELECTED_INDEX = "suproxy_selected_node_index";

export interface StoredKeyData {
  input: string;
  nodes: SubscriptionNode[];
  selectedIndex: number;
}

export async function loadStoredKey(): Promise<StoredKeyData | null> {
  const input = await AsyncStorage.getItem(STORAGE_INPUT);
  if (!input) {
    return null;
  }

  const [nodesRaw, selectedRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_NODES),
    AsyncStorage.getItem(STORAGE_SELECTED_INDEX),
  ]);

  if (nodesRaw) {
    try {
      const nodes = JSON.parse(nodesRaw) as SubscriptionNode[];
      const selectedIndex = selectedRaw ? Number.parseInt(selectedRaw, 10) : 0;
      return {
        input,
        nodes,
        selectedIndex: Number.isFinite(selectedIndex) ? selectedIndex : 0,
      };
    } catch {
      // fall through to re-parse
    }
  }

  const nodes = await resolveSubscriptionInput(input);
  await saveKeyData(input, nodes, 0);
  return { input, nodes, selectedIndex: 0 };
}

export async function saveKeyData(
  input: string,
  nodes: SubscriptionNode[],
  selectedIndex: number,
): Promise<void> {
  const safeIndex = Math.max(0, Math.min(selectedIndex, nodes.length - 1));
  await Promise.all([
    AsyncStorage.setItem(STORAGE_INPUT, input.trim()),
    AsyncStorage.setItem(STORAGE_NODES, JSON.stringify(nodes)),
    AsyncStorage.setItem(STORAGE_SELECTED_INDEX, String(safeIndex)),
  ]);
}

export async function clearStoredKey(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(STORAGE_INPUT),
    AsyncStorage.removeItem(STORAGE_NODES),
    AsyncStorage.removeItem(STORAGE_SELECTED_INDEX),
  ]);
}

export function getActiveVlessUrl(data: StoredKeyData): string | null {
  const node = data.nodes[data.selectedIndex];
  return node?.url ?? null;
}
