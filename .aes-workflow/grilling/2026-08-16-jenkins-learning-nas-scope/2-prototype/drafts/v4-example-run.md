<!-- draft v4 | published 2026-08-15T17:32:00Z
     用户意见：v3 补——删受影响技能的 PS 双胞胎（场景 7 加一步）
     状态：待确认 -->

# 可执行示例: 2026-08-16-jenkins-learning-nas-scope（草稿 v4）

> 输出为写死示意（关键行有实现依据，数值/条数为占位）；验收以关键断言对照，不逐字比对。

## 场景 1：status 入口（新配置生效）

```
$ node <skill-dir>/scripts/session.mjs status
配置来源: C:/Users/Administrator/.config/parking-agents/skill-env.json
生效配置:
  rawDir    //nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw
  wikiDir   //nas.51vr.local/PaaS/UE5/ue-llm-wiki/wiki
  trackFile //nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw/analyzed-builds.json
  jobs(enabled): aes6-ue-runtime-ci | twe-ue5.5-installed | twe-ue5.5-linux-ci
```

关键断言：来源行显示新路径；三个路径指 NAS；enabled 恰好 3 个。

## 场景 2：回退兼容（只有旧位置有配置）

```
$ mv ~/.config/parking-agents/skill-env.json /tmp/   # 临时移走新文件
$ node <skill-dir>/scripts/session.mjs status
配置来源: C:/Users/Administrator/.claude/skill-env.json (fallback)
```

关键断言：回退读旧文件，命令照常工作，来源行标注 fallback。

## 场景 3：SKILL_ENV 覆盖（现有用法，必须保持可用）

```
$ SKILL_ENV=/tmp/test-env.json node <skill-dir>/scripts/session.mjs status
配置来源: /tmp/test-env.json (SKILL_ENV)
```

## 场景 4：重新扫描（范围收窄证据）

`scan-pairs.mjs` 只请求 3 个 job 的 API；`pending-pairs.json` 落 NAS raw；对列表不含范围外 4 个 job。

## 场景 5：完整学习一轮

scan → next（workflow.json 落 NAS）→ pair-analyze（日志落 NAS tmp）→ finish（账本 0→1 条）。知识文件出现在 NAS raw/scratch 或 details/。

## 场景 6：NAS 不可达 → 现状报告（新增的 fail-fast）

```
$ node <skill-dir>/scripts/session.mjs status        # NAS 断开时
[配置加载成功]
现状报告: NAS 不可达
  不可达路径: //nas.51vr.local/PaaS/UE5/ue-llm-wiki/raw
  受影响操作: 读写知识库/账本/日志暂存（本次: status 检查 pending-pairs）
  建议检查: 网络或 VPN 连接; 共享权限; nas.51vr.local 是否在线
$ echo $?
1
```

关键断言：有人话现状报告（路径/影响/建议三要素）+ 退出码 1；不再是裸 ENOTFOUND 堆栈。

## 场景 7：迁移当次一次性动作（更新）

1. 备份并创建 `~/.config/parking-agents/skill-env.json`（NAS 值 + 3 job；旧 `~/.claude/skill-env.json` 保留）
2. 拷 2 份 scratch 知识文件 → NAS `raw/scratch/`
3. 拷本地 wiki 整目录内容 → NAS `wiki/`
4. 代码：2 个 .mjs（config.mjs / UeErrorSolver.mjs）默认路径+回退+fail-fast
5. 文档：3 处路径引用更新；模板 config.example.json 填真实值
6. 删除 PS 双胞胎：UeErrorSolver.psm1、scan-pairs.ps1、validate-wiki.ps1、learning 技能目录内 tmp/（其余技能不碰）
7. 跑场景 1、2、3、6、9 验证

## 场景 9：无配置引导（三层都找不到配置文件）

```
$ node <skill-dir>/scripts/session.mjs status        # 无 SKILL_ENV、新/旧路径均无文件
未找到配置文件（已查: $SKILL_ENV、~/.config/parking-agents/skill-env.json、~/.claude/skill-env.json）
配置引导:
  1. 拷贝模板: <repo>/.claude/skills/jenkins-log-auto-learning/config.example.json（默认指向 NAS 知识库）
  2. 放到:     ~/.config/parking-agents/skill-env.json
  3. 按机器改: gitRepos（如 D:/Git）
$ echo $?
1
```

关键断言：三层路径都列出来、三步引导可照做、退出码 1。

## 场景 8：共享技能跟随（必须保持可用）

ue-error-solver 与 karpathy-llm-wiki 读同一配置：ue-error-solver 解析出新路径或回退旧路径均正常；llm-wiki 的 validate-wiki.mjs 调用方式不变。
