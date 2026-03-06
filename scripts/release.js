#!/usr/bin/env node
/**
 * 用途：一键打包 Android APK（仅 arm64-v8a），并发布到 GitHub Releases。
 *
 * 背景：
 * - “通用 APK（universal）”会把 x86/x86_64（多用于模拟器）也打进去，体积会明显变大。
 * - 真实安卓设备几乎都是 arm64-v8a，因此脚本只发布 arm64 版本（体积更小）。
 *
 * 输出文件（在项目根目录）：
 * - DayValue-v<版本>.arm64-v8a.apk
 *
 * 运行示例：
 * - node scripts/release.js
 *
 * 参数：
 * - --profile <name>           EAS 基础 profile（默认：preview），会派生：
 *                              - <name>-arm64
 * - --dry-run                  仅打印将执行的命令，不实际执行
 * - --skip-build               跳过构建（仅发布本地已存在的 APK）
 * - --skip-release             跳过发布（仅构建/下载 APK）
 * - --local                    使用本地构建（需要 Android/Gradle/JDK 环境）
 * - --non-interactive          强制 EAS non-interactive（适用于 CI，需要 EXPO_TOKEN）
 * - --build-id <id>            不触发构建，直接下载指定 Build ID 的产物
 * - --build-id-arm64 <id>      （兼容旧参数）同上
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const { spawnSync } = require("child_process");

function resolveCommandForPlatform(cmd) {
  if (process.platform !== "win32" || path.extname(cmd)) {
    return cmd;
  }

  const candidates = [`${cmd}.cmd`, `${cmd}.exe`, `${cmd}.bat`, cmd];
  for (const candidate of candidates) {
    const res = spawnSync("where.exe", [candidate], { stdio: "pipe", encoding: "utf8" });
    if (res.status === 0) {
      return candidate;
    }
  }

  return cmd;
}

function spawnCrossPlatform(cmd, args, options = {}) {
  const { shell = false, ...restOptions } = options;
  const resolvedCmd = shell ? cmd : resolveCommandForPlatform(cmd);
  if (!shell && process.platform === "win32" && /\.(cmd|bat)$/i.test(resolvedCmd)) {
    return spawnSync("cmd.exe", ["/d", "/s", "/c", formatCommandForPrint(resolvedCmd, args)], {
      shell: false,
      ...restOptions,
    });
  }

  return spawnSync(resolvedCmd, args, { shell, ...restOptions });
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
  const res = spawnCrossPlatform(cmd, args, { cwd, stdio: "inherit" });
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
  const res = spawnCrossPlatform(cmd, args, { cwd, stdio: ["inherit", "pipe", "inherit"], encoding: "utf8" });
  if (res.error) throw res.error;
  if (typeof res.status === "number" && res.status !== 0) {
    const err = new Error(`命令执行失败（exit code: ${res.status}）：${printable}`);
    err.exitCode = res.status;
    throw err;
  }
  return { stdout: res.stdout ?? "" };
}

function commandExists(cmd, { cwd } = {}) {
  const res = spawnCrossPlatform(cmd, ["--version"], { cwd, stdio: "pipe", encoding: "utf8" });
  if (res.error) return false;
  return res.status === 0;
}

function resolveEasRunner({ cwd } = {}) {
  if (commandExists("eas", { cwd })) return { cmd: "eas", prefixArgs: [] };
  if (commandExists("npx", { cwd })) return { cmd: "npx", prefixArgs: ["-y", "eas-cli"] };
  return null;
}

function readJsonFile(jsonPath) {
  const raw = fs.readFileSync(jsonPath, "utf8");
  return JSON.parse(raw);
}

function readExpoVersion(appJsonPath) {
  const json = readJsonFile(appJsonPath);
  const version = json?.expo?.version;
  if (typeof version !== "string" || version.trim().length === 0) {
    throw new Error("未在 app.json 中找到有效的 expo.version（应为非空字符串）。");
  }
  return version.trim();
}

function validateEasJsonProfiles({ repoRoot, profiles }) {
  const easJsonPath = path.join(repoRoot, "eas.json");
  if (!fs.existsSync(easJsonPath)) {
    throw new Error(`未找到 eas.json：${easJsonPath}\n请先按 README/项目约定添加 EAS build profiles。`);
  }
  const json = readJsonFile(easJsonPath);
  for (const profile of profiles) {
    const buildType = json?.build?.[profile]?.android?.buildType;
    if (buildType !== "apk") {
      throw new Error(
        `eas.json 配置不符合预期：build.${profile}.android.buildType 需要是 \"apk\"（当前：${JSON.stringify(buildType)}）`
      );
    }
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
  const res = spawnCrossPlatform("gh", ["release", "view", tag], { cwd, stdio: "ignore" });
  return res.status === 0;
}

async function ensureApkForTarget({
  repoRoot,
  easRunner,
  version,
  target,
  useLocalBuild,
  dryRun,
  forceNonInteractive,
}) {
  const apkPath = path.join(repoRoot, target.fileName);
  const apkPathForEas = `./${target.fileName}`;

  if (useLocalBuild) {
    console.log(`本地构建：${target.abi}（profile: ${target.profile}）...`);
    run(
      easRunner.cmd,
      [...easRunner.prefixArgs, "build", "-p", "android", "--profile", String(target.profile), "--local", "--output", apkPathForEas],
      { cwd: repoRoot, dryRun }
    );
    if (!dryRun && !fs.existsSync(apkPath)) {
      throw new Error(`打包完成但未找到输出文件：${apkPath}`);
    }
    return;
  }

  if (target.buildId) {
    console.log(`下载指定 Build ID（${target.abi}）：${target.buildId}`);
    const { stdout } = runCaptureStdout(
      easRunner.cmd,
      [...easRunner.prefixArgs, "build:view", String(target.buildId), "--json"],
      { cwd: repoRoot, dryRun }
    );
    if (dryRun) return;
    const build = JSON.parse(stdout);
    const artifactUrl = extractArtifactUrl(build);
    if (!artifactUrl) throw new Error(`未从 build:view 中找到可下载的产物链接（build id: ${target.buildId}）。`);
    console.log(`下载 APK（${target.abi}）：${artifactUrl}`);
    await downloadFile(artifactUrl, apkPath);
    if (!fs.existsSync(apkPath)) throw new Error(`下载结束，但未找到文件：${apkPath}`);
    return;
  }

  const hasExpoToken = typeof process.env.EXPO_TOKEN === "string" && process.env.EXPO_TOKEN.trim().length > 0;
  const isCi = typeof process.env.CI === "string" && process.env.CI.trim().length > 0;
  const allowInteractiveFallback = process.stdin.isTTY || dryRun;
  const shouldUseNonInteractive = Boolean(forceNonInteractive) || hasExpoToken || isCi || !allowInteractiveFallback;

  console.log(`触发云端构建：${target.abi}（profile: ${target.profile}）...`);
  try {
    const { stdout } = runCaptureStdout(
      easRunner.cmd,
      [
        ...easRunner.prefixArgs,
        "build",
        "-p",
        "android",
        "--profile",
        String(target.profile),
        "--wait",
        "--non-interactive",
        "--json",
      ],
      { cwd: repoRoot, dryRun }
    );
    if (dryRun) return;
    const parsed = stdout ? JSON.parse(stdout) : null;
    const build = pickBuildFromEasJsonOutput(parsed);
    if (!build) throw new Error("EAS 返回的 JSON 中未找到 build 对象。");
    const artifactUrl = extractArtifactUrl(build);
    if (!artifactUrl) {
      const idHint = build?.id ? `（build id: ${build.id}）` : "";
      throw new Error(`构建已结束，但未找到可下载的产物链接${idHint}。`);
    }
    console.log(`下载 APK（${target.abi}）：${artifactUrl}`);
    await downloadFile(artifactUrl, apkPath);
    if (!fs.existsSync(apkPath)) throw new Error(`下载结束，但未找到文件：${apkPath}`);
    return;
  } catch (err) {
    const msg = err && typeof err.message === "string" ? err.message : String(err);
    if (/Expo user account is required/i.test(msg) || /eas login/i.test(msg) || /EXPO_TOKEN/i.test(msg)) {
      const loginCmd = formatCommandForPrint(easRunner.cmd, [...easRunner.prefixArgs, "login"]);
      throw new Error(
        ["EAS 需要登录 Expo 账号才能进行云端构建。", `请先登录：${loginCmd}`, "或在 CI 中设置 EXPO_TOKEN 并追加 --non-interactive"].join(
          "\n"
        )
      );
    }
    if (!allowInteractiveFallback || shouldUseNonInteractive) throw err;
    console.log("non-interactive 构建失败，将回退到交互构建（用于首次凭据/Keystore 配置）。");
  }

  if (!allowInteractiveFallback) {
    throw new Error("当前环境无法交互输入，且 non-interactive 构建失败。请在可交互终端重试。");
  }

  // 交互构建：跑完后用 build:list 拉取最新产物
  try {
    run(
      easRunner.cmd,
      [...easRunner.prefixArgs, "build", "-p", "android", "--profile", String(target.profile), "--wait"],
      { cwd: repoRoot, dryRun }
    );
  } catch {
    console.log("eas build 返回非 0，将继续尝试从 EAS 拉取已完成的构建产物...");
  }
  if (dryRun) return;

  const { stdout: listStdout } = runCaptureStdout(
    easRunner.cmd,
    [
      ...easRunner.prefixArgs,
      "build:list",
      "-p",
      "android",
      "--status",
      "finished",
      "--limit",
      "1",
      "--build-profile",
      String(target.profile),
      "--app-version",
      String(version),
      "--json",
      "--non-interactive",
    ],
    { cwd: repoRoot, dryRun: false }
  );
  const builds = JSON.parse(listStdout);
  const build = pickBuildFromEasJsonOutput(builds);
  if (!build) throw new Error("未查询到已完成的构建记录。请稍后重试，或到 EAS Dashboard 确认可下载产物已生成。");
  const artifactUrl = extractArtifactUrl(build);
  if (!artifactUrl) {
    const idHint = build?.id ? `（build id: ${build.id}）` : "";
    throw new Error(`已找到最新构建记录，但未找到可下载的产物链接${idHint}。`);
  }
  console.log(`下载 APK（${target.abi}）：${artifactUrl}`);
  await downloadFile(artifactUrl, apkPath);
  if (!fs.existsSync(apkPath)) throw new Error(`下载结束，但未找到文件：${apkPath}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseProfile = args.profile ?? "preview";
  const dryRun = Boolean(args["dry-run"]);
  const skipBuild = Boolean(args["skip-build"]);
  const skipRelease = Boolean(args["skip-release"]);
  const useLocalBuild = Boolean(args.local);
  const forceNonInteractive = Boolean(args["non-interactive"]);
  const buildId =
    typeof args["build-id"] === "string" && args["build-id"].trim()
      ? args["build-id"].trim()
      : typeof args["build-id-arm64"] === "string" && args["build-id-arm64"].trim()
        ? args["build-id-arm64"].trim()
        : null;

  const repoRoot = path.resolve(__dirname, "..");
  const appJsonPath = path.join(repoRoot, "app.json");
  if (!fs.existsSync(appJsonPath)) throw new Error(`未找到 app.json：${appJsonPath}`);

  console.log("读取版本号...");
  const version = readExpoVersion(appJsonPath);
  console.log(`版本号：${version}`);
  const tag = `v${version}`;

  const targets = [
    {
      abi: "arm64-v8a",
      profile: `${baseProfile}-arm64`,
      fileName: `DayValue-v${version}.arm64-v8a.apk`,
      assetLabel: "Android（arm64-v8a）",
      buildId,
    },
  ];

  const downloadHelp = [
    "下载说明：",
    `- ${targets[0].fileName}：arm64-v8a（绝大多数安卓手机/平板选这个）`,
  ].join("\n");

  if (!skipBuild) {
    const easRunner = resolveEasRunner({ cwd: repoRoot });
    if (!easRunner) {
      throw new Error(
        "未检测到 eas 或 npx。\n请先安装 eas-cli（推荐全局）：npm i -g eas-cli\n或确保可用：npx -y eas-cli ..."
      );
    }

    if (!useLocalBuild) {
      validateEasJsonProfiles({
        repoRoot,
        profiles: targets.map((t) => t.profile),
      });
    }

    for (const t of targets) {
      const apkPath = path.join(repoRoot, t.fileName);
      if (fs.existsSync(apkPath)) {
        console.log(`发现已存在的 APK，将先删除：${apkPath}`);
        if (!dryRun) fs.unlinkSync(apkPath);
      }
    }

    for (const target of targets) {
      await ensureApkForTarget({
        repoRoot,
        easRunner,
        version,
        target,
        useLocalBuild,
        dryRun,
        forceNonInteractive,
      });
    }
  } else {
    console.log("已跳过构建（--skip-build）。");
    if (!dryRun) {
      for (const t of targets) {
        const apkPath = path.join(repoRoot, t.fileName);
        if (!fs.existsSync(apkPath)) {
          throw new Error(`未找到待发布的 APK：${apkPath}\n你选择了 --skip-build，请先确保该文件已存在。`);
        }
      }
    }
  }

  if (skipRelease) {
    console.log("已跳过发布（--skip-release）。");
    return;
  }

  if (!commandExists("gh", { cwd: repoRoot })) {
    throw new Error("未检测到 gh（GitHub CLI）。请先安装：https://cli.github.com/ 并执行 gh auth login 登录。");
  }

  if (!dryRun) {
    for (const t of targets) {
      const apkPath = path.join(repoRoot, t.fileName);
      if (!fs.existsSync(apkPath)) throw new Error(`未找到待上传文件：${apkPath}`);
    }
  }

  const assetsWithLabels = targets.map((t) => `${path.join(repoRoot, t.fileName)}#${t.assetLabel}`);
  const exists = ghReleaseExists(tag, { cwd: repoRoot, dryRun });

  if (!exists) {
    run(
      "gh",
      ["release", "create", tag, ...assetsWithLabels, "--title", `DayValue ${tag}`, "--generate-notes", "--notes", downloadHelp],
      { cwd: repoRoot, dryRun }
    );
    console.log(`发布完成：${tag}`);
    return;
  }

  console.log(`Release 已存在：${tag}，将覆盖上传（--clobber）...`);
  run("gh", ["release", "upload", tag, ...assetsWithLabels, "--clobber"], { cwd: repoRoot, dryRun });

  if (!dryRun) {
    const { stdout: body } = runCaptureStdout("gh", ["release", "view", tag, "--json", "body", "--jq", ".body"], {
      cwd: repoRoot,
      dryRun: false,
    });
    const trimmedBody = typeof body === "string" ? body.trim() : "";
    if (!trimmedBody.includes("下载说明（只需要下载其中一个 APK）")) {
      const newNotes = trimmedBody ? `${downloadHelp}\n\n${trimmedBody}` : downloadHelp;
      run("gh", ["release", "edit", tag, "--notes", newNotes], { cwd: repoRoot, dryRun });
    }
  }

  console.log(`发布完成：${tag}`);
}

main().catch((err) => {
  console.error("\n发布失败：");
  console.error(err?.message ?? err);
  process.exitCode = typeof err?.exitCode === "number" ? err.exitCode : 1;
});
