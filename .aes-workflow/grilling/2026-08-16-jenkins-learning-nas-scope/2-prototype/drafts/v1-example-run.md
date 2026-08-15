<!-- draft v1 | published 2026-08-15T16:34:00Z
     用户意见：待质疑
     状态：draft -->

# 可执行示例: 2026-08-16-jenkins-learning-nas-scope（草稿 v1）

> 输出为写死示意（字段名与关键行来自脚本实现，数值/条数为占位）；验收时以真实运行对照关键断言，不逐字比对。

## 场景 1：改配置后第一次调用（status 入口）

```
$ node <skill-dir>/scripts/session.mjs status
```

看到的关键断言（示意）：

```
生效配置:
  rawDir    //nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw
  wikiDir   //nas.51vr.local/PaaS/UE5/ue-llm-wiki/wiki
  trackFile //nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/analyzed-builds.json
  jobs(enabled): aes6-ue-runtime-ci | twe-ue5.5-installed | twe-ue5.5-linux-ci
pending-pairs: 不存在或超过 1 小时 → 提示先跑 scan-pairs.mjs
```

要点：路径三个都指 NAS；enabled job 恰好 3 个；提示扫描。

## 场景 2：重新扫描（范围收窄的直接证据）

```
$ node <skill-dir>/scripts/scan-pairs.mjs
```

看到：只请求 3 个 job 的 Jenkins API（URL 均为 `http://10.66.12.40/job/wdp-ue/job/Earth/job/...`）；产出的 `pending-pairs.json` 落在 `//nas.../ue-llm-wiki/raw/pending-pairs.json`；对列表里**不出现** twe-ue5.5 / wdp5-ue5.5-runtime-ci / wdp5-runtime-ue5.5-linux-ci / wdp5-plugins-ue5.5。

## 场景 3：完整学习一轮（scan → next → 分析 → finish）

```
$ node <skill-dir>/scripts/session.mjs next      # 领取一对，workflow.json 落 NAS raw
（进入 jenkins-pair-analyze 子技能：下载日志到 NAS tmp、取 git diff、产出知识文件）
$ node <skill-dir>/scripts/session.mjs finish    # 结论落账 NAS analyzed-builds.json
```

看到：知识文件出现在 `//nas.../raw/scratch/`（评分 5-7）或 `//nas.../raw/details/`（≥8）；`analyzed-builds.json` 在 NAS 上从 0 条变为 1 条；报告剩余待分析对数。

## 场景 4：共享技能跟随（必须保持可用的现有用法）

```
$ node <ue-error-solver>/scripts/... config     # 输出合并配置，rawDir/wikiDir 显示 NAS 路径
```

这条现在能跑，改完之后必须还能跑，仅路径值变化。ue-error-solver 与 karpathy-llm-wiki 无需各自改配置——它们读同一个 `skill-env.json`。

## 场景 5：迁移当次的一次性动作（不属于日常调用）

1. 备份 `~/.claude/skill-env.json` → `skill-env.json.bak`
2. 拷 2 份 scratch 知识文件 → NAS `raw/scratch/`
3. 拷本地 wiki 整目录内容 → NAS `wiki/`
4. 编辑 `skill-env.json`（六处字段，见 behavior.md 配置差异）
5. 跑场景 1、2 验证

NAS 不可达时的表现：status/scan/next 报路径错误退出（exit 1）——这是选 C（全上 NAS）时用户已接受的代价。
