import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "artifacts/suproxy/android");
const localMavenSnippet =
  "    maven { url uri(\"${rootDir}/../modules/suproxy-vpn/android/maven\") }";

if (!existsSync(androidDir)) {
  console.error(`Android project not found at ${androidDir}. Run expo prebuild first.`);
  process.exit(1);
}

function patchRootBuildGradle() {
  const path = join(androidDir, "build.gradle");
  let content = readFileSync(path, "utf8");

  if (!content.includes("suproxy-vpn/android/maven")) {
    content = content.replace(
      /allprojects\s*\{\s*\n\s*repositories\s*\{/,
      `allprojects {\n  repositories {\n${localMavenSnippet}`,
    );
  }

  if (!content.includes("jitpack.io")) {
    content = content.replace(
      /allprojects\s*\{\s*\n\s*repositories\s*\{/,
      `allprojects {\n  repositories {\n    maven { url 'https://jitpack.io' }`,
    );
  }

  writeFileSync(path, content);
  console.log("Patched build.gradle");
}

function patchGradleProperties() {
  const path = join(androidDir, "gradle.properties");
  let content = readFileSync(path, "utf8");

  const required = [
    ["android.ndkVersion", "27.1.12297006"],
    ["reactNativeArchitectures", "arm64-v8a,armeabi-v7a"],
  ];

  for (const [key, value] of required) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    if (pattern.test(content)) {
      content = content.replace(pattern, `${key}=${value}`);
    } else {
      content += `\n${key}=${value}\n`;
    }
  }

  writeFileSync(path, content);
  console.log("Patched gradle.properties");
}

patchRootBuildGradle();
patchGradleProperties();
