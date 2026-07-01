# Ping Measurement System

Bu sistem, VLESS sunucularının gerçek zamanlı gecikme (latency/ping) ölçümünü sağlar.

## Özellikler

✅ **Gerçek Ping Ölçümü**: Cloudflare'in 1.1.1.1 endpoint'i kullanılarak gerçek latency ölçülür
✅ **Periyodik Güncelleme**: Her 25 saniyede bir otomatik ping ölçümü
✅ **Renkli Gösterim**: Gecikme değerine göre yeşil/sarı/kırmızı renk kodlaması
✅ **Çoklu Sunucu Desteği**: Tüm sunucular için eş zamanlı ping ölçümü
✅ **Optimized**: İlk ping 2 saniye sonra, sonraki pinglar 25 saniye aralıkla

## Dosya Yapısı

### 1. `PingService.ts`
Ana ping ölçüm servisi. Sunuculara HTTP HEAD request atarak latency ölçer.

```typescript
// Kullanım
import { pingService } from "@/lib/vpn/PingService";

const result = await pingService.measureLatency(profile);
console.log(result.latency); // 45 (ms)

const color = pingService.getPingColor(45); // "#22C55E" (yeşil)
const text = pingService.formatLatency(45); // "45 ms"
```

### 2. `usePingMonitor.ts`
React hook. Sunucu listesini izler ve periyodik ping ölçümü yapar.

```typescript
// Kullanım
import { usePingMonitor, getServerLatency } from "@/hooks/usePingMonitor";

const pingMonitor = usePingMonitor(nodes);

// Belirli bir sunucunun latency'sini al
const latency = getServerLatency(pingMonitor.results, "server.address.com");
```

### 3. `index.tsx` (UI)
Ping değerlerini sunucu listesinde gösterir.

## Renk Kodları

| Latency | Renk | Hex Code | Anlamı |
|---------|------|----------|--------|
| 0-50 ms | 🟢 Yeşil | `#22C55E` | Mükemmel |
| 51-100 ms | 🟡 Sarı | `#EAB308` | İyi |
| 101+ ms | 🔴 Kırmızı | `#EF4444` | Yavaş |
| Bilinmeyen | ⚪ Gri | `#9CA3AF` | Ölçülemiyor |

## Zaman Ayarları

```typescript
const PING_TIMEOUT_MS = 5000;        // 5 saniye timeout
const PING_INTERVAL_MS = 25000;      // 25 saniye periyot
const INITIAL_PING_DELAY_MS = 2000;  // 2 saniye ilk gecikme
```

## UI Tasarımı

Sunucu satırında sadece text olarak gösterilir:

```
🇫🇮 Финляндия                     18 ms  (yeşil)
🇩🇪 Германия                      74 ms  (sarı)
🇳🇱 Нидерланды                   124 ms  (kırmızı)
```

**Tasarım Kuralları:**
- İkon, badge, daire kullanılmaz
- Sadece metin ve renk
- Sağa hizalı, 45px minimum genişlik
- Font: 13px, weight: 800

## Nasıl Çalışır?

1. **Uygulama Açılır**: 2 saniye bekler
2. **İlk Ping**: Tüm sunucular için ping ölçümü yapılır
3. **Periyodik**: Her 25 saniyede bir ping tekrarlanır
4. **UI Güncellenir**: Yeni ping değerleri otomatik gösterilir

## HTTP Request Detayları

```typescript
// Cloudflare'in hızlı endpoint'i kullanılır
const PING_ENDPOINT = "https://1.1.1.1/cdn-cgi/trace";

// HEAD request (lightweight, sadece header döner)
fetch(PING_ENDPOINT, {
  method: "HEAD",
  signal: controller.signal,
  cache: "no-store",
});

// Round-trip time = End time - Start time
const latency = Date.now() - startTime;
```

## Gelecek Genişlemeler

Sistem kolayca genişletilebilir:

- **Manual Ping**: Kullanıcı butona basarak anında ping ölçebilir
- **Ping History**: Son 10 ping değerini sakla ve grafik göster
- **Smart Server Selection**: En düşük ping'e sahip sunucuyu otomatik seç
- **Ping Failed Alert**: Ping sürekli başarısız olursa uyar

## VPN Sistemi ile İlişki

**Önemli**: Ping sistemi VPN core'dan bağımsızdır:
- Xray Core'a dokunmaz
- VPN bağlantı mantığını değiştirmez
- 3'lü VPN sistemini etkilemez
- Sadece ölçüm ve gösterim yapar

Ping ölçümü **VPN bağlantısı olmadan** da çalışır, çünkü cihazın normal internet bağlantısını kullanır.
