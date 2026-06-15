import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const hevDir = join(
  root,
  "artifacts/suproxy/modules/suproxy-vpn/android/src/main/jni/hev-socks5-tunnel",
);

if (!existsSync(join(hevDir, "Android.mk"))) {
  console.log("Cloning hev-socks5-tunnel v2.15.0...");
  execSync(
    `git clone --recursive --depth 1 --branch 2.15.0 https://github.com/heiher/hev-socks5-tunnel.git "${hevDir}"`,
    { stdio: "inherit" },
  );
} else {
  console.log("hev-socks5-tunnel already present.");
}
