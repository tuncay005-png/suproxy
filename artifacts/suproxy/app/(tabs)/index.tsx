import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Path } from "react-native-svg";
import { useState, useRef, useEffect } from "react";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useColors } from "@/hooks/useColors";
import { useVpnConnection } from "@/hooks/useVpnConnection";
import { ru } from "@/lib/i18n";
import { scheduleExpiryNotification, cancelExpiryNotification } from "@/lib/notifications";
import {
  clearStoredKey,
  getActiveVlessUrl,
  loadStoredKey,
  saveKeyData,
  type StoredKeyData,
} from "@/lib/vpn/KeyStore";
import { resolveSubscriptionInput } from "@/lib/vpn/parseSubscription";
import { vpnService } from "@/lib/vpn/VpnService";

const STORAGE_TARIFF = "suproxy_tariff";

type TariffType = "trial" | "monthly";

interface TariffData {
  type: TariffType;
  startDate: string;
}

const TARIFF_DAYS: Record<TariffType, number> = {
  trial: 1,
  monthly: 30,
};

function calcRemainingDays(tariff: TariffData): number {
  const start = new Date(tariff.startDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(0, TARIFF_DAYS[tariff.type] - diffDays);
}

function getPingColor(ms: number): string {
  if (ms <= 50) return "#22C55E";
  if (ms <= 100) return "#EAB308";
  return "#EF4444";
}

const SERVERS_FALLBACK = [
  { flag: "🌐", name: "Сервер", ms: 0 },
];

export default function HomeScreen() {
  const colors = useColors();
  const [remainingDays, setRemainingDays] = useState(0);

  const [hasKey, setHasKey] = useState(false);
  const [keyData, setKeyData] = useState<StoredKeyData | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  const activeVlessUrl = keyData ? getActiveVlessUrl(keyData) : null;
  const vpn = useVpnConnection(activeVlessUrl);
  const { isConnected, isLoading, connectionTime, toggle, reconnect, disconnect, error: vpnError } = vpn;

  // Debounce flag to prevent rapid successive toggle calls
  const [toggleLocked, setToggleLocked] = useState(false);

  const [serversOpen, setServersOpen] = useState(false);
  const selectedServer = keyData?.selectedIndex ?? 0;

  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState("");

  const [showTariffModal, setShowTariffModal] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fillAnim = useRef(new Animated.Value(0)).current;
  const lineAnim = useRef(new Animated.Value(0)).current;
  const deleteAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    (async () => {
      const [storedKey, savedTariffRaw] = await Promise.all([
        loadStoredKey(),
        AsyncStorage.getItem(STORAGE_TARIFF),
      ]);
      if (storedKey) {
        setKeyData(storedKey);
        setHasKey(true);
      }
      if (savedTariffRaw) {
        const tariff: TariffData = JSON.parse(savedTariffRaw);
        setRemainingDays(calcRemainingDays(tariff));
      }
    })();
  }, []);

  const servers: { flag: string; name: string; ms: number }[] =
    keyData && keyData.nodes.length > 0
      ? keyData.nodes.map((node) => ({
          flag: "🌐",
          name: node.remark,
          ms: 0,
        }))
      : SERVERS_FALLBACK;

  useEffect(() => {
    Animated.timing(fillAnim, {
      toValue: isConnected ? 1 : 0,
      duration: isConnected ? 600 : 300,
      useNativeDriver: false,
    }).start();
  }, [fillAnim, isConnected]);

  // Periodic status check every 2 seconds to prevent UI desync
  // Ensures button always shows accurate VPN connection status
  useEffect(() => {
    const statusCheckInterval = setInterval(() => {
      try {
        // Attempt to sync VPN status from native module
        // This ensures UI state matches actual VPN connection state
        void vpnService.syncStatus?.();
      } catch (error) {
        // Silently ignore errors in periodic checks
      }
    }, 2000);

    return () => clearInterval(statusCheckInterval);
  }, []);

  // Unlock toggle after connection/disconnection completes
  useEffect(() => {
    if (!isLoading) {
      setToggleLocked(false);
    }
  }, [isLoading]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleConnect = () => {
    // Prevent rapid successive button presses (race condition protection)
    if (toggleLocked || isLoading) {
      return;
    }

    setToggleLocked(true);

    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    // Execute toggle and always reset lock, regardless of success/failure
    toggle()
      .catch((err) => {
        console.log("[HomeScreen] Toggle error:", err);
        // Error is already handled by VpnService, just ensure lock is released
      })
      .finally(() => {
        setToggleLocked(false);
      });
  };

  const importKeyInput = async (raw: string) => {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const nodes = await resolveSubscriptionInput(raw);
      const data: StoredKeyData = {
        input: raw.trim(),
        nodes,
        selectedIndex: 0,
      };
      await saveKeyData(data.input, data.nodes, data.selectedIndex);
      setKeyData(data);
      setHasKey(true);
      setShowKeyModal(false);
      setInputKey("");
    } catch (error) {
      setKeyError(
        error instanceof Error ? error.message : "Не удалось обработать ключ",
      );
    } finally {
      setKeyLoading(false);
    }
  };

  const handleAddKey = async () => {
    try {
      const clipboardText = await Clipboard.getStringAsync();
      if (clipboardText && clipboardText.trim()) {
        await importKeyInput(clipboardText.trim());
        return;
      }
    } catch {
      // ignore
    }
    setShowKeyModal(true);
  };

  const handleSaveKey = async () => {
    if (inputKey.trim()) {
      await importKeyInput(inputKey.trim());
    }
  };

  const handleCloseModal = () => {
    setShowKeyModal(false);
    setInputKey("");
    setKeyError(null);
  };

  const handleSelectTariff = async (type: TariffType) => {
    const startDate = new Date();
    const tariff: TariffData = { type, startDate: startDate.toISOString() };
    await AsyncStorage.setItem(STORAGE_TARIFF, JSON.stringify(tariff));
    setRemainingDays(TARIFF_DAYS[type]);
    setShowTariffModal(false);
    if (type === "monthly") {
      await scheduleExpiryNotification(startDate, TARIFF_DAYS.monthly);
    }
  };

  const handleDeleteKey = () => {
    Animated.timing(deleteAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start(async () => {
      await disconnect();
      await clearStoredKey();
      cancelExpiryNotification();
      setHasKey(false);
      setKeyData(null);
      setServersOpen(false);
      Animated.timing(deleteAnim, { toValue: 0, duration: 0, useNativeDriver: false }).start();
    });
  };

  const handleSelectServer = async (index: number) => {
    if (!keyData || index === keyData.selectedIndex) return;
    const next: StoredKeyData = { ...keyData, selectedIndex: index };
    await saveKeyData(next.input, next.nodes, next.selectedIndex);
    setKeyData(next);
    vpnService.setActiveKey(getActiveVlessUrl(next));
    if (isConnected) {
      void reconnect();
    }
  };

  const handleToggleServers = () => {
    setServersOpen(!serversOpen);
    Animated.timing(lineAnim, {
      toValue: serversOpen ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const fillColor = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#9CA3AF", "#24A1DE"],
  });

  const lineWidth = lineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 6],
  });

  const keyModal = (
    <Modal
      visible={showKeyModal}
      transparent={true}
      animationType="fade"
      onRequestClose={handleCloseModal}
    >
      <View style={styles.modalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardAvoidingView}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Добавить ключ</Text>
            <Text style={styles.modalSubtitle}>
              Вставьте vless:// ключ или ссылку подписки 3X-UI
            </Text>
            <TextInput
              style={styles.textInput}
              value={inputKey}
              onChangeText={setInputKey}
              placeholder="vless://... или https://panel/sub/..."
              placeholderTextColor="#CCCCCC"
              multiline={false}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={true}
            />
            {keyError ? (
              <Text style={styles.errorText}>{keyError}</Text>
            ) : null}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={handleCloseModal} activeOpacity={0.8}>
                <Text style={styles.cancelButtonText}>{ru.common.cancel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveButton, (!inputKey.trim() || keyLoading) && styles.saveButtonDisabled]}
                onPress={handleSaveKey}
                activeOpacity={0.8}
                disabled={!inputKey.trim() || keyLoading}
              >
                {keyLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>{ru.common.save}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );

  const tariffModal = (
    <Modal
      visible={showTariffModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowTariffModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Выберите тариф</Text>
          <Text style={styles.modalSubtitle}>
            Выберите подходящий план подключения
          </Text>

          <TouchableOpacity
            style={styles.tariffOption}
            onPress={() => handleSelectTariff("trial")}
            activeOpacity={0.8}
          >
            <View style={styles.tariffInfo}>
              <Text style={styles.tariffName}>Пробный</Text>
              <Text style={styles.tariffDays}>1 день</Text>
            </View>
            <View style={styles.tariffBadge}>
              <Text style={styles.tariffBadgeText}>Бесплатно</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tariffOption, styles.tariffOptionPrimary]}
            onPress={() => handleSelectTariff("monthly")}
            activeOpacity={0.8}
          >
            <View style={styles.tariffInfo}>
              <Text style={[styles.tariffName, { color: "#FFFFFF" }]}>1 месяц</Text>
              <Text style={[styles.tariffDays, { color: "#FFFFFF" }]}>30 дней</Text>
            </View>
            <View style={styles.tariffBadgePrimary}>
              <Text style={styles.tariffBadgePrimaryText}>Популярный</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTariffModal(false)} activeOpacity={0.8}>
            <Text style={styles.cancelButtonText}>{ru.common.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (!hasKey) {
    return (
      <>
        <ScreenContainer style={styles.noKeyContainer}>
          <View style={styles.keyButtonsContainer}>
            <TouchableOpacity style={styles.addKeyButton} onPress={handleAddKey} activeOpacity={0.8}>
              <Text style={styles.addKeyButtonText}>{ru.home.addKey}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buyKeyButton} activeOpacity={0.8}>
              <Text style={styles.buyKeyButtonText}>{ru.home.buyKey}</Text>
            </TouchableOpacity>
          </View>
        </ScreenContainer>
        {keyModal}
        {tariffModal}
      </>
    );
  }

  return (
    <>
      <ScreenContainer style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.mainContent}>
            <View style={styles.connectSection}>
              <TouchableOpacity 
                onPress={handleConnect} 
                activeOpacity={0.8}
                disabled={toggleLocked || isLoading}
                pointerEvents={toggleLocked || isLoading ? "none" : "auto"}
              >
                <Animated.View
                  style={[
                    styles.connectButton,
                    {
                      borderColor: isConnected ? "#24A1DE" : "#9CA3AF",
                      transform: [{ scale: scaleAnim }],
                      opacity: toggleLocked || isLoading ? 0.6 : 1,
                    },
                  ]}
                >
                  <Animated.View style={[styles.fillOverlay, { backgroundColor: fillColor }]} />
                  {isLoading ? (
                    <ActivityIndicator size="large" color={colors.primary} />
                  ) : (
                    <Text style={[styles.connectLetter, { color: isConnected ? "#24A1DE" : "#9CA3AF" }]}>
                      S
                    </Text>
                  )}
                </Animated.View>
              </TouchableOpacity>

              <View style={styles.statusContainer}>
                <Text style={[styles.statusText, { color: isConnected ? "#22C55E" : "#EF4444" }]}>
                  {isConnected ? ru.home.connected : ru.home.notConnected}
                </Text>
                <Text style={[styles.timerText, { opacity: isConnected ? 1 : 0 }]}>
                  {formatTime(connectionTime)}
                </Text>
                {vpnError ? (
                  <Text style={styles.errorText}>{vpnError}</Text>
                ) : null}
              </View>
            </View>

            <View style={{ height: 44 }} />

            <View style={styles.serversSection}>
              <TouchableOpacity
                onPress={handleToggleServers}
                style={[styles.serversHeader, { backgroundColor: "#F5F5F5" }]}
                activeOpacity={0.7}
              >
                <Animated.View style={[styles.serversLine, { width: lineWidth, backgroundColor: colors.primary }]} />
                <Text style={styles.serversTitle}>{ru.home.servers}</Text>
                <Text style={styles.serversChevron}>{serversOpen ? "▲" : "▼"}</Text>
                <TouchableOpacity onPress={handleDeleteKey} activeOpacity={0.7} style={styles.trashButton}>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 7h16" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" />
                    <Path d="M10 5h4" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" />
                    <Path d="M6 7l1 11a2 2 0 002 2h6a2 2 0 002-2l1-11" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                    <Path d="M10 11v5M14 11v5" stroke="#EF4444" strokeWidth={1.8} strokeLinecap="round" />
                  </Svg>
                </TouchableOpacity>
              </TouchableOpacity>

              {serversOpen && (
                <View style={styles.serverList}>
                  {servers.map((server, index) => (
                    <TouchableOpacity
                      key={`${server.name}-${index}`}
                      onPress={() => void handleSelectServer(index)}
                      style={[
                        styles.serverItem,
                        selectedServer === index ? styles.serverItemSelected : styles.serverItemDefault,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.serverFlag}>{server.flag}</Text>
                      <View style={styles.serverInfo}>
                        <Text style={[styles.serverName, { color: "#24A1DE" }]}>
                          {server.name}
                        </Text>
                      </View>
                      {server.ms > 0 ? (
                        <Text style={[styles.serverMs, { color: getPingColor(server.ms) }]}>
                          {server.ms}ms
                        </Text>
                      ) : null}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>

        <View style={styles.remainingDaysContainer}>
          <Text style={styles.remainingDaysText}>
            {ru.home.remainingDays}:{" "}
            <Text style={remainingDays < 3 ? { color: "#EF4444" } : undefined}>
              {remainingDays}
            </Text>
          </Text>
        </View>
      </ScreenContainer>
      {keyModal}
      {tariffModal}
    </>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 24 },
  noKeyContainer: { paddingHorizontal: 24, flex: 1, justifyContent: "center", paddingBottom: 110 },
  keyButtonsContainer: { width: "100%", gap: 16 },
  scrollContent: { flexGrow: 1 },
  mainContent: { flex: 1, gap: 32 },
  remainingDaysContainer: { alignItems: "center", justifyContent: "center", paddingVertical: 10 },
  remainingDaysText: { fontSize: 14, fontWeight: "800", color: "#24A1DE" },
  connectSection: { alignItems: "center", gap: 16, paddingTop: 96 },
  connectButton: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "#F5F5F5", justifyContent: "center",
    alignItems: "center", borderWidth: 3, overflow: "hidden",
  },
  fillOverlay: { position: "absolute", width: "100%", height: "100%", opacity: 0.2 },
  connectLetter: { fontSize: 56, fontWeight: "900", letterSpacing: 0.8, zIndex: 1 },
  statusContainer: { alignItems: "center", gap: 4 },
  statusText: { fontSize: 18, fontWeight: "800" },
  timerText: { fontSize: 14, fontWeight: "800", color: "#24A1DE" },
  addKeyButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#24A1DE", borderRadius: 16, paddingVertical: 16,
  },
  addKeyButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 21, letterSpacing: 0.8 },
  buyKeyButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F5F5F5", borderRadius: 16, paddingVertical: 16,
    borderWidth: 2, borderColor: "#24A1DE",
  },
  buyKeyButtonText: { color: "#24A1DE", fontWeight: "800", fontSize: 21, letterSpacing: 0.8 },
  serversSection: { gap: 12 },
  serversHeader: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 12, paddingVertical: 12, borderRadius: 16,
    borderWidth: 1, borderColor: "#E0E0E0",
  },
  serversLine: { height: 24, borderRadius: 2 },
  serversTitle: { fontSize: 20, fontWeight: "800", letterSpacing: 0.8, color: "#24A1DE", flex: 1 },
  serversChevron: { fontSize: 14, fontWeight: "800", color: "#24A1DE" },
  trashButton: { padding: 4, marginLeft: 4 },
  serverList: { gap: 8, marginTop: 8 },
  serverItem: {
    flexDirection: "row", alignItems: "center", gap: 6,
    borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8,
  },
  serverItemSelected: { backgroundColor: "#F5F5F5", borderWidth: 1.5, borderColor: "#24A1DE" },
  serverItemDefault: { backgroundColor: "#F5F5F5", borderWidth: 1.5, borderColor: "transparent" },
  serverFlag: { fontSize: 19 },
  serverInfo: { flex: 1 },
  serverName: { fontWeight: "800", fontSize: 15 },
  serverMs: { fontSize: 11, fontWeight: "800" },
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center", alignItems: "center",
  },
  keyboardAvoidingView: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  modalContent: {
    width: "85%", maxWidth: 400, backgroundColor: "#FFFFFF",
    borderRadius: 24, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 10,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "800", color: "#333333" },
  modalSubtitle: { fontSize: 14, fontWeight: "800", color: "#999999", lineHeight: 20, marginBottom: 4 },
  textInput: {
    borderWidth: 1, borderColor: "#E0E0E0", borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 14, color: "#333333",
    backgroundColor: "#FAFAFA",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  cancelButton: {
    paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: "#E0E0E0", alignItems: "center",
  },
  cancelButtonText: { fontSize: 16, fontWeight: "800", color: "#999999" },
  saveButton: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    backgroundColor: "#24A1DE", alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#B0D9F0" },
  saveButtonText: { fontSize: 16, fontWeight: "800", color: "#FFFFFF" },
  errorText: { fontSize: 13, fontWeight: "700", color: "#EF4444", textAlign: "center" },
  tariffOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderColor: "#E0E0E0", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 14,
  },
  tariffOptionPrimary: {
    backgroundColor: "#24A1DE", borderColor: "#24A1DE",
  },
  tariffInfo: { gap: 2 },
  tariffName: { fontSize: 16, fontWeight: "800", color: "#333333" },
  tariffDays: { fontSize: 13, fontWeight: "800", color: "#999999" },
  tariffBadge: {
    backgroundColor: "#F0F9FF", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tariffBadgeText: { fontSize: 12, fontWeight: "800", color: "#24A1DE" },
  tariffBadgePrimary: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tariffBadgePrimaryText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF" },
});
