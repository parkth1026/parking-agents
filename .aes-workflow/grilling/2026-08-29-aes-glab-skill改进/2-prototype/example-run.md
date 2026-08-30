# 可执行示例: 2026-08-29-aes-glab-skill改进

**确认版·锁定。** 写死的示例输出，不连真实系统。报文/命令结构以 behavior.md 变化行为源，本文只写「怎么用、看到什么」。

## 场景 1：零基础安装指引（变化行 1/2，六断言形态）

用户输入：

```
我的一台 Windows 10 机器上从未安装过 glab。请给我一份从零开始的操作指引：
安装 glab、配置连接 http://git.51vr.local、完成登录认证、并验证全部就绪。
```

改后 agent 产出的指引文档形态（骨架，★ = 对应 output-evals.json 断言）：

```
## 第 1 步 安装（★断言1/2）
  winget install GLab.GLab
  预期：装到 C:\Users\<你>\AppData\Local\Programs\glab\glab.exe
  注意：装完新开一个终端再跑 glab（PATH 新会话才生效）
  验证：glab --version → 打印 glab 1.x.x

## 第 2 步 造令牌（★断言4）
  http://git.51vr.local/-/profile/personal_access_tokens
  名称 glab-机器名 · 有效期留空 · 权限只勾 api → 复制 glpat-…

## 第 3 步 登录（★断言3）
  printf '%s' "令牌" | glab auth login --hostname git.51vr.local \
    --api-protocol http --git-protocol http --stdin
  （交互式时：SSH hostname / API hostname 一律留空回车 ★断言5）

## 第 4 步 验证（★断言6）
  glab auth status → ✓ Logged in to git.51vr.local as <你> (keyring)
  在仓库克隆里 glab issue list → 列出 issue
```

agent 自用兜底（用户看不到，技能内建）：Git Bash 里 `glab: command not found`
≠ 未安装——按注册表或 `winget list --id GLab.GLab` 定位后全路径调用。

## 场景 2：配置类问答（变化行 3/4/8）

用户输入：

```
glab auth status 里怎么一直有 gitlab.com 那段红字？我都 logout 过了
```

改后 agent 答复形态：

```
那是 glab 首次运行写进 config.yml 的默认模板块，不是登录状态，
logout 只删令牌不删它——无害，可直接无视。
配置文件在 C:\Users\<你>\AppData\Local\glab-cli\config.yml
想清掉：先备份，再删 hosts: 下整个 gitlab.com: 块，删后只剩 git.51vr.local 段。
（在本 agent 会话里 auth status 显示 (GITLAB_TOKEN) 属正常——环境变量注入
压过钥匙串，你自己终端会显示 (keyring)，两者等价。）
```

## 场景 3：不变场景（历史兼容，改后必须逐字节一样）

用户输入：

```
glab 报 No token found，怎么办
```

行为：技能照旧按「认证故障对照」表答复——重跑一行登录命令即恢复；引导登录四步
话术、成功标志 `✓ Stored your credentials in the operating system keyring.`、
双协议参数要求全部与现状一致。此场景是既有依赖面，回归时抽查。
