#!/usr/bin/env node
/**
 * 用途：
 * - 为 Expo 项目执行本地 Android 构建，绕过 EAS 免费队列。
 * - 默认只在缺少 android/ 原生目录时执行 prebuild，后续优先走增量 Gradle 构建以缩短耗时。
 *
 * 输入：
 * - 可选参数：
 *   --clean-prebuild    删除并重新生成 android/ 目录，适用于 app.json、插件或原生配置变更后。
 *   --debug             构建 debug APK（默认构建 release APK）。
 *   --universal         构建通用 APK；默认仅构建 arm64-v8a，体积更小、速度更快。
 *
 * 输出：
 * - 在项目根目录生成 DayValue-v<版本>.arm64-v8a.apk 或 DayValue-v<版本>.apk。
 * - 原始 Gradle 构建产物保留在 android/app/build/outputs/apk/ 下。
 *
 * 启动示例：
 * - Linux/macOS: node scripts/local-android-build.js
 * - Windows:    node scripts/local-android-build.js
 */

const fs = require("fs");
const http = require("http");
const https = require("https");
const path = require("path");
const { spawnSync } = require("child_process");

function parseArgs(argv) {
  const flags = new Set(argv);
  return {
    cleanPrebuild: flags.has("--clean-prebuild"),
    debug: flags.has("--debug"),
    universal: flags.has("--universal"),
  };
}

function run(command, args, options = {}) {
  const printable = [command, ...args].map(quoteArg).join(" ");
  console.log(`\n$ ${printable}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.error) throw result.error;
  if (typeof result.status === "number" && result.status !== 0) {
    throw new Error(`命令执行失败（exit code: ${result.status}）：${printable}`);
  }
}

function quoteArg(value) {
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function ensureExists(targetPath, message) {
  if (!fs.existsSync(targetPath)) {
    throw new Error(message);
  }
}

function readAppVersion(appJsonPath) {
  const raw = fs.readFileSync(appJsonPath, "utf8");
  const json = JSON.parse(raw);
  const version = json?.expo?.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("未在 app.json 中找到有效的 expo.version。");
  }
  return version.trim();
}

function toFileUrl(targetPath) {
  const normalized = path.resolve(targetPath).replace(/\\/g, "/");
  return `file:///${encodeURI(normalized)}`;
}

function downloadFile(url, outputPath, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const request = client.get(url, (response) => {
      const statusCode = response.statusCode ?? 0;
      const redirectLocation = response.headers.location;

      if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
        if (redirectCount >= 5) {
          response.resume();
          reject(new Error(`Gradle 分发包重定向次数过多：${url}`));
          return;
        }
        const nextUrl = new URL(redirectLocation, url).toString();
        response.resume();
        downloadFile(nextUrl, outputPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (statusCode < 200 || statusCode >= 300) {
        response.resume();
        reject(new Error(`下载 Gradle 分发包失败（HTTP ${statusCode}）：${url}`));
        return;
      }

      const fileStream = fs.createWriteStream(outputPath);
      response.pipe(fileStream);
      fileStream.on("finish", () => {
        fileStream.close(() => resolve(outputPath));
      });
      fileStream.on("error", (error) => {
        try {
          fs.unlinkSync(outputPath);
        } catch {
          // ignore cleanup error
        }
        reject(error);
      });
    });

    request.setTimeout(300000, () => {
      request.destroy(new Error(`下载 Gradle 分发包超时：${url}`));
    });
    request.on("error", reject);
  });
}

async function ensureLocalGradleDistribution(repoRoot, androidDir, timeoutMs) {
  const wrapperPropsPath = path.join(androidDir, "gradle", "wrapper", "gradle-wrapper.properties");
  ensureExists(wrapperPropsPath, `未找到 Gradle Wrapper 配置：${wrapperPropsPath}`);

  const raw = fs.readFileSync(wrapperPropsPath, "utf8");
  const distributionMatch = raw.match(/(^|\r?\n)distributionUrl=(.+)/u);
  if (!distributionMatch) {
    throw new Error(`未在 ${wrapperPropsPath} 中找到 distributionUrl。`);
  }

  const distributionUrl = distributionMatch[2].trim().replace(/\\:/g, ":");
  const fileName = path.basename(distributionUrl);
  const cacheDir = path.join(repoRoot, ".gradle-dist");
  const localZipPath = path.join(cacheDir, fileName);

  if (!fs.existsSync(localZipPath)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`未找到本地 Gradle 分发包，开始下载：${distributionUrl}`);
    await downloadFile(distributionUrl, localZipPath);
  } else {
    console.log(`复用本地 Gradle 分发包：${localZipPath}`);
  }

  const nextLine = `networkTimeout=${timeoutMs}`;
  const localDistributionLine = `distributionUrl=${toFileUrl(localZipPath)}`;
  let updated = /(^|\r?\n)networkTimeout=\d+/u.test(raw)
    ? raw.replace(/(^|\r?\n)networkTimeout=\d+/u, `$1${nextLine}`)
    : `${raw.trimEnd()}\n${nextLine}\n`;
  updated = updated.replace(/(^|\r?\n)distributionUrl=.+/u, `$1${localDistributionLine}`);

  if (updated !== raw) {
    fs.writeFileSync(wrapperPropsPath, updated, "utf8");
    console.log(`已将 Gradle Wrapper 切换为本地分发包，并将网络超时调整为 ${timeoutMs}ms。`);
  }
}

