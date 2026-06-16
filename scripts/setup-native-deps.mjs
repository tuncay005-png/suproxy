import { execSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hevDir = join(
  root,
  "artifacts/suproxy/modules/suproxy-vpn/android/src/main/jni/hev-socks5-tunnel",
);
const xrayLibsDir = join(
  root,
  "artifacts/suproxy/modules/suproxy-vpn/android/libs",
);
const xrayAarPath = join(xrayLibsDir, "libv2ray.aar");
const XRAY_VERSION = "v26.6.14";
const XRAY_AAR_URL = `https://github.com/2dust/AndroidLibXrayLite/releases/download/${XRAY_VERSION}/libv2ray.aar`;

if (!existsSync(join(hevDir, "Android.mk"))) {
  console.log("Cloning hev-socks5-tunnel v2.15.0...");
  execSync(
    `git clone --recursive --depth 1 --branch 2.15.0 https://github.com/heiher/hev-socks5-tunnel.git "${hevDir}"`,
    { stdio: "inherit" },
  );
} else {
  console.log("hev-socks5-tunnel already present.");
}

if (!existsSync(xrayAarPath)) {
  mkdirSync(xrayLibsDir, { recursive: true });
  console.log(`Downloading libXray ${XRAY_VERSION} from AndroidLibXrayLite releases...`);
  execSync(`curl -fsSL -o "${xrayAarPath}" "${XRAY_AAR_URL}"`, {
    stdio: "inherit",
  });
} else {
  console.log("libv2ray.aar already present.");
}
