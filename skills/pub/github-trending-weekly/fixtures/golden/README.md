# 锁定输入

- `2026-W36.json`：2026-09-03 开始实施前，从既有 workspace 的 W36 周快照逐字节复制；rank、星数和分类不为测试调整。
- `2026-W36.analysis.md`：首次四字段分析样本。依据 W36 榜单与 2026-09-03 五信源补查编写；用于固定解析验收，不代表用户已通过内容验收。
- `tt-a1i__archify.history.json`：同一 workspace 的真实 W28/W36 历史；周增 1019→22095，对应 ×21.7。
- `sha256.json`：以上三个输入的锁定 hash；run-tests 验证。修改产品，不修改黄金尺子。
- `2026-W36.evidence.json`：2026-09-03 补查的顶层 tree、前20贡献者、近90天最多100条提交与最近3发布。晚于榜单采集的事件不用于当期爆因归因。

`../stub/tt-a1i__archify.{tree,contributors,commits,releases}.json` 是该次 API 响应的字段投影回放；`google__googletest.contributors.json` 是显式403故障回放。`../old-week/` 保存旧周与三 bullet 分析，用于兼容性验证。
