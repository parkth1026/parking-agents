# Windows SSH Link 2.0

这是一个完整 Skill，内含 C# CLI、全部源码和测试。两台 Windows 各放同一份，每次只连接一台。

在本目录打开 PowerShell：

```powershell
.\bin\ssh-link.exe --help
# 发起连接电脑上执行
.\bin\ssh-link.exe connect check
# 被连接电脑上执行；Administrator 是这台电脑自己的登录账号
.\bin\ssh-link.exe accept check --peer-ip 10.66.8.27 --user Administrator
```

详细配置流程见 `references/workflow.md`。修改配置的命令默认先给计划，加 `--apply` 才执行。单文件 EXE 可独立复制，不需要旁边的脚本或预装 .NET；源码、Skill 文档和 SDK 只在代理指导或开发时需要。

要安装整个 Skill：

```powershell
powershell.exe -NoProfile -File .\scripts\Install.ps1
# 更新已有版本并完整保留旧目录：
powershell.exe -NoProfile -File .\scripts\Install.ps1 -Update
```

新会话说：`使用 $windows-ssh-link，当前电脑是被连接端，允许 10.66.8.27 连接。先检查，再按结果配置和验证，一次只处理这一台。`

发起端说：`使用 $windows-ssh-link，当前电脑是发起端，只处理我提供的这一个目标文件。先检查，再核对指纹、配置和测试。`

源码在 `src/SshLink`，测试在 `tests/SshLink.Tests`，构建/测试/打包/安装入口都在 `scripts`。使用 CLI 不需要 SDK；从源码构建需要 .NET 10 SDK。系统防火墙适配仍调用系统 PowerShell，核心工作流已迁入 C#。编译及测试边界见 `references/implementation.md`。
