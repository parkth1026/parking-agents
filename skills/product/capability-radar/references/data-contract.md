# 标准 JSON 契约

版本为 `schemaVersion: 1`。CLI 与浏览器使用 `scripts/contract.mjs` 中同一校验函数。`radar.schema.json` 描述机器字段；额外跨字段约束由函数校验。

| 字段 | 要求 |
|---|---|
| title | 图标题，最多 44 个字符 |
| centerLabel | 团队或产品名称，最多 10 个字符；用于导出文件名，不画在图上 |
| date | 可选；证据或盘点的有效 YYYY-MM-DD 日期，不自动填生成日期 |
| domains | 1–8 个能力域，唯一，每项最多 16 字；省略时按 group 首次出现顺序生成 |
| capabilities | 1–24 个能力单元；更多条目拆图或按明确规则聚合 |
| id | 唯一的字符串或有限数值；能力改名和重新排序时保持稳定 |
| group | 必须对应 domains 中的能力域 |
| name | 完整名称，最多 120 字 |
| shortLabel | 图上最短说明，最多 20 字；省略时用 name，超限时报错 |
| status | 已具备 / 确定能做到 / 可能做到，三值之一 |
| summary | 可选，最多 32 字；关键限制存在时由 Agent 核对后填写；允许换行 |
| input / output / proof / limits / evidence / scenarios | 可选字符串；保留完整源信息 |
| sourceRefs | 来源定位数组，含 source、locator 与原文 quote；转换产物每项都应有 |
| sources | 源文件数组：id、name、sha256；存在时所有能力必须引用已列来源 |
| subtitle / note / source | 可选图内说明、证据边界与简要来源；最多 240 字 |

保留用户的额外字段。它们不会自动改变雷达布局或状态。`summary` 不得将完整限制改写为无条件能力。

```json
{
  "schemaVersion": 1,
  "title": "团队技术能力雷达",
  "centerLabel": "团队",
  "domains": ["数据接入"],
  "note": "按原文明示状态；技术能力不等于产品化承诺。",
  "capabilities": [
    {
      "id": "CAP-001",
      "group": "数据接入",
      "name": "多源资料转三维资产",
      "shortLabel": "资料转三维资产",
      "status": "已具备",
      "summary": "仅在指定格式样例通过",
      "limits": "保留完整适用条件。"
    }
  ]
}
```

真实转换附来源元数据；示例不包含真实来源。来源 locator 使用 `line:12`、`Sheet1!row:7 / A7:D7`、`page:3` 等可定位表示。

未知状态不属于三档枚举。它们在 `conversion-report.json` 的 pending 中保存；有待定项时主图标注工作稿及数量。已具备不是生产成熟度指标，确定能做到不是程序自行生成的交付承诺。

转换报告至少有 status、included、pending、excluded、warnings。对来源无明确能力的表格或正文，记录为背景材料；不将其当作能力缺失证据。
