# 修复审计发现的 3 个问题

## 问题 1（中）：Checker 对自己仓库报红，--allow 例外未持久化

**现状：** `check-skill-repo.mjs .` 永远返回 exit 1（41 hits 在 `claude-to-vscode-skill-converter`），但没有任何文件记录这个仓库需要 `--allow`。

**修复方案：** 在 `package.json` 的 `scripts` 中新增一条：

```json
"check:repo": "node skills/making-skills-cross-platform/scripts/check-skill-repo.mjs . --allow skills/claude-to-vscode-skill-converter/"
```

这样 `npm run check:repo` 就能绿。同时把 `test-no-tool-names.mjs` 里 ALLOWLIST 第 76 行的注释引用同步更新，指向 `npm run check:repo` 作为 checker 的对应物。

> 注意：不把 checker 加进 `npm test`（那是问题 3 的范围），只是让 checker 可复现地绿。

## 问题 2（低）：删除孤儿 `rust-workflow-init/index.html`

**现状：** 425 行 HTML 渲染页，无任何文件引用。

**修复方案：** `git rm skills/rust-workflow-init/index.html`

## 问题 3（低）：把 checker 接入测试管线

**现状：** `package.json` 的 `test` 跑 7 个测试，checker 不在其中。两套机制做重叠的事。

**修复方案：** 将 `check:repo` 命令追加到 `test` script 链末尾：

```
... && node scripts/bump-version.mjs --audit && npm run check:repo
```

checker 比 `test-no-tool-names.mjs` 检查面更广（18 项 vs 1 项），接入后能在 CI 拦住 hook 接线退化、manifest 版本漂移、schema 混淆等问题。

## 改动文件清单

| 文件 | 操作 |
|---|---|
| `package.json` | 加 `check:repo` script + 追加到 `test` 链 |
| `tests/skills/test-no-tool-names.mjs` | ALLOWLIST 注释补充 checker 对应说明 |
| `skills/rust-workflow-init/index.html` | 删除 |

## 改完跑

```bash
npm test
npm run check:repo   # 应全绿
```