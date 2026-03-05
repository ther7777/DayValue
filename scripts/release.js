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
 *
 * 说明（关于本地/云端打包）：
 * - 默认使用本地打包：`eas build -p android --profile preview --local --output ./DayValue-v<版本号>.apk`
 * - 如果你的机器没有 Android/Gradle/JDK 等环境，`--local` 可能失败：
 *   1) 改为云端打包：去掉 `--local --output`，例如：`eas build -p android --profile preview`
 *   2) 在 EAS Dashboard（或命令输出）中手动下载构建产物（APK）
 *   3) 再用 `gh release create ...` 上传（或复用本脚本的 `--skip-build`）
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

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
  const isWindows = process.platform === "win32";
  const printable = formatCommandForPrint(cmd, args);
  console.log(`\n$ ${printable}`);
  if (dryRun) return;

  const res = spawnSync(cmd, args, {
    cwd,
    stdio: "inherit",
    shell: isWindows,
  });

  if (res.error) throw res.error;
  if (typeof res.status === "number" && res.status !== 0) {
    const err = new Error(`命令执行失败（exit code: ${res.status}）：${printable}`);
    err.exitCode = res.status;
    throw err;
  }
}

function commandExists(cmd, { cwd } = {}) {
  const isWindows = process.platform === "win32";
  const res = spawnSync(cmd, ["--version"], {
    cwd,
    stdio: "pipe",
    shell: isWindows,
    encoding: "utf8",
  });
  if (res.error) return false;
  return res.status === 0;
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const profile = args.profile ?? "preview";
  const dryRun = Boolean(args["dry-run"]);
  const skipBuild = Boolean(args["skip-build"]);
  const skipRelease = Boolean(args["skip-release"]);

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
    console.log("🔎 正在检查 eas 是否已安装...");
    if (!commandExists("eas", { cwd: repoRoot })) {
      throw new Error(
        "未检测到 eas（Expo CLI）。请先安装并确保可用：npm i -g eas-cli（或使用 npx eas ...）。"
      );
    }

    if (fs.existsSync(apkPath)) {
      console.log(`🧹 发现已存在的 APK，将先删除：${apkPath}`);
      if (!dryRun) fs.unlinkSync(apkPath);
    }

    console.log("🔨 正在打包 APK，请耐心等待...");
    run(
      "eas",
      [
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
    try {
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
    } catch (err) {
      const msg =
        err && typeof err.message === "string" ? err.message : String(err);
      if (/already exists/i.test(msg) || /existing tag/i.test(msg)) {
        throw new Error(
          `Release 或 tag 已存在：${tag}\n可选处理：\n- 删除现有 Release/tag 后重试\n- 或执行：gh release upload ${tag} ${apkPath} --clobber（覆盖上传）`
        );
      }
      throw err;
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