function resolveApkPath(androidDir, buildType, universal) {
  const metadataPath = path.join(androidDir, "app", "build", "outputs", "apk", buildType, "output-metadata.json");
  if (fs.existsSync(metadataPath)) {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
    const outputFile = metadata?.elements?.[0]?.outputFile;
    if (typeof outputFile === "string" && outputFile.trim().length > 0) {
      const metadataResolvedPath = path.join(androidDir, "app", "build", "outputs", "apk", buildType, outputFile);
      if (fs.existsSync(metadataResolvedPath)) {
        return metadataResolvedPath;
      }
    }
  }

  const candidates = universal
    ? [
        path.join(androidDir, "app", "build", "outputs", "apk", buildType, `app-${buildType}.apk`),
        path.join(androidDir, "app", "build", "outputs", "apk", buildType, `app-${buildType}-unsigned.apk`),
      ]
    : [
        path.join(androidDir, "app", "build", "outputs", "apk", buildType, `app-arm64-v8a-${buildType}.apk`),
        path.join(androidDir, "app", "build", "outputs", "apk", buildType, `app-arm64-v8a-${buildType}-unsigned.apk`),
      ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  throw new Error(
    [
      "Gradle 构建已结束，但未找到预期的 APK 产物。",
      `查找目录：${path.join(androidDir, "app", "build", "outputs", "apk", buildType)}`,
      `期望架构：${universal ? "universal" : "arm64-v8a"}`,
    ].join("\n")
  );
}

function copyArtifact(sourcePath, outPath) {
  fs.copyFileSync(sourcePath, outPath);
  const sizeMb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n已生成 APK：${outPath}`);
  console.log(`文件大小：${sizeMb} MB`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, "..");
  const androidDir = path.join(repoRoot, "android");
  const gradleWrapper = path.join(androidDir, process.platform === "win32" ? "gradlew.bat" : "gradlew");
  const appJsonPath = path.join(repoRoot, "app.json");
  const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const buildType = args.debug ? "debug" : "release";
  const version = readAppVersion(appJsonPath);
  const fileName = args.universal
    ? `DayValue-v${version}.apk`
    : `DayValue-v${version}.arm64-v8a.apk`;
  const outputPath = path.join(repoRoot, fileName);

  ensureExists(appJsonPath, `未找到 app.json：${appJsonPath}`);
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = args.debug ? "development" : "production";
  }
  if (!androidHome) {
    throw new Error("未检测到 ANDROID_HOME 或 ANDROID_SDK_ROOT。");
  }
  ensureExists(androidHome, `Android SDK 目录不存在：${androidHome}`);

  if (args.cleanPrebuild && fs.existsSync(androidDir)) {
    fs.rmSync(androidDir, { recursive: true, force: true });
  }

  if (!fs.existsSync(androidDir)) {
    run("npx", ["expo", "prebuild", "--platform", "android"], { cwd: repoRoot });
  } else {
    console.log("检测到已存在的 android/ 目录，跳过 prebuild，直接执行增量 Gradle 构建。");
  }

  ensureExists(gradleWrapper, `未找到 Gradle Wrapper：${gradleWrapper}`);
  await ensureLocalGradleDistribution(repoRoot, androidDir, 120000);

  const gradleTask = args.debug ? "assembleDebug" : "assembleRelease";
  const gradleArgs = [gradleTask];
  if (!args.universal) {
    gradleArgs.push("-PreactNativeArchitectures=arm64-v8a");
  }

  run(gradleWrapper, gradleArgs, { cwd: androidDir });
  const apkPath = resolveApkPath(androidDir, buildType, args.universal);
  copyArtifact(apkPath, outputPath);
}

main().catch((error) => {
  console.error("\n本地 Android 构建失败：");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
