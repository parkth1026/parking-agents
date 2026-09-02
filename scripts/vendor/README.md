# scripts/vendor — 冻结的第三方运行时

本目录是仓库「零依赖」约定的**唯一例外位**：存放一次性构建、随仓库提交的
bundled artifact (打包产物)。用户克隆仓库即可用，无 npm install、无网络请求。

## clack-prompts.mjs

安装/卸载器交互 UI 的实现，逐函数等价于 `@clack/prompts` 的具名导出
（`intro` / `outro` / `select` / `confirm` / `note` / `spinner` / `log` /
`cancel` / `isCancel` / `settings`）。

- 来源与版本（构建时锁定）：
  - `@clack/prompts` 1.7.0 (MIT) — 传递打包 `@clack/core` 1.4.3 (MIT)
  - `sisteransi` 2.0.0 (MIT)、`fast-wrap-ansi` 0.2.2 (MIT)、
    `fast-string-width` 3.0.2 (MIT)、`fast-string-truncated-width` 3.0.2 (MIT)
- 许可证文本已用 `--legal-comments=inline` 内嵌在文件各模块段首，满足
  MIT/ISC 的署名义务；本文件与 bundle 一同构成完整署名记录。
- SHA-256（提交时）:
  `507c6e47243e12481b2c7341eb63c0e6c5759fa55759ea1edd45e550cccdd83a`

## 重建流程（升级版本时）

在任意临时目录（不污染本仓库）：

```bash
npm init -y && npm i @clack/prompts@<版本>
cat > entry.mjs <<'EOF'
export { intro, outro, select, confirm, note, spinner, isCancel, cancel, log, settings } from "@clack/prompts";
EOF
npx esbuild entry.mjs --bundle --format=esm --platform=node \
  --outfile=clack-prompts.mjs --legal-comments=inline
```

把产物覆盖本目录同名文件，更新上方版本清单与 SHA-256，然后重跑
`node tests/skills/test-install-skills.mjs` 与真实终端冒烟
（Windows Terminal / conhost 双击 `install-skills.cmd`）。

## 约定

- 只放「无原生依赖、纯 JS、node:* 内置模块之外零外部引用」的 bundle。
- 每个文件必须能在本 README 里追溯到上游包名、版本、许可证与重建命令。
