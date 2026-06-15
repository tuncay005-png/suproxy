import { Platform } from "react-native";

let Notifications: typeof import("expo-notifications") | null = null;

async function getNotifications() {
  if (Platform.OS === "web") return null;
  if (Notifications) return Notifications;
  try {
    Notifications = await import("expo-notifications");
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
    return Notifications;
  } catch {
    return null;
  }
}

const NOTIF_ID_KEY = "suproxy_notif_id";

export async function scheduleExpiryNotification(
  startDate: Date,
  totalDays: number
): Promise<void> {
  try {
    const notif = await getNotifications();
    if (!notif) return;

    await cancelExpiryNotification();

    const { status } = await notif.requestPermissionsAsync();
    if (status !== "granted") return;

    const notifyDate = new Date(startDate.getTime());
    notifyDate.setDate(notifyDate.getDate() + (totalDays - 3));
    if (notifyDate <= new Date()) return;

    const id = await notif.scheduleNotificationAsync({
      content: {
        title: "SuProxy — Подписка истекает",
        body: "До окончания вашего тарифа осталось 3 дня. Не забудьте продлить подписку!",
        sound: true,
      },
      trigger: {
        type: notif.SchedulableTriggerInputTypes.DATE,
        date: notifyDate,
      },
    });

    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(NOTIF_ID_KEY, id);
  } catch {
    // Notifications not supported in this environment (e.g. Expo Go)
  }
}

export async function cancelExpiryNotification(): Promise<void> {
  try {
    const notif = await getNotifications();
    if (!notif) return;

    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const id = await AsyncStorage.getItem(NOTIF_ID_KEY);
    if (id) {
      await notif.cancelScheduledNotificationAsync(id);
      await AsyncStorage.removeItem(NOTIF_ID_KEY);
    }
  } catch {
    // ignore
  }
}
