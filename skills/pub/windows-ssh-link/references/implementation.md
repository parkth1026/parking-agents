# 实现与可验证边界

版本 2.0，.NET 10 Windows x64，自包含单文件。源码只依赖 .NET 标准库和 Windows API，无第三方 NuGet 运行时依赖。`src/SshLink` 是实际运行的核心，`tests/SshLink.Tests` 是独立测试程序。

| 模块 | 职责 |
|---|---|
| Contracts / Program | 严格的角色、子命令、长参数解析；稳定 JSON SchemaVersion=2；退出码、报告 |
| Engine | 单目标检查/计划/执行、有效 SSH 配置、信任、公钥部署、回退 |
| KeysAndConfig | 公钥格式和 SHA256、保留原限制的合并、按别名独立的客户端配置 |
| Infrastructure | ArgumentList 子进程调用、超时终止树、TCP、ACL、原子文本写入 |
| WindowsHost | SCM/NetAPI/IP Helper 原生服务、账号、组成员和监听 PID；注册表读取 |
| Backup | 原始字节/所有者/DACL备份、SHA256完整性校验、受管恢复 |
| MutationLock | 独立线程持有跨进程 Windows Mutex，兼容异步操作和异常释放 |

系统 OpenSSH 负责密钥生成/格式校验、sshd -t/-T、ssh -G 和实际认证。Windows 可选功能安装使用 DISM，agent 配置使用 sc.exe；防火墙使用编译进 EXE 的固定 PowerShell 适配代码，JSON 数据经子进程环境传递，不拼成命令代码。无需外部脚本文件，不更改执行策略。

构建：`powershell.exe -NoProfile -File scripts/Build.ps1 -Dotnet <.NET10的dotnet.exe>`。默认生成 bin/ssh-link.exe（win-x64）；可指定 win-arm64，需在该架构实际验证。使用自包含单文件、嵌入调试信息，未启用 AOT 或裁剪。代码未签名；企业应用控制可能要求可信签名。

测试：`scripts/Test.ps1 -Dotnet <dotnet.exe>`。测试写入新临时目录，真实调用本机 ssh/ssh-keygen 验证参数、公钥、配置和本地 TCP；真实文件 ACL 和备份恢复；服务、防火墙、安装及重启使用模拟对象。模拟对象仅从测试程序直接注入，CLI 没有测试根目录/提权绕过参数。

不能把通过这些测试描述为真实管理员安装或远端连接已验收。实际 Windows 安装、组织策略、目标账号和实际网络必须在指定两端逐台确认。强制终止、断电及系统安装超时可能留下部分系统状态；文件回退不是系统事务。备份校验防止不完整/意外改动，不是对同账号攻击者的数字签名。

运行时更新：自包含 EXE 内含 .NET 运行时，更新运行时需用受支持且更新后的 SDK/运行时包重新构建并替换 EXE。仅在开发电脑安装 SDK，使用方只复制 bin/ssh-link.exe 即可运行 CLI；要让代理执行完整流程则复制整个 Skill。

部署整个 Skill：`scripts/Install.ps1`，已有版本加 `-Update` 会先将旧目录完整保存为日期备份，不删除。打包 `scripts/Package.ps1`；归档包含源码/测试/构建脚本/EXE/文档及许可证，排除 obj、开发输出和历史 ZIP。
