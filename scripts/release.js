#!/usr/bin/env node
/**
 * 用途：一键本地打包 Android APK，并发布到 GitHub Releases。
 *
 * 输入：
 * - 读取项目根目录 `app.json` 的 `expo.version` 作为版本号
 * - 依赖本机已安装并可用：`eas`（Expo Application Services CLI）、`gh`（GitHub CLI）
 *
 * 输出：
 * - 在项目根目录生成 `DayValue-v<版本号>.apk`
 * - 在 GitHub 创建 tag `v<版本号>` 的 Release，并上传该 APK
 *
 * 运行示例（Windows/Linux/macOS 通用单行）：
 * - node scripts/release.js
 *
 * 可选参数：
 * - --profile <name>        EAS 构建 profile（默认：preview）
 * - --dry-run               仅打印将执行的命令，不实际执行
 * - --skip-build            跳过打包（仅发布现有 APK）
 * - --skip-release          跳过发布（仅本地打包 APK）
 * - --local                 改用本地打包（默认：云端构建）
 * - --non-interactive       强制使用 EAS non-interactive（适用于 CI：需要 EXPO_TOKEN）
 *
 * 说明（默认云端构建）：
 * - 默认使用云端构建（推荐）：`eas build -p android --profile preview --wait --json`
 * - 构建完成后脚本会自动从构建产物链接下载 APK 到本地，再发布到 GitHub Releases
 * - 为确保拿到 APK（而不是 AAB），建议在 `eas.json` 中将对应 profile 配置为：
 *   `build.<profile>.android.buildType = "apk"`
 *
 * 说明（可选本地打包）：
 * - 通过 `--local` 使用本地打包：`eas build -p android --profile preview --local --output ./DayValue-v<版本号>.apk`
 * - 如果你的机器没有 Android/Gradle/JDK 等环境，`--local` 很容易失败；推荐继续使用默认的云端构建
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawnSync } = require("child_process");

function spawnCrossPlatform(cmd, args, options) {
  const isWindows = process.platform === "win32";
  const baseOptions = { shell: isWindows, ...options };
  return spawnSync(cmd, args, baseOptions);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = true;
    }
  }
  return out;
}

function formatCommandForPrint(cmd, args) {
  const escaped = args.map((a) => {
    if (/[\s"]/g.test(a)) return `"${a.replace(/"/g, '\\"')}"`;
    return a;
  });
  return [cmd, ...escaped].join(" ");
}

function run(cmd, args, { cwd, dryRun } = {}) {
  const printable = formatCommandForPrint(cmd, args);
  console.log(`\n$ ${printable}`);
  if (dryRun) return;

  const res = spawnCrossPlatform(cmd, args, {
    cwd,
    stdio: "inherit",
  });

  if (res.error) throw res.error;
  if (typeof res.status === "number" && res.status !== 0) {
    const err = new Error(`命令执行失败（exit code: ${res.status}）：${printable}`);
    err.exitCode = res.status;
    throw err;
  }
}

function runCaptureStdout(cmd, args, { cwd, dryRun } = {}) {
  const printable = formatCommandForPrint(cmd, args);
  console.log(`\n$ ${printable}`);
  if (dryRun) return { stdout: "" };

  const res = spawnCrossPlatform(cmd, args, {
    cwd,
    stdio: ["inherit", "pipe", "inherit"],
    encoding: "utf8",
  });

  if (res.error) throw res.error;
  if (typeof res.status === "number" && res.status !== 0) {
    const err = new Error(`命令执行失败（exit code: ${res.status}）：${printable}`);
    err.exitCode = res.status;
    throw err;
  }

  return { stdout: res.stdout ?? "" };
}

function commandExists(cmd, { cwd } = {}) {
  const res = spawnCrossPlatform(cmd, ["--version"], {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });
  if (res.error) return false;
  return res.status === 0;
}

function resolveEasRunner({ cwd } = {}) {
  if (commandExists("eas", { cwd })) return { cmd: "eas", prefixArgs: [] };
  if (commandExists("npx", { cwd })) return { cmd: "npx", prefixArgs: ["-y", "eas-cli"] };
  return null;
}

function readExpoVersion(appJsonPath) {
  const raw = fs.readFileSync(appJsonPath, "utf8");
  const json = JSON.parse(raw);
  const version = json?.expo?.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("未在 app.json 中找到有效的 expo.version（应为非空字符串）。");
  }
  return version.trim();
}

function readJsonFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw);
}

function getEasProjectIdFromAppJson({ repoRoot }) {
  const appJsonPath = path.join(repoRoot, "app.json");
  if (!fs.existsSync(appJsonPath)) return null;
  try {
    const json = readJsonFile(appJsonPath);
    const projectId = json?.expo?.extra?.eas?.projectId;
    return typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
  } catch {
    return null;
  }
}

function ensureEasProjectConfigured({ repoRoot, easRunner, dryRun }) {
  const projectId = getEasProjectIdFromAppJson({ repoRoot });
  if (projectId) return;

  const initCmdPrintable = formatCommandForPrint(easRunner.cmd, [
    ...easRunner.prefixArgs,
    "project:init",
  ]);

  if (dryRun) {
    console.log("🧩 检测到尚未配置 EAS Project（app.json 缺少 extra.eas.projectId）。");
    console.log(`（实际执行时将引导你创建/链接项目：${initCmdPrintable}）`);
    return;
  }

  if (!process.stdin.isTTY) {
    throw new Error(
      [
        "EAS project 未配置，且当前环境无法进行交互输入。",
        "请在可交互的终端中先执行一次项目初始化：",
        initCmdPrintable,
        "",
        "初始化完成后会在 app.json 写入 extra.eas.projectId，然后再重试：npm run release",
      ].join("\n")
    );
  }

  console.log("🧩 检测到尚未配置 EAS Project，正在引导创建/链接...");
  run(easRunner.cmd, [...easRunner.prefixArgs, "project:init"], { cwd: repoRoot, dryRun: false });
}

function validateEasJson({ repoRoot, profile, requireApk }) {
  const easJsonPath = path.join(repoRoot, "eas.json");
  if (!fs.existsSync(easJsonPath)) {
    throw new Error(
      `未找到 eas.json：${easJsonPath}\n建议在项目根目录新增 eas.json，并为 profile "${profile}" 配置 android.buildType = "apk"。`
    );
  }

  let easJson;
  try {
    easJson = readJsonFile(easJsonPath);
  } catch {
    throw new Error(`eas.json 不是有效的 JSON：${easJsonPath}`);
  }

  const profileCfg = easJson?.build?.[profile];
  if (!profileCfg) {
    throw new Error(
      `eas.json 中未找到 build.${profile} 配置。\n请在 eas.json 中新增 build profile "${profile}"。`
    );
  }

  if (!requireApk) return;
  const buildType = profileCfg?.android?.buildType;
  if (buildType !== "apk") {
    throw new Error(
      `当前 eas.json 的 build.${profile}.android.buildType 不是 "apk"（当前：${JSON.stringify(buildType)}）。\n脚本会下载并发布 APK，建议将其设置为 "apk"。`
    );
  }
}

function pickBuildFromEasJsonOutput(parsed) {
  if (Array.isArray(parsed)) return parsed[0];
  if (parsed && typeof parsed === "object") return parsed;
  return null;
}

function extractArtifactUrl(build) {
  const candidates = [
    build?.artifacts?.buildUrl,
    build?.artifacts?.applicationArchiveUrl,
    build?.artifacts?.downloadUrl,
    build?.artifacts?.url,
    build?.artifacts?.apkUrl,
  ];
  for (const url of candidates) {
    if (typeof url === "string" && url.startsWith("http")) return url;
  }
  return null;
}

function downloadFile(url, outPath) {
  return new Promise((resolve, reject) => {
    const requestOnce = (currentUrl, redirectCount) => {
      const client = currentUrl.startsWith("https:") ? https : http;
      const req = client.get(currentUrl, (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          if (redirectCount >= 5) {
            reject(new Error(`下载重定向次数过多：${currentUrl}`));
            return;
          }
          const nextUrl = new URL(location, currentUrl).toString();
          res.resume();
          requestOnce(nextUrl, redirectCount + 1);
          return;
        }

        if (status < 200 || status >= 300) {
          reject(new Error(`下载失败（HTTP ${status}）：${currentUrl}`));
          res.resume();
          return;
        }

        const file = fs.createWriteStream(outPath);
        res.pipe(file);
        file.on("finish", () => file.close(resolve));
        file.on("error", (err) => {
          try {
            fs.unlinkSync(outPath);
          } catch {
            // ignore
          }
          reject(err);
        });
      });
      req.on("error", reject);
    };

    requestOnce(url, 0);
  });
}

function ghReleaseExists(tag, { cwd, dryRun } = {}) {
  if (dryRun) return false;
  const res = spawnCrossPlatform("gh", ["release", "view", tag], {
    cwd,
    stdio: "ignore",
  });
  return res.status === 0;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = args.profile ?? "preview";
  const dryRun = Boolean(args["dry-run"]);
  const skipBuild = Boolean(args["skip-build"]);
  const skipRelease = Boolean(args["skip-release"]);
  const useLocalBuild = Boolean(args.local);

  const repoRoot = path.resolve(__dirname, "..");
  const appJsonPath = path.join(repoRoot, "app.json");

  console.log("📦 正在读取版本号...");
  if (!fs.existsSync(appJsonPath)) {
    throw new Error(`未找到 app.json：${appJsonPath}`);
  }
  const version = readExpoVersion(appJsonPath);
  console.log(`✅ 版本号：${version}`);

  const tag = `v${version}`;
  const fileName = `DayValue-v${version}.apk`;
  const apkPath = path.join(repoRoot, fileName);
  const apkPathForEas = `./${fileName}`;

  if (!skipBuild) {
    console.log("🔎 正在检查 EAS CLI 是否可用...");
    const easRunner = resolveEasRunner({ cwd: repoRoot });
    if (!easRunner) {
      throw new Error(
        "未检测到 eas 或 npx。\n请先安装 eas-cli（推荐全局）：npm i -g eas-cli\n或确保可使用：npx -y eas-cli ..."
      );
    }

    if (useLocalBuild) {
      console.log("🏠 已选择本地打包（--local）。");
    } else {
      console.log("☁️ 使用云端构建（默认）。");
      ensureEasProjectConfigured({ repoRoot, easRunner, dryRun });
      validateEasJson({ repoRoot, profile, requireApk: true });
    }

    if (fs.existsSync(apkPath)) {
      console.log(`🧹 发现已存在的 APK，将先删除：${apkPath}`);
      if (!dryRun) fs.unlinkSync(apkPath);
    }

    if (useLocalBuild) {
      console.log("🔨 正在本地打包 APK，请耐心等待...");
      run(
        easRunner.cmd,
        [
          ...easRunner.prefixArgs,
          "build",
          "-p",
          "android",
          "--profile",
          String(profile),
          "--local",
          "--output",
          apkPathForEas,
        ],
        { cwd: repoRoot, dryRun }
      );

      if (!dryRun && !fs.existsSync(apkPath)) {
        throw new Error(
          `打包命令执行结束，但未找到输出文件：${apkPath}\n可能原因：EAS profile 输出不是 APK、或 EAS/Android 本地环境未配置完成。`
        );
      }
      console.log(`✅ APK 已生成：${apkPath}`);
    } else {
      console.log("🔨 正在触发云端构建并等待完成...");
      const forceNonInteractive = Boolean(args["non-interactive"]);
      const hasExpoToken = typeof process.env.EXPO_TOKEN === "string" && process.env.EXPO_TOKEN.trim().length > 0;
      const isCi = typeof process.env.CI === "string" && process.env.CI.trim().length > 0;
      const useNonInteractive = forceNonInteractive || hasExpoToken || isCi;
      if (!useNonInteractive) {
        console.log("👤 未检测到 EXPO_TOKEN/CI，将允许交互登录（不传 --non-interactive）。");
      }

      const cloudArgs = [
        ...easRunner.prefixArgs,
        "build",
        "-p",
        "android",
        "--profile",
        String(profile),
        "--wait",
        ...(useNonInteractive ? ["--non-interactive"] : []),
        "--json",
      ];

      let stdout = "";
      try {
        ({ stdout } = runCaptureStdout(easRunner.cmd, cloudArgs, { cwd: repoRoot, dryRun }));
      } catch (err) {
        const msg = err && typeof err.message === "string" ? err.message : String(err);
        if (/Expo user account is required/i.test(msg) || /eas login/i.test(msg) || /EXPO_TOKEN/i.test(msg)) {
          const loginCmd = formatCommandForPrint(easRunner.cmd, [...easRunner.prefixArgs, "login"]);
          throw new Error(
            [
              "EAS 需要登录 Expo 账号才能进行云端构建。",
              "",
              "解决方案（二选一）：",
              `1) 本机交互登录：${loginCmd}`,
              '2) 设置环境变量 EXPO_TOKEN（适用于 CI / non-interactive）',
              "   - PowerShell：$env:EXPO_TOKEN=\"<token>\"; npm run release",
              "   - macOS/Linux：EXPO_TOKEN=\"<token>\" npm run release",
              "",
              "然后重试执行：npm run release",
            ].join("\n")
          );
        }
        throw err;
      }

      if (dryRun) {
        console.log("🧪 dry-run 模式：已跳过云端构建结果解析与 APK 下载。");
        console.log(`（实际执行时将下载到：${apkPath}）`);
      } else {
      let parsed;
      try {
        parsed = stdout ? JSON.parse(stdout) : null;
      } catch {
        throw new Error(
          "未能解析 EAS 的 JSON 输出。\n请确认命令支持 --json，或先去掉 --dry-run 实跑观察输出。"
        );
      }

      const build = pickBuildFromEasJsonOutput(parsed);
      if (!build) {
        throw new Error("EAS 返回的 JSON 中未找到 build 对象。");
      }

      const artifactUrl = extractArtifactUrl(build);
      if (!artifactUrl) {
        const buildId = build?.id ? `（build id: ${build.id}）` : "";
        throw new Error(
          `构建已结束，但未从 EAS 输出中找到可下载的产物链接${buildId}。\n你可以在 EAS Dashboard 中手动下载产物后，用 --skip-build 继续发布。`
        );
      }

      console.log("⬇️ 正在下载 APK...");
      console.log(`🔗 ${artifactUrl}`);
      await downloadFile(artifactUrl, apkPath);

      if (!fs.existsSync(apkPath)) {
        throw new Error(`下载结束，但未找到文件：${apkPath}`);
      }
      console.log(`✅ APK 已下载：${apkPath}`);
      }
    }
  } else {
    console.log("⏭️ 已跳过打包步骤（--skip-build）。");
    if (!dryRun && !fs.existsSync(apkPath)) {
      throw new Error(
        `未找到待发布的 APK：${apkPath}\n你选择了 --skip-build，请先确保该文件已存在。`
      );
    }
  }

  if (!skipRelease) {
    console.log("🔎 正在检查 gh 是否已安装...");
    if (!commandExists("gh", { cwd: repoRoot })) {
      throw new Error(
        "未检测到 gh（GitHub CLI）。请先安装：https://cli.github.com/ 并执行 gh auth login 登录。"
      );
    }

    console.log("🚀 正在发布到 GitHub Releases...");
    if (!dryRun && !fs.existsSync(apkPath)) {
      throw new Error(`未找到待上传文件：${apkPath}`);
    }

    const exists = ghReleaseExists(tag, { cwd: repoRoot, dryRun });
    if (!exists) {
      run(
        "gh",
        [
          "release",
          "create",
          tag,
          apkPath,
          "--title",
          `DayValue ${tag}`,
          "--generate-notes",
        ],
        { cwd: repoRoot, dryRun }
      );
    } else {
      console.log(`♻️ Release 已存在：${tag}，将执行覆盖上传（--clobber）...`);
      run(
        "gh",
        ["release", "upload", tag, apkPath, "--clobber"],
        { cwd: repoRoot, dryRun }
      );
    }

    console.log(`✅ 发布完成：${tag}`);
  } else {
    console.log("⏭️ 已跳过发布步骤（--skip-release）。");
  }
}

main().catch((err) => {
  console.error("\n❌ 发版失败：");
  console.error(err?.message ?? err);
  process.exitCode = typeof err?.exitCode === "number" ? err.exitCode : 1;
});
