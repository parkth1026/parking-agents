# 更新记录

## 2026-10-12

两处修复，均由「阶段1对齐」（2026-10-12）实战归档暴露并当日端到端复验：

- **转换器内容丢失修复**：`li` 内嵌 grid 的 column 文本列（`<ul>`）整列丢失——旧实现把 li 内 grid 全部交给 `emitMediaBlocks`，该函数只解媒体不解 ul。新增 `emitGridBlocks` 统一处理 column 内 ul/ol 与 img/whiteboard；column 内 `p`/`table` 维持消解行为，冻结期望输出不受影响。修复后对实战样本（纪要 doc rev 6）的输出与人工逐字补回的镜像正文 10,299 B 逐字节一致。
- **回归门升级**：新增合成 fixture 对 `li-grid-content.xml` / `li-grid-expected.md` 并纳入 `verify-fixture.mjs` 双 case 门；期望侧手工撰写（冻结生成器含旧缺陷，对其输入 0 命中，天然防自指）。台账见 `tests/fixtures/fixture-verification.md` 附录。
- **媒体下载白名单修复**：`run.mjs` 在 `--evidence-root` 指向 repoRoot 外（相对路径含 `..`）时，`+media-download --output` 被 lark-cli 路径白名单拒绝、媒体全部降级。改为统一在账号临时目录落盘（cwd=临时目录）再按 CLI 产出 basename 移入 assets；原故障场景复测 4 媒体全下、零降级。
