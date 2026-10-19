# 文件名规范化（去 hash 落盘）

第 5 层。线上 Vite 类构建产物文件名带 `content hash + build id` 后缀（`main-CNPvahTq-mvexvs3z.js`），直接入库的问题：每次版本更新全量改名 → git churn、跨版本同路径 diff 失效、文件名不可读。规范化把落盘名剥成稳定语义名（`main.js`、`zh.js`、`700.css`），引用同步重写，并用缓存 + 映射表保住字节可审计性。

执行时机：抓取层（1–3）收敛之后、终验（第 6 层）之前——**终验必须在规范化后的树上跑**。脚本 `scripts/normalize.mjs`，幂等。

## 为什么要「缓存 + 映射表」而不是裸改名

裸改名破坏镜像的字节保真承诺。方案 B 的等式：**site ≡ rewrite(cache)**——

- `.mirror-cache/`（gitignore）：server 原始字节，roundtrip 审计的基准
- `rename-map.json`（入库）：server 名 → 仓库名的累积映射（跨版本保留 provenance）
- 三条审计不变量（normalize.mjs 结尾自检，audit 可复跑）：
  1. 文本资产零「文件名形状」的 hash 字面量残留（`-[hash]-[buildid].<ext>` 形状；**裸 build id 字符串不算**——版本漂移检测、`?v=` fallback 里的 build id 是数据不是引用，保留是正确行为）
  2. 磁盘零哈希文件名
  3. roundtrip：cache 字节（经引用重写；有 patch 的 chunk 叠加 patch 变换）逐字节等于 site 字节——patch（字符串替换）与 rename 重写作用于不相交 token，可交换，顺序无关

## 算法要点（每一条都是实测踩出来的）

**1. hash 形态**。Vite hash 恰好 8 个 base64url 字符，**可含 `-` 和 `_`**：`B-giygOW`、`ko--G8KYhCO`、`DpD8SOQ_` 都是合法 hash。stem 也可含语义短横（字体家族 `m-plus-rounded-1c-7-800-normal`）。切分公式：

```
^(.*?)-[A-Za-z0-9_-]{L}-${BUILD_ID}(\.[^.]+)$      L = hash 长度，stem 惰性
```

三个要素缺一不可（实测各错一次）：
- **build id 锚定**：build id 在文件名尾端唯一出现，锚定后切分唯一
- **stem 惰性 `.*?`**：贪心 stem 会把含 `-` 的 hash 劈开泄漏（`main-B-giygOW` → `main-B.js`）
- **hash 精确长度 `{L}`**：变长 hash 会把语义段吞进 hash（`cyrillic-600-Cd-lEtjQ` → 丢掉 weight 变 `cyrillic.css`，多文件撞名）

`L` 自动探测 = 所有 build-id 后缀文件里 hash run 的**最小长度**（真实 hash 全等长；更长的 run 是语义段与 hash 粘连的假象）。上游改 hash 长度时残留检查会 FAIL，改 `--hash-len` 即可。build id 自动探测 = 尾部 token 在 ≥3 个文件名里重复。

**2. 无 build-id 的哈希 chunk 只走显式规则**。`three-QAPlWxlR.js` 这类只有 hash 的名字**不能按模式识别**——`-([A-Za-z0-9_-]{8})\.ext` 会误伤真实资源名（实测误伤 `never-melt-ice.png`、`type-electric.png`、`map-freeball.png`）。dry-scan 先验证，`--rule '^three-[A-Za-z0-9_-]{8}\.js$=three.js'` 显式登记，规则正则带 hash 长度使其对版本更新稳定。

**3. 撞名消歧**。多个 hash 剥到同名（典型：9KB entry 和 1.4MB app chunk 都叫 `main-*.js`）：index.html `<script src>` 引用的是 entry，保留原名；其余默认 `-2`/`-3`，或 `--alias` 给语义名（entry→`main.js`、app→`app.js`）。`.orig` patch 备份跟随其 chunk 改名，内容永不重写（保留 server 原样）。

**4. 引用重写**。Vite 引用全部是字面量 → **basename 级整 token 替换**在机械上安全（server 名含 hash 足够唯一，替换目标是长 token 不是短新名，无子串误伤）。`?v=` 查询串天然保留（在扩展名之后）。二进制资产只改名不重写内容。

**5. cache busting 转移**。文件名不再变化后，缓存失效靠响应头：本地服务对静态资源发 `Cache-Control: no-cache`（协商缓存，304 便宜）。

**6. 上游自身 404 的资产不是缺口**。规范化后跑终验常暴露出「客户端请求但原站也 404」的文件（未部署图标、未上线道具）。逐一探测原站确认后：从抓取 feed 移除死行、终验判据带已知豁免集（数量写进 verdict 保持透明）、README 记录。上游部署后审计/录制回路会自动重新发现。

## 工程陷阱

- 抓取 feed（运行时 URL 清单）是**累积输入**，任何工具的「缺失输出」写独立文件，绝不覆写 feed（实测：审计输出清空了 19296 行 feed）
- Windows 下 feed 是 CRLF 行尾，`grep -v '^...$'` 锚定匹配失效（行尾有 `\r`），用 `sed '/pattern\r\?$/d'`
- 一次性迁移的 git 效果：二进制纯 rename 相似度 100%，文本因引用重写显示为 D+A——历史仍可追
