using Microsoft.Win32;
using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace SshLink;

public sealed class Engine(Paths paths, ICommandRunner runner, IWindowsHost host)
{
    public Report Report { get; } = new();
    Snapshot? snapshot;
    string Key(Options o) => Path.GetFullPath(o.Get("key-path", paths.DefaultKey));
    static int Port(Options o) => int.TryParse(o.Get("port", "22"), out int p) && p is >= 1 and <= 65535 ? p : throw new ArgumentException("端口范围 1–65535。");
    public static bool Mutating(string action) => action is "setup" or "trust" or "keygen" or "agent" or "restore";
    void Begin(string purpose) { snapshot = new Snapshot(paths, purpose); Report.Backup = snapshot.DirectoryPath; }
    static void PrivatePath(string path)
    {
        if (!File.Exists(path) || path.EndsWith(".pub", StringComparison.OrdinalIgnoreCase)) throw new ArgumentException("需要现有私钥路径，不能是 .pub。");
        Files.NoLinks(path);
    }
    public async Task Execute(Options o)
    {
        Report.Role = o.Role; Report.Action = o.Action;
        ValidateRole(o);
        Target? target = o.Has("target-file") ? Config.Load(o.Need("target-file")) : null;
        if (target != null && new[] { "peer-ip", "local-ip", "user", "alias", "port" }.Any(o.Has)) throw new ArgumentException("目标文件不能与手填地址/账号/端口混用。");
        // Validate all action inputs before exposing an actionable plan.
        string plan = await Plan(o, target);
        if (Mutating(o.Action) && !o.Has("apply")) { Report.Add("变更计划", "PLAN", plan); return; }
        using var mutationLock = Mutating(o.Action) ? new MutationLock() : null;
        {
            Report.Executed = true;
            switch (o.Action)
            {
                case "check": if (o.Role == "connect") await ClientCheck(o); else await ServerCheck(o); break;
                case "keygen": await Generate(o); break;
                case "agent": await Agent(); break;
                case "setup": if (o.Role == "connect") await ClientSetup(o, target!); else await ServerSetup(o); break;
                case "trust": await Trust(o, target!); break;
                case "export": await Export(o); break;
                case "test": await Test(o, target!); break;
                case "restore": await Restore(o); break;
            }
        }
    }
    static void ValidateRole(Options o)
    {
        if (o.Role == "accept" && o.Action is "trust" or "test" or "keygen" or "agent") throw new ArgumentException("该操作仅用于 connect 发起端。");
        if (o.Role == "connect" && o.Action == "export") throw new ArgumentException("export 仅在 accept 被连接端运行。");
        if (o.Role == "accept" && o.Has("target-file")) throw new ArgumentException("目标 JSON 仅供 connect 端使用。");
        var common = new[] { "json", "report-file" }.ToHashSet();
        if (Mutating(o.Action)) common.Add("apply");
        string[] allowed = (o.Role, o.Action) switch
        {
            ("accept", "check") => ["peer-ip", "user", "port", "public-key-file"],
            ("accept", "setup") => ["peer-ip", "user", "port", "public-key-file"],
            ("accept", "export") => ["peer-ip", "user", "port", "local-ip", "alias", "out-file"],
            ("connect", "check") => ["key-path"],
            ("connect", "setup") => ["target-file", "key-path"],
            ("connect", "test") => ["target-file", "key-path", "check-codex"],
            ("connect", "trust") => ["target-file", "fingerprint"],
            ("connect", "keygen") => ["key-path", "no-passphrase"],
            ("connect", "agent") => [],
            (_, "restore") => ["manifest"],
            _ => throw new ArgumentException("不支持的角色/操作。")
        };
        foreach (string name in Options.AllNames.Where(o.Has)) if (!common.Contains(name) && !allowed.Contains(name)) throw new ArgumentException($"{o.Role} {o.Action} 不接受 --{name}。");
    }
    async Task<string> Plan(Options o, Target? t)
    {
        if (o.Role == "accept")
        {
            _ = Port(o);
            if (o.Has("peer-ip") && !Network.IsV4(o.Get("peer-ip"))) throw new ArgumentException("--peer-ip 必须为单一有效 IPv4。");
        }
        switch (o.Action)
        {
            case "setup" when o.Role == "connect":
                if (t == null) throw new ArgumentException("需要 --target-file。"); PrivatePath(Key(o));
                _ = Config.Client(File.Exists(paths.Config) ? File.ReadAllText(paths.Config) : "", t, Key(o));
                return $"本机标准 config 更新单个别名 {t.Alias} → {t.User}@{t.Ip}:{t.Port}，其他连接保留；备份文件/ACL。";
            case "setup":
                _ = o.Need("peer-ip"); _ = o.Need("user"); var pub = PublicKey.Parse(File.ReadAllText(o.Need("public-key-file"))); await pub.Validate(runner);
                return $"在本机为本地账号 {o.Get("user")} 配置 sshd/端口 {Port(o)}/公钥 {pub.Fingerprint} 与 ACL；规则允许 {o.Get("peer-ip")}；校验后重启服务。";
            case "trust":
                if (t == null) throw new ArgumentException("需要 --target-file。"); _ = Confirmed(o, t);
                return $"信任目标 {t.Computer} / {t.HostId}，仅写入已核对指纹 {o.Get("fingerprint")}；冲突停止。";
            case "test": if (t == null) throw new ArgumentException("需要 --target-file。"); PrivatePath(Key(o)); break;
            case "keygen":
                if (!o.Has("no-passphrase")) throw new ArgumentException("推荐用户交互 ssh-keygen 创建带口令密钥。无人值守无口令方案需明确 --no-passphrase。");
                if (File.Exists(Key(o)) || File.Exists(Key(o) + ".pub")) throw new IOException("密钥已存在，不覆盖。");
                return $"创建无口令 Ed25519 专用密钥 {Key(o)}，私钥留在本机并限制 ACL。";
            case "agent": return "本机启用 ssh-agent 自动启动；随后用户在相同 Windows 登录账号终端 ssh-add 加载私钥，口令不交给本工具。";
            case "export":
                _ = o.Need("out-file"); _ = o.Need("peer-ip");
                var endpoint = new Target { Ip = o.Need("local-ip"), User = o.Need("user"), Alias = o.Need("alias"), Port = Port(o) }; Config.Validate(endpoint);
                if (!Network.LocalIps().Contains(endpoint.Ip)) throw new ArgumentException("--local-ip 不是本机网卡地址，请核对方向。");
                if (File.Exists(o.Get("out-file"))) throw new IOException("导出文件已存在，不覆盖。"); break;
            case "restore": _ = LoadRestore(o.Need("manifest")); return $"恢复本机备份 {o.Get("manifest")} 的文件/ACL及新增规则；不卸载系统组件、不回退服务启动类型。";
        }
        return "";
    }
    async Task ClientCheck(Options o)
    {
        Report.Add("本机身份", "INFO", Report.Machine + " / " + Report.User);
        Report.Add("SSH 客户端", "PASS", Tools.Find("ssh"));
        string key = Key(o);
        if (!File.Exists(key)) Report.Add("私钥", "WARN", "尚无专用私钥。", "选择已有 --key-path 或用户交互运行 ssh-keygen。");
        else
        {
            var issues = Permissions.Issues(key, [Permissions.Me, Permissions.Admin, Permissions.System], []);
            Report.Add("私钥 ACL", issues.Count == 0 ? "PASS" : "FAIL", issues.Count == 0 ? key : string.Join("；", issues), issues.Count == 0 ? null : "先备份，再修复私钥所有者和 ACL，不要传出私钥。");
        }
        if (File.Exists(key + ".pub")) { var pub = PublicKey.Parse(File.ReadAllText(key + ".pub")); await pub.Validate(runner); Report.Meta["PublicKey"] = pub.Line; Report.Add("用户公钥", "INFO", pub.Fingerprint); }
        using var reg = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\ssh-agent");
        Report.Add("ssh-agent", "INFO", reg == null ? "服务未安装；直接无口令密钥不依赖 agent。" : "服务已注册；使用 ssh-add -l 检查实际加载身份。服务存在不证明已加载密钥。");
    }
    async Task Generate(Options o)
    {
        string key = Key(o); Files.NoLinks(key); Directory.CreateDirectory(Path.GetDirectoryName(key)!);
        if (File.Exists(key) || File.Exists(key + ".pub")) throw new IOException("密钥已存在，不覆盖。");
        var result = await runner.Run(Tools.Find("ssh-keygen"), ["-q", "-t", "ed25519", "-f", key, "-N", "", "-C", "ssh-link-" + Environment.MachineName]);
        result.RequireSuccess("生成密钥"); Permissions.Set(key, Permissions.Me, [Permissions.Me, Permissions.Admin, Permissions.System]);
        Report.Add("专用密钥", "PASS", "已生成无口令 Ed25519 密钥并复核私钥 ACL；私钥不导出。"); await ClientCheck(o);
    }
    async Task Agent()
    {
        host.RequireAdmin(); string sc = Path.Combine(Environment.SystemDirectory, "sc.exe");
        (await runner.Run(sc, ["config", "ssh-agent", "start=", "auto"])).RequireSuccess("agent 启动类型");
        var start = await runner.Run(sc, ["start", "ssh-agent"]); if (start.ExitCode != 0 && start.ExitCode != 1056) start.RequireSuccess("启动 agent");
        Report.Add("ssh-agent", "PASS", "自动启动已配置；请回到实际发起用户的交互终端运行 ssh-add，工具不接受口令。");
    }
    async Task ClientSetup(Options o, Target t)
    {
        string key = Key(o); string old = File.Exists(paths.Config) ? File.ReadAllText(paths.Config) : ""; string updated = Config.Client(old, t, key);
        Begin("单目标客户端配置"); snapshot!.Track(paths.Config);
        try
        {
            Files.AtomicWrite(paths.Config, updated);
            var result = await runner.Run(Tools.Find("ssh"), ["-G", "-F", paths.Config, t.Alias]); result.RequireSuccess("ssh -G"); Config.Match(Config.Map(result.Stdout), t);
            Permissions.Set(paths.Config, Permissions.Me, [Permissions.Me, Permissions.Admin, Permissions.System]);
            Report.Add("标准 config", "PASS", $"{paths.Config}；已保存单个目标 {t.Alias}，其他连接保留。");
        }
        catch { await Rollback(false); throw; }
    }
    static List<HostKey> Confirmed(Options o, Target t)
    {
        string fp = o.Need("fingerprint"); var selected = t.HostKeys.Where(k => k.Fingerprint == fp).ToList();
        if (selected.Count != 1) throw new InvalidDataException("指纹必须唯一匹配目标文件中的一把主机公钥；请在目标本机核对完整 SHA256 指纹。");
        return selected;
    }
    async Task Trust(Options o, Target t)
    {
        var keys = Confirmed(o, t); foreach (var k in keys) await PublicKey.Parse(k.Line).Validate(runner);
        Files.NoLinks(paths.KnownHosts);
        string old = File.Exists(paths.KnownHosts) ? File.ReadAllText(paths.KnownHosts) : "";
        if (File.Exists(paths.KnownHosts))
        {
            var found = await runner.Run(Tools.Find("ssh-keygen"), ["-F", t.HostId, "-f", paths.KnownHosts]);
            if (found.ExitCode is not (0 or 1)) found.RequireSuccess("查询 known_hosts");
            foreach (string line in found.Stdout.Split('\n').Where(l => l.Trim().Length > 0 && !l.StartsWith('#')))
            {
                string[] cols = Regex.Split(line.Trim(), @"\s+");
                if (cols[0].StartsWith('@')) throw new InvalidDataException("该主机已有 CA/撤销策略，需人工核实。");
                if (cols.Length < 3 || !t.HostKeys.Any(k => { var p = PublicKey.Parse(k.Line); return p.Type == cols[1] && p.Blob == cols[2]; })) throw new InvalidDataException("已有主机指纹冲突；不自动删除或覆盖，请在目标本机确认是否重装/换机/IP复用。");
            }
        }
        string text = old;
        foreach (var k in keys)
        {
            var pub = PublicKey.Parse(k.Line); string line = $"{t.HostId} {pub.Type} {pub.Blob}";
            if (!text.Split('\n').Any(l => l.TrimEnd('\r') == line)) text = text.TrimEnd('\r', '\n') + (text.Length == 0 ? "" : "\r\n") + line + "\r\n";
        }
        Begin("核对单台主机信任"); snapshot!.Track(paths.KnownHosts);
        try { Files.AtomicWrite(paths.KnownHosts, text); Permissions.Set(paths.KnownHosts, Permissions.Me, [Permissions.Me, Permissions.Admin, Permissions.System]); }
        catch { await Rollback(false); throw; }
        Report.Add("主机信任", "PASS", $"{t.HostId} / {o.Get("fingerprint")}；只写入已核对密钥。");
    }
    async Task Test(Options o, Target t)
    {
        string ssh = Tools.Find("ssh");
        var g = await runner.Run(ssh, ["-G", "-F", paths.Config, t.Alias]); g.RequireSuccess("ssh -G"); Config.Match(Config.Map(g.Stdout), t);
        Report.Add("有效配置", "PASS", $"{t.User}@{t.Ip}:{t.Port}");
        var tcp = await Network.Tcp(t.Ip, t.Port); Report.Add("TCP", tcp.Ok ? "PASS" : "FAIL", tcp.Detail, tcp.Ok ? null : "先查目标网卡地址、实际服务监听、睡眠/VPN/防火墙/网络隔离。");
        if (!tcp.Ok) { Report.Add("SSH 认证", "SKIP", "TCP 未通过，不尝试认证。"); return; }
        List<string> args = ["-F", paths.Config];
        foreach (string option in new[] { "BatchMode=yes", "StrictHostKeyChecking=yes", "ConnectTimeout=5", "ConnectionAttempts=1", "PreferredAuthentications=publickey", "PasswordAuthentication=no", "KbdInteractiveAuthentication=no", "IdentitiesOnly=yes", "UpdateHostKeys=no", "ForwardAgent=no", "ClearAllForwardings=yes", "PermitLocalCommand=no", "ControlMaster=no", "ControlPath=none", "ProxyCommand=none", "ProxyJump=none" }) { args.Add("-o"); args.Add(option); }
        args.AddRange(["-i", Key(o), t.Alias]);
        foreach (string command in o.Has("check-codex") ? new[] { "whoami", "hostname", "codex --version" } : ["whoami", "hostname"])
        {
            var result = await runner.Run(ssh, args.Concat([command]), 25);
            Report.Add(command, result.ExitCode == 0 ? "PASS" : "FAIL", result.ExitCode == 0 ? result.Stdout : result.Stderr,
                result.ExitCode == 0 ? null : command.StartsWith("codex", StringComparison.Ordinal) ? "SSH 已通过；检查远端登录用户安装与非交互 PATH。" : "先查主机指纹；再查账号、公钥路径/ACL、agent 与服务日志。不要关闭主机校验。");
            if (result.ExitCode != 0) break;
        }
    }
    async Task<Dictionary<string, string>> Effective(ServiceInfo s, LocalAccount? account = null, string? peer = null)
    {
        List<string> args = ["-T", "-f", s.Config];
        if (account != null) args.AddRange(["-C", $"user={account.Name},host={Environment.MachineName},addr={peer}"]);
        var result = await runner.Run(s.Exe, args); result.RequireSuccess("sshd 有效配置"); return Config.Map(result.Stdout);
    }
    static string KeyFile(Dictionary<string, string> map, LocalAccount account)
    {
        string raw = map.GetValueOrDefault("authorizedkeysfile", "").Trim('"').Replace("__PROGRAMDATA__", Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), StringComparison.OrdinalIgnoreCase).Replace('/', '\\');
        string adminPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ssh", "administrators_authorized_keys");
        if (raw.Equals(adminPath, StringComparison.OrdinalIgnoreCase)) return adminPath;
        if (raw is @".ssh\authorized_keys" or @"%h\.ssh\authorized_keys" && account.Profile != null) return Path.Combine(account.Profile, ".ssh", "authorized_keys");
        throw new InvalidDataException($"非标准/多路径 AuthorizedKeysFile，停止自动写入：{raw}");
    }
    static string[] KeyAllowed(string path, LocalAccount account) => Path.GetFileName(path).Equals("administrators_authorized_keys", StringComparison.OrdinalIgnoreCase)
        ? [Permissions.Admin, Permissions.System] : [account.Sid, Permissions.Admin, Permissions.System];
    async Task Deploy(ServiceInfo service, LocalAccount account, string peer, PublicKey key)
    {
        var map = await Effective(service, account, peer); string file = KeyFile(map, account); string[] allowed = KeyAllowed(file, account);
        snapshot!.Track(file); Files.AtomicWrite(file, PublicKey.Merge(File.Exists(file) ? File.ReadAllText(file) : "", key));
        Permissions.Set(file, allowed[0], allowed); Report.Add("授权公钥与 ACL", "PASS", file + " / " + key.Fingerprint);
    }
    public async Task ServerCheck(Options o)
    {
        Report.Add("本机身份", "INFO", Report.Machine + " / " + Report.User); Report.Meta["LocalIps"] = Network.LocalIps();
        Report.Add("管理员权限", Permissions.Elevated ? "PASS" : "WARN", Permissions.Elevated ? "可读取受保护配置。" : "只读检查；受保护信息 UNKNOWN，配置需管理员。");
        var s = host.Service();
        if (s == null) { Report.Add("sshd", "FAIL", "未安装服务。", "目标端管理员运行 accept setup 的计划与配置。"); return; }
        Report.Add("sshd", s.State == 4 ? "PASS" : "FAIL", $"State={s.State} PID={s.Pid} StartType={s.StartType} / {s.Exe}");
        Report.Add("IPv4 监听", host.Listens(s, Port(o)) ? "PASS" : "FAIL", $"需由当前 sshd 服务 PID 对外监听 IPv4:{Port(o)}。");
        if (Permissions.Elevated)
        {
            var syntax = await runner.Run(s.Exe, ["-t", "-f", s.Config]); Report.Add("sshd 配置语法", syntax.ExitCode == 0 ? "PASS" : "FAIL", syntax.ExitCode == 0 ? s.Config : syntax.Stderr);
            if (syntax.ExitCode == 0 && o.Has("user") && o.Has("peer-ip"))
            {
                var account = host.Account(o.Get("user")); var map = await Effective(s, account, o.Get("peer-ip"));
                string file = KeyFile(map, account); Report.Add("目标账号", "PASS", $"{account.Name} / 管理员={account.Admin} / {file}");
                if (File.Exists(file))
                {
                    string[] allowed = KeyAllowed(file, account); var issues = Permissions.Issues(file, allowed, allowed);
                    Report.Add("授权文件 ACL", issues.Count == 0 ? "PASS" : "FAIL", issues.Count == 0 ? "复核通过。" : string.Join("；", issues));
                    if (o.Has("public-key-file")) { var key = PublicKey.Parse(File.ReadAllText(o.Get("public-key-file"))); bool present = PublicKey.Merge(File.ReadAllText(file), key) == File.ReadAllText(file); Report.Add("控制端公钥", present ? "PASS" : "FAIL", key.Fingerprint); }
                }
                else Report.Add("授权文件", "FAIL", "尚不存在。");
                if (map.GetValueOrDefault("pubkeyauthentication") != "yes") Report.Add("公钥认证策略", "FAIL", "有效配置没有启用公钥认证。");
                if (map.GetValueOrDefault("forcecommand") != "none") Report.Add("ForceCommand", "WARN", "检测到强制命令策略，可能无法运行通用命令。");
            }
        }
        else Report.Add("服务配置/公钥 ACL", "UNKNOWN", "需要管理员读取受保护配置，不能据此判断密钥缺失。");
        try { Report.Add("防火墙规则", "INFO", await host.FirewallSummary()); } catch (Exception ex) { Report.Add("防火墙", "UNKNOWN", ex.Message); }
        Report.Add("端到端可达性", "UNKNOWN", "本机监听/规则不是 A→B 的连通证据，需在发起端 test。");
        using var keyReg = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\OpenSSH"); Report.Meta["DefaultShell"] = keyReg?.GetValue("DefaultShell")?.ToString() ?? "cmd.exe";
    }
    async Task ServerSetup(Options o)
    {
        host.RequireAdmin(); string peer = o.Need("peer-ip"); int port = Port(o); var account = host.Account(o.Need("user"));
        var key = PublicKey.Parse(File.ReadAllText(o.Need("public-key-file"))); await key.Validate(runner);
        Begin("本机 SSH 服务与单个控制端公钥"); var s = host.Service(); bool wasRunning = s?.State == 4;
        snapshot!.Manifest.Notes.Add($"原服务状态={s?.State}，启动类型={s?.StartType}；文件恢复不卸载组件或恢复启动类型。"); snapshot.Save();
        try
        {
            if (s == null) { snapshot.Manifest.Notes.Add("可能安装系统 OpenSSH 功能；恢复不会卸载。"); snapshot.Save(); await host.Install(); s = host.Service() ?? throw new IOException("安装后未发现 sshd。"); }
            if (!File.Exists(s.Config)) { await host.Start(false, false); s = host.Service()!; }
            snapshot.Track(s.Config);
            string updated = Config.Server(File.ReadAllText(s.Config), port); string candidate = s.Config + ".ssh-link-check-" + Guid.NewGuid().ToString("N");
            try { Files.CreateNew(candidate, updated); (await runner.Run(s.Exe, ["-t", "-f", candidate])).RequireSuccess("候选 sshd 配置校验"); }
            finally { if (File.Exists(candidate)) File.Delete(candidate); }
            Files.AtomicWrite(s.Config, updated);
            var effective = await Effective(s, account, peer);
            if (effective.GetValueOrDefault("pubkeyauthentication") != "yes" || effective.GetValueOrDefault("forcecommand") != "none") throw new InvalidDataException("Match/Include 公钥认证或 ForceCommand 策略阻止自动配置；保留策略并停止。");
            await Deploy(s, account, peer, key);
            string rule = "WindowsSshLink-" + peer.Replace('.', '-') + "-" + port;
            if (await host.EnsureRule(rule, peer, port)) { snapshot.Manifest.CreatedRules.Add(rule); snapshot.Save(); }
            await host.Start(true, true); s = host.Service()!;
            if (s.State != 4 || !host.Listens(s, port)) throw new IOException("重启后未发现实际 sshd PID 对外监听预期 IPv4 端口。");
            Report.Add("本机配置", "PASS", $"sshd 自动启动，IPv4:{port} 正在监听；仅部署当前公钥。");
            Report.Add("防火墙与账号策略", "WARN", "新增专用规则仅允许指定 PeerIp；旧宽泛规则/组织策略保持原样，不代表已限制全部来源。最终需发起端认证验证。");
        }
        catch { await Rollback(wasRunning); throw; }
    }
    async Task Export(Options o)
    {
        host.RequireAdmin(); var s = host.Service() ?? throw new IOException("未发现 sshd。"); var account = host.Account(o.Need("user"));
        var map = await Effective(s, account, o.Need("peer-ip"));
        var t = new Target { Computer = Environment.MachineName, Alias = o.Get("alias"), User = account.Name, Ip = o.Get("local-ip"), Port = Port(o) };
        // Keep all repeated hostkey lines; a dictionary would lose enabled algorithms.
        var raw = await runner.Run(s.Exe, ["-T", "-f", s.Config]); raw.RequireSuccess("读取有效主机密钥路径");
        foreach (string line in raw.Stdout.Split('\n').Where(l => l.StartsWith("hostkey ", StringComparison.Ordinal)))
        {
            string file = line[8..].Trim().Trim('"').Replace("__PROGRAMDATA__", Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), StringComparison.OrdinalIgnoreCase) + ".pub";
            var pub = PublicKey.Parse(File.ReadAllText(file)); await pub.Validate(runner); t.HostKeys.Add(new(pub.Line, pub.Fingerprint));
            Report.Add("主机指纹", "INFO", pub.Type + " " + pub.Fingerprint);
        }
        if (t.HostKeys.Count == 0) throw new IOException("未读取到有效主机公钥。");
        if (s.State != 4 || !host.Listens(s, t.Port) || map.GetValueOrDefault("pubkeyauthentication") != "yes") throw new IOException("服务、监听或公钥策略不满足导出条件；先完成本机配置。");
        Files.CreateNew(o.Need("out-file"), Json.Encode(t)); Report.Meta["ExportFile"] = Path.GetFullPath(o.Get("out-file"));
        Report.Add("目标导出", "PASS", "已导出主机公钥与单个目标参数；在发起端从可信渠道核对指纹。");
    }
    async Task Rollback(bool restart)
    {
        if (snapshot == null) return;
        try
        {
            Snapshot.RestoreFiles(snapshot.Manifest, snapshot.DirectoryPath);
            foreach (string rule in snapshot.Manifest.CreatedRules) await host.RemoveRule(rule);
            if (restart) await host.Start(true, false);
            Report.Add("文件回退", "WARN", "已恢复记录文件/ACL及新增规则；系统功能/启动类型不自动回退，新目录可能保留。");
        }
        catch (Exception ex) { Report.Add("回退失败", "FAIL", ex.Message, "检查备份 manifest 和实际服务/规则，不要假定已恢复。"); }
    }
    (Manifest M, string Dir) LoadRestore(string manifest)
    {
        string full = Path.GetFullPath(manifest); string root = Path.GetFullPath(Path.Combine(paths.Data, "backups")) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || Path.GetFileName(full) != "manifest.json") throw new IOException("只恢复当前操作员的本工具备份 manifest。");
        Files.NoLinks(full); var m = Json.Read<Manifest>(full); string dir = Path.GetDirectoryName(full)!; Snapshot.Validate(m, dir);
        string? serviceConfig = host.Service()?.Config;
        foreach (var f in m.Files)
        {
            string path = Path.GetFullPath(f.Path); bool client = Same(path, paths.Config) || Same(path, paths.KnownHosts);
            bool server = Same(path, serviceConfig) || Same(path, Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ssh", "administrators_authorized_keys"));
            if (!client && !server)
            {
                using var profiles = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList");
                foreach (string sid in profiles?.GetSubKeyNames() ?? [])
                { using var profile = profiles!.OpenSubKey(sid); if (profile?.GetValue("ProfileImagePath") is string p && Same(path, Path.Combine(Environment.ExpandEnvironmentVariables(p), ".ssh", "authorized_keys"))) server = true; }
            }
            if (!client && !server) throw new IOException("备份包含非受管路径，拒绝恢复。");
            if (server) Permissions.RequireAdmin();
        }
        foreach (string rule in m.CreatedRules) { if (!Regex.IsMatch(rule, @"^WindowsSshLink-\d+-\d+-\d+-\d+-\d+$")) throw new IOException("备份含未知规则。"); Permissions.RequireAdmin(); }
        return (m, dir);
    }
    static bool Same(string path, string? other) => other != null && path.Equals(Path.GetFullPath(other), StringComparison.OrdinalIgnoreCase);
    async Task Restore(Options o)
    {
        var (m, dir) = LoadRestore(o.Need("manifest")); Begin("恢复之前的现状"); foreach (var f in m.Files) snapshot!.Track(f.Path);
        Snapshot.RestoreFiles(m, dir); foreach (string rule in m.CreatedRules) await host.RemoveRule(rule);
        var service = host.Service();
        if (service != null && m.Files.Any(f => Same(f.Path, service.Config)))
        { (await runner.Run(service.Exe, ["-t", "-f", service.Config])).RequireSuccess("已恢复文件，但 sshd 配置校验失败"); await host.Start(true, false); }
        Report.Add("恢复", "PASS", "文件/ACL及该次新增规则已恢复；恢复前状态已另存。未卸载功能或恢复启动类型。");
    }
}
