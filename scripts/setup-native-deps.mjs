import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
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
const XRAY_TAG = "v26.6.14";
const XRAY_MAVEN_VERSION = "26.6.14";
const XRAY_AAR_URL = `https://github.com/2dust/AndroidLibXrayLite/releases/download/${XRAY_TAG}/libv2ray.aar`;
const xrayMavenDir = join(
  root,
  "artifacts/suproxy/modules/suproxy-vpn/android/maven/com/github/2dust/libv2ray",
  XRAY_MAVEN_VERSION,
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

if (!existsSync(xrayAarPath)) {
  mkdirSync(xrayLibsDir, { recursive: true });
  console.log(`Downloading libXray ${XRAY_TAG} from AndroidLibXrayLite releases...`);
  execSync(`curl -fsSL -o "${xrayAarPath}" "${XRAY_AAR_URL}"`, {
    stdio: "inherit",
  });
} else {
  console.log("libv2ray.aar already present.");
}

mkdirSync(xrayMavenDir, { recursive: true });
const mavenAarPath = join(xrayMavenDir, `libv2ray-${XRAY_MAVEN_VERSION}.aar`);
const mavenPomPath = join(xrayMavenDir, `libv2ray-${XRAY_MAVEN_VERSION}.pom`);

if (!existsSync(mavenAarPath)) {
  copyFileSync(xrayAarPath, mavenAarPath);
}

if (!existsSync(mavenPomPath)) {
  writeFileSync(
    mavenPomPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.github.2dust</groupId>
  <artifactId>libv2ray</artifactId>
  <version>${XRAY_MAVEN_VERSION}</version>
  <packaging>aar</packaging>
</project>
`,
  );
}

console.log(`libv2ray published to local maven: ${xrayMavenDir}`);
