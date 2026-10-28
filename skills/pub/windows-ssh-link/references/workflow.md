# 两台电脑分别做什么

`10.66.8.27` 是发起端 A；某台被连接电脑是 B。B 的真实 IP 和本地登录用户名需从 B 获取，不用 A 的用户名代替。

在两台电脑各解压相同包。Skill 若放入各自 `%USERPROFILE%\.agents\skills\windows-ssh-link`，可让各自 Codex 使用 `$windows-ssh-link`。B 不装 Codex 也能直接跑 CLI。以下命令均假定当前目录为包内 `windows-ssh-link\bin`；也可将 EXE 换成绝对路径。示例 B 的 `10.66.8.220` 仅作示例，必须用 B 实际网卡地址。每次只选一台 B。

## A：准备客户端

```powershell
.\ssh-link.exe connect check
```

确认输出的当前 Windows 用户与日常客户端用户相同。若已有私钥，后续所有命令加 `--key-path '实际私钥绝对路径'`，路径不带 `.pub`。默认路径是当前用户 `.ssh\id_ed25519_ssh_link`。

推荐让用户在自己的终端生成带口令密钥（若文件已存在，直接使用，绝不确认覆盖）。代理不收集口令：

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\id_ed25519_ssh_link"
```

若 `.ssh` 目录不存在先 `New-Item -ItemType Directory -Force "$env:USERPROFILE\.ssh"`。管理员终端运行 `.\ssh-link.exe connect agent` 看计划，授权后加 `--apply` 启动 agent；再回日常 Windows 用户的交互终端执行：

```powershell
ssh-add "$env:USERPROFILE\.ssh\id_ed25519_ssh_link"
ssh-add -l
.\ssh-link.exe connect check
```

用户明确接受专用无口令密钥时，可替代交互生成：

```powershell
.\ssh-link.exe connect keygen --no-passphrase
.\ssh-link.exe connect keygen --no-passphrase --apply
```

把 `id_ed25519_ssh_link.pub` 复制到 B 的可读目录（例如 `C:\Temp\controller.pub`）。只传 `.pub`，不传无后缀私钥。

## B：接受连接

在 B 管理员 PowerShell 中执行，先核实身份、网卡、账号：

```powershell
hostname
whoami
Get-NetIPAddress -AddressFamily IPv4
Get-LocalUser | Select-Object Name,Enabled
.\ssh-link.exe accept check --peer-ip 10.66.8.27 --user Administrator --public-key-file C:\Temp\controller.pub
```

`Administrator` 是 **B 上准备通过 SSH 登录的本地账号**；如果 B 是其他本地用户名，替换这一值。UAC 使用其他管理员账号并不改变准备登录的账号。普通账号先在 B 实际登录一次以建立 profile。

```powershell
.\ssh-link.exe accept setup --peer-ip 10.66.8.27 --user Administrator --public-key-file C:\Temp\controller.pub
.\ssh-link.exe accept setup --peer-ip 10.66.8.27 --user Administrator --public-key-file C:\Temp\controller.pub --apply
```

检查结果没有 FAIL 后，导出这台 B 的主机信息。`LocalIp` 填 B 自己的 IP，`Alias` 是以后在 A 使用的唯一简短名称。以下导出命令会新建输出文件，不覆盖旧文件。

```powershell
.\ssh-link.exe accept export --peer-ip 10.66.8.27 --user Administrator --local-ip 10.66.8.220 --alias win-node-1 --out-file C:\Temp\win-node-1.json
```

保留 B 本机显示的 `SHA256:...` 主机指纹，通过自己的可信渠道把 JSON 带回 A。导出文件包含内部地址与主机公钥，不包含私钥、密码或 API Token。

## A：只连接这一台 B

先读取 B 导出文件核对电脑/IP/账号/端口，再把 `SHA256:...` 替换成 **B 本机显示并核对过的一个主机指纹**（优先 Ed25519）。不要原样输入省略号。

```powershell
.\ssh-link.exe connect trust --target-file C:\Temp\win-node-1.json --fingerprint 'SHA256:实际完整指纹'
.\ssh-link.exe connect trust --target-file C:\Temp\win-node-1.json --fingerprint 'SHA256:实际完整指纹' --apply
.\ssh-link.exe connect setup --target-file C:\Temp\win-node-1.json
.\ssh-link.exe connect setup --target-file C:\Temp\win-node-1.json --apply
.\ssh-link.exe connect test --target-file C:\Temp\win-node-1.json
```

`trust`、`setup` 修改当前 A 用户的标准 `%USERPROFILE%\.ssh\known_hosts` 与 `config`。每个别名单独标记；配置第二台不会移除第一台，旧 GUI 区块同名会拒绝覆盖。对 Include/Match 的最终效果以实际 `ssh -G` 验证为准，冲突回退。

测试通过后可以 `ssh win-node-1` 交互登录。若使用 Codex，在测试加 `--check-codex` 仅检查远端 CLI 可查找。完成这台后，再对下一台 B 重复同一流程，使用不同别名和目标 JSON。

## 诊断与恢复

```powershell
.\ssh-link.exe connect test --target-file C:\Temp\win-node-1.json --json --report-file C:\Temp\ssh-result.json
.\ssh-link.exe accept restore --manifest '本机备份目录\manifest.json'
# 核对恢复计划和原操作授权后再加 --apply。
```

日志和备份含内网信息，不公开上传。CLI 不修改组织执行策略；若系统适配层被组织策略阻止，应按组织规则签名或授权运行。EXE 是自包含 .NET 10 应用，不需要预装 SDK/运行时，使用时不依赖旁边的 PS1。v2 只自动恢复 v2 备份；v1 旧脚本备份需旧工具恢复。

依据微软官方文档核对（2026-10-28）：[安装与服务](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)、[公钥和 ACL](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement)、[配置、默认 Shell 与账号](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh-server-configuration)。
