/**
 * Server metadata for VPN nodes
 * Provides country information and display data for each server location
 */

export interface ServerMetadata {
  /** ISO 3166-1 alpha-2 country code (e.g., "FI", "DE", "TR") */
  countryCode: string;
  
  /** Country name in Russian */
  countryNameRu: string;
  
  /** City name in Russian */
  city: string;
  
  /** Flag emoji for the country */
  flag: string;
}

/**
 * Server metadata registry
 * Maps country codes to their display information
 */
export const SERVER_METADATA_REGISTRY: Record<string, ServerMetadata> = {
  FI: {
    countryCode: "FI",
    countryNameRu: "Финляндия",
    city: "Хельсинки",
    flag: "🇫🇮",
  },
  
  // Future servers can be added here:
  // DE: {
  //   countryCode: "DE",
  //   countryNameRu: "Германия",
  //   city: "Франкфурт",
  //   flag: "🇩🇪",
  // },
  // NL: {
  //   countryCode: "NL",
  //   countryNameRu: "Нидерланды",
  //   city: "Амстердам",
  //   flag: "🇳🇱",
  // },
  // TR: {
  //   countryCode: "TR",
  //   countryNameRu: "Турция",
  //   city: "Стамбул",
  //   flag: "🇹🇷",
  // },
};

/**
 * Get server metadata by country code
 * Returns default metadata if country code is not found
 */
export function getServerMetadata(countryCode: string): ServerMetadata {
  const metadata = SERVER_METADATA_REGISTRY[countryCode.toUpperCase()];
  
  if (metadata) {
    return metadata;
  }
  
  // Default fallback for unknown countries
  return {
    countryCode: countryCode.toUpperCase(),
    countryNameRu: "Неизвестно",
    city: "—",
    flag: "🌐",
  };
}

/**
 * Detect country code from server address or remark
 * This is a simple heuristic-based detection
 */
export function detectCountryCode(address: string, remark: string): string {
  const combined = `${address} ${remark}`.toLowerCase();
  
  // Check for known country indicators
  if (combined.includes("finland") || combined.includes("helsinki") || combined.includes("fi")) {
    return "FI";
  }
  
  // Add more detection patterns for future countries:
  // if (combined.includes("germany") || combined.includes("frankfurt") || combined.includes("de")) {
  //   return "DE";
  // }
  // if (combined.includes("netherlands") || combined.includes("amsterdam") || combined.includes("nl")) {
  //   return "NL";
  // }
  // if (combined.includes("turkey") || combined.includes("istanbul") || combined.includes("tr")) {
  //   return "TR";
  // }
  
  // Default to Finland for now (since we only have one server)
  return "FI";
}
