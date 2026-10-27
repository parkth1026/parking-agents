# 按失败层级处理

覆盖本工具支持范围内的常见失败与停止条件；不能承诺所有 Windows、组织策略及第三方网络问题都能自动修复。只修首个失败层级，保留原始错误。任何写操作依照用户当次授权，不因本表自动扩大范围。

| 层级/现象 | 在哪台检查 | 处理与验证 |
|---|---|---|
| Role/IP/账号方向不明 | 两端 | `hostname`、`whoami`、`Get-NetIPAddress -AddressFamily IPv4`；A 发起，B 接受。PeerIp=A；LocalIp/User=B。多网卡不要自动挑第一条。 |
| 不是管理员、Access denied | B；agent 操作在 A | B setup/受保护主机配置需要管理员终端；UAC 切换用户时仍显式指定 B 登录账号。普通只读扫描的 UNKNOWN 不等于服务故障。 |
| 脚本无法执行 | 当前端 | 64 位 Windows，使用 bin/ssh-link.exe；系统防火墙适配仍依赖 Windows PowerShell，查组织执行策略。不要全局 Set-ExecutionPolicy Unrestricted。没有 Node、Python、SDK 不影响 CLI。 |
| 找不到 ssh/ssh-keygen | A | 查 `Get-Command ssh.exe -All`；按官方可选功能安装 OpenSSH Client；安装需管理员和更新源。不要下载不明二进制替代。 |
| sshd 不存在 | B | setup 优先 Windows 可选功能；若独立版 sshd 已存在但未注册，停止叠装，使用其官方安装流程注册服务。 |
| 功能安装失败/需重启 | B | 查看 Windows Update/WSUS/FoD 源和安装错误，不反复重装；RestartNeeded 按提示重启后重跑。组织源问题不自动换互联网源。 |
| sshd 启动失败、端口冲突 | B | `Get-CimInstance Win32_Service -Filter "Name='sshd'"` 取真实路径与 -f；以真实 sshd 执行 `-t -f 实际配置`。`Get-NetTCPConnection -State Listen -LocalPort 22` 核对进程。不要杀未知占用进程。 |
| 配置语法/Include/Match/ForceCommand | B | setup 校验候选及有效配置；只支持标准路径，不绕过已有策略。`sshd -T -f 配置 -C user=账号,host=主机名,addr=A的IP` 核对 pubkeyauthentication/authorizedkeysfile/forcecommand。修正需理解原策略，不能删除 Match 解决。 |
| 目标账号不支持/未建 profile | B | 自动仅支持本地账号；检查启用状态与真实本地组 SID，普通用户先登录一次建立目录。不把 Microsoft/域/Entra 账号当本地账号；Entra 公钥认证存在官方支持限制，域场景另行验证。 |
| 用户 .ssh 里有 key 仍拒绝 | B | 管理员可能实际使用 `%ProgramData%\ssh\administrators_authorized_keys`；以有效配置决定，不改错文件。工具修复支持路径的所有者/ACL 并复核，不用 chmod 或 Everyone 权限。 |
| 复制成私钥/指纹、多行、截断 | 两端 | 只能给 B 一条完整 `.pub` 公钥；不是 SHA256 指纹、不是私钥。工具拒绝无效格式，并用 OpenSSH 验证部署内容。 |
| 已有 key 带 from=/command= 限制 | B | 不追加同一 key 的无限制副本；核对限制是否适合 A 的源 IP/命令；未经授权不去除限制。 |
| TCP timeout | A 测试；B 本机 | 先 IP/端口/目标开机和睡眠、VPN路由/多网卡、B 是否服务真实 PID 对外监听，再看有效 Windows/第三方防火墙、AP隔离/ACL。Ping 结果不能代替 TCP。工具只添加 PeerIp 专用规则，旧宽泛规则仍可能生效。 |
| TCP refused | A/B | 通常目标无监听或主动拒绝；核对端口及服务 PID；不要靠关闭防火墙试探。服务检查 PASS 仍不能证明 A 到 B 可达。 |
| 主机未知/REMOTE HOST IDENTIFICATION CHANGED | A，并在 B 核对 | 保持严格检查；B 本机导出主机公钥并核对指纹。变化时先确认重装/换机/IP复用，备份 known_hosts 后按确认的单主机记录处理；不自动 ssh-keygen -R 批量删，不重建 B 主机密钥。 |
| 导入 JSON 指纹不匹配 | A | 文件篡改/复制错误/核对对象不对；停止，重新从正确 B 获取。trust 只写入传入已核对指纹对应的密钥，不顺带信任文件其他密钥。 |
| Permission denied (publickey) | A/B | TCP 和主机校验之后再查 B 登录账号、正确 key 文件/ACL/AllowUsers/组策略/已有限制；A 查 `ssh-add -l`、私钥路径。B `Get-WinEvent -LogName 'OpenSSH/Operational' -MaxEvents 30`。不要用密码重试掩盖公钥失败。 |
| Load key / bad permissions | A | 查私钥所有者及 ACL；生成助手只修它新生成的文件，已有密钥先备份再按微软文档修复。不能把私钥发给代理“检查”。 |
| agent has no identities / signing failed | A | 同一 Windows 用户的交互终端 `ssh-add 私钥路径`，用户本人输入口令；`ssh-add -l` 核对指纹。agent 服务 Running 不能证明已加载。无人值守无口令方案须用户明确选择。 |
| 别名与预期地址不同 | A | `ssh -G 别名`、Include、Host */Match 与旧工具区块。单目标 setup 不接管其他显式同名别名；换唯一别名或按授权人工合并。保存后配置不符会回退。 |
| whoami/hostname 失败 | B | 检查实际登录账号、DefaultShell 可执行文件、Shell 启动脚本、ForceCommand、权限；不要因为 TCP 通就宣称 SSH 正常。默认 Shell 改动不在自动 setup 内。 |
| codex 找不到/版本命令失败 | B 的 SSH 登录用户 | SSH 已通过则单查该用户安装和非交互 PATH、默认 Shell；桌面终端 PATH 不代表 SSH PATH。不自动安装、不复制 API Token；CLI 版本通过不证明模型请求成功。 |
| 访问远程共享失败（二跳） | B | 公钥登录没有可用于后续网络认证的 Windows 用户凭据，属于会话机制；不靠 agent 转发解决 Windows 凭据问题，按用户具体共享访问方案另行处理。 |
| 回退失败/进程被强制终止 | 发生变更端 | 查看输出备份 manifest，核对真实文件/ACL/新增规则/服务状态；restore 前保留现状。恢复只覆盖记录文件和该次新增规则，不卸载组件或恢复启动类型。不能宣称系统已完全回滚。 |

代理可用 `--json` 解析原始逐层结果。`test` 会运行实际远端 `whoami` 和 `hostname`，不是纯本机检查；超时有上限，不猜用户名，不扫描网段，不测试额外目标。

需要深入认证日志时，用本机命令生成 `ssh -vvv -o BatchMode=yes -o StrictHostKeyChecking=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o ForwardAgent=no -i 私钥路径 唯一别名 whoami`，只在相同已授权目标执行，日志中的内部地址/用户名/路径在分享前审查。不要把口令放命令行或日志。
