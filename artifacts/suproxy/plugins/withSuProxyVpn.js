const {
  withAndroidManifest,
  withInfoPlist,
  withEntitlementsPlist,
  AndroidConfig,
} = require("@expo/config-plugins");

const VPN_SERVICE = "com.app.suproxy.vpn.SuProxyVpnService";

function withSuProxyVpnAndroid(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const permissions = manifest["uses-permission"] ?? [];

    const required = [
      "android.permission.INTERNET",
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.ACCESS_NETWORK_STATE",
    ];

    for (const name of required) {
      if (!permissions.some((p) => p.$?.["android:name"] === name)) {
        permissions.push({ $: { "android:name": name } });
      }
    }

    manifest["uses-permission"] = permissions;

    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    app.service = app.service ?? [];

    const hasService = app.service.some(
      (s) => s.$?.["android:name"] === VPN_SERVICE,
    );

    if (!hasService) {
      app.service.push({
        $: {
          "android:name": VPN_SERVICE,
          "android:exported": "false",
          "android:foregroundServiceType": "specialUse",
          "android:permission": "android.permission.BIND_VPN_SERVICE",
        },
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.net.VpnService" } }],
          },
        ],
        property: [
          {
            $: {
              "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
              "android:value": "vpn",
            },
          },
        ],
      });
    }

    return config;
  });
}

function withSuProxyVpnIos(config) {
  config = withEntitlementsPlist(config, (config) => {
    config.modResults["com.apple.developer.networking.networkextension"] = [
      "packet-tunnel-provider",
    ];
    config.modResults["com.apple.security.application-groups"] = [
      "group.com.app.suproxy",
    ];
    return config;
  });

  config = withInfoPlist(config, (config) => {
    config.modResults.NSLocalNetworkUsageDescription =
      "SuProxy needs local network access to establish the VPN tunnel.";
    return config;
  });

  return config;
}

function withSuProxyVpn(config) {
  config = withSuProxyVpnAndroid(config);
  config = withSuProxyVpnIos(config);
  return config;
}

module.exports = withSuProxyVpn;
