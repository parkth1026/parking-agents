# 自研技能晋级约定

新技能在 `.agents/skills/` 孵化（项目级加载即可用，不参与安装）；`skills/` 是唯一安装源，分类即顶层目录（`deprecated`、`in-progress` 是生命周期分类，默认不被安装）。晋级就是一次 `git mv`，没有生成器、没有索引、没有清单。

## 门槛

晋级门槛不变：**评测五件套齐全 + 最新一轮 `run-tests.mjs` 退出码为 0（绿）**。

五件套固定为：`trigger-evals.json`、`output-evals.json`、`run-tests.mjs`、`trigger-benchmark.json`、`history.json`。仓库不设通过率数字门槛；每个技能自己的 `run-tests.mjs` 是唯一判定尺子。

## 步骤

1. **孵化**：技能目录建在 `.agents/skills/<技能名>/`，项目级加载即可试用。
2. **过门槛**：确认五件套齐全，并真实跑一轮：

   ```bash
   npm run evals -- --skill <技能名>
   ```

   `run-tests.mjs` 退出码不是 0 就先修技能或评测。
3. **晋级**：选一个分类（`skills/` 顶层目录名），移动整个技能目录：

   ```bash
   git mv .agents/skills/<技能名> skills/<分类>/
   ```

4. **验证安装**：用新安装器干跑确认目标侧可见：

   ```bash
   node scripts/install-skills.mjs --target both --only <分类> --dry-run
   node scripts/install-skills.mjs --target both --skills <技能名> --dry-run
   ```

   确认无误后去掉 `--dry-run` 真跑也安全：`--only` / `--skills` 是外科手术式选择，只动选中的技能，**不做套装外清除**，目标里其余本仓链接原样保留。

5. **收尾**：`npm test` 全绿后提交。`in-progress` 与 `deprecated` 之间的移动同理，都是 `git mv`。
