# Server Metadata Setup Guide

Bu rehber, yeni VPN sunucuları eklerken metadata yapısını nasıl kullanacağınızı açıklar.

## Mevcut Yapı

Şu anda sistem tek bir Finlandiya sunucusu kullanıyor:
- **Ülke**: Финляндия (Finlandiya)
- **Şehir**: Хельсинки (Helsinki)
- **Flag**: 🇫🇮
- **Kod**: FI

## Yeni Sunucu Ekleme

### 1. Adım: Metadata Kaydı Ekleme

`lib/vpn/ServerMetadata.ts` dosyasını açın ve `SERVER_METADATA_REGISTRY` içine yeni ülke ekleyin:

```typescript
export const SERVER_METADATA_REGISTRY: Record<string, ServerMetadata> = {
  FI: {
    countryCode: "FI",
    countryNameRu: "Финляндия",
    city: "Хельсинки",
    flag: "🇫🇮",
  },
  
  // Yeni sunucu örneği - Almanya
  DE: {
    countryCode: "DE",
    countryNameRu: "Германия",
    city: "Франкфурт",
    flag: "🇩🇪",
  },
};
```

### 2. Adım: Otomatik Algılama Ekleme (Opsiyonel)

Eğer sunucu adresinden veya remark'tan ülke otomatik algılanmasını istiyorsanız, 
`detectCountryCode` fonksiyonuna pattern ekleyin:

```typescript
export function detectCountryCode(address: string, remark: string): string {
  const combined = `${address} ${remark}`.toLowerCase();
  
  if (combined.includes("finland") || combined.includes("helsinki") || combined.includes("fi")) {
    return "FI";
  }
  
  // Yeni pattern ekleyin
  if (combined.includes("germany") || combined.includes("frankfurt") || combined.includes("de")) {
    return "DE";
  }
  
  // Varsayılan olarak Finlandiya döner
  return "FI";
}
```

### 3. Adım: VLESS Link Ekleme

Yeni sunucunun VLESS linkini ekleyin:
- Uygulama otomatik olarak ülke kodunu algılayacak
- Metadata registry'den bilgileri çekecek
- UI'da flag ve ülke adını gösterecek

## Örnek Ülkeler

İşte ekleyebileceğiniz hazır metadata örnekleri:

```typescript
// Almanya
DE: {
  countryCode: "DE",
  countryNameRu: "Германия",
  city: "Франкфурт",
  flag: "🇩🇪",
}

// Hollanda
NL: {
  countryCode: "NL",
  countryNameRu: "Нидерланды",
  city: "Амстердам",
  flag: "🇳🇱",
}

// Türkiye
TR: {
  countryCode: "TR",
  countryNameRu: "Турция",
  city: "Стамбул",
  flag: "🇹🇷",
}

// ABD
US: {
  countryCode: "US",
  countryNameRu: "США",
  city: "Нью-Йорк",
  flag: "🇺🇸",
}

// İngiltere
GB: {
  countryCode: "GB",
  countryNameRu: "Великобритания",
  city: "Лондон",
  flag: "🇬🇧",
}

// Fransa
FR: {
  countryCode: "FR",
  countryNameRu: "Франция",
  city: "Париж",
  flag: "🇫🇷",
}
```

## UI'da Görünüm

Sunucu listesi şu şekilde görünecek:

```
🇫🇮 Финляндия
🇩🇪 Германия
🇳🇱 Нидерланды
```

Her sunucu için:
- Flag emoji otomatik gösterilir
- Ülke adı Rusça gösterilir
- Şehir bilgisi metadata'da saklanır (gelecekte kullanım için)

## Önemli Notlar

1. **GeoIP Kullanılmıyor**: Sistem external GeoIP servisine istek göndermez
2. **Metadata Tabanlı**: Tüm bilgiler local metadata'dan gelir
3. **Scalable**: Yeni ülke eklemek sadece 5 satır kod eklemek demektir
4. **Fallback**: Tanınmayan ülkeler için 🌐 ve "Неизвестно" gösterilir
5. **Mevcut Sistem Korunuyor**: VPN bağlantı, Xray Core ve 3'lü sistem değişmez

## Manuel Ülke Belirleme

Eğer otomatik algılama çalışmazsa, metadata'yı manuel ekleyebilirsiniz:

```typescript
const metadata = getServerMetadata("DE"); // Almanya için
```
