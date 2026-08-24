# 自研技能晋级标准

`.agents/skills/` 是平铺开发真源，`skills/` 是分类发布树。日常开发和无参数 junction 安装不需要改变；只有准备让某个自研技能进入发布树时，才走下面五步。

## 门槛

晋级门槛是：**评测五件套齐全 + 最新一轮 `run-tests.mjs` 退出码为 0（绿）**。

五件套固定为：`trigger-evals.json`、`output-evals.json`、`run-tests.mjs`、`trigger-benchmark.json`、`history.json`。仓库不另设通过率数字门槛；每个技能自己的 `run-tests.mjs` 是唯一判定尺子。可先运行：

```bash
npm run evals -- --skill <技能名>
```

## 第 1 步：写 category

只改开发真源 `.agents/skills/<技能名>/SKILL.md`，在 frontmatter 加一个分类：

```yaml
category: engineering
```

允许值是 `engineering`、`productivity`、`pub`。不写 `category` 表示不晋级；非法值会让生成器非零退出并点名技能。

## 第 2 步：确认 run-tests 绿

确认五件套在技能根目录齐全，并真实运行最新一轮：

```bash
node .agents/skills/<技能名>/run-tests.mjs
```

退出码不是 0 就先修技能或评测，不能生成。生成器还会再次执行这条门槛，避免绕过。

## 第 3 步：跑生成器

```bash
node scripts/build-release.mjs
node scripts/build-release.mjs --check
```

生成器复制整个技能目录到 `skills/<category>/<技能名>/`。它是自研发布副本的唯一写入者；不要手改发布副本，任何额外、缺失或不同内容都会被 `--check` 和 `npm test` 判红。若名称与任一既有发布技能重名，生成器会拒绝，而不是依赖 junction 的静默覆盖。

## 第 4 步：核对索引自动登记

确认生成器已经更新：

- `skills/<category>/README.md` 的自研生成段；
- 根 `README.md` 的 `BEGIN/END GENERATED SELF-DEVELOPED SKILLS` 索引段；
- `skills/.generated-by-build-release.json` 生成清单。

这些内容同样只能由生成器维护。无自研技能晋级时，生成器不创建空分类桶。

## 第 5 步：重装或干跑验证

按目标范围验证 junction：

```bash
node scripts/install-skills-agents.mjs --only <category> --dry-run
node scripts/install-skills-agents.mjs --skills <技能名> --dry-run
```

确认无误后去掉 `--dry-run` 重装。最后运行 `npm test`；无参数安装的全量、扁平合并、重名开发侧赢语义必须保持不变。
