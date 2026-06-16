import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const androidDir = join(root, "artifacts/suproxy/android");

if (!existsSync(androidDir)) {
  console.error(`Android project not found at ${androidDir}. Run expo prebuild first.`);
  process.exit(1);
}

function ensureRepo(content, marker, snippet) {
  if (content.includes(marker)) {
    return content;
  }
  return content.replace(/repositories\s*\{/, `repositories {\n${snippet}`);
}

function patchSettingsGradle() {
  const path = join(androidDir, "settings.gradle");
  let content = readFileSync(path, "utf8");

  content = ensureRepo(
    content,
    "jitpack.io",
    '      maven { url = uri("https://jitpack.io") }',
  );

  writeFileSync(path, content);
  console.log("Patched settings.gradle");
}

function patchRootBuildGradle() {
  const path = join(androidDir, "build.gradle");
  let content = readFileSync(path, "utf8");

  if (!content.includes("jitpack.io")) {
    content = ensureRepo(
      content,
      "jitpack.io",
      "    maven { url 'https://jitpack.io' }",
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

patchSettingsGradle();
patchRootBuildGradle();
patchGradleProperties();
