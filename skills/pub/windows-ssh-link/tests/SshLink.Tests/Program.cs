using SshLink;
using System.Net;
using System.Net.Sockets;

static class Tests
{
    static int passed;
    static void Assert(bool ok, string name) { if (!ok) throw new Exception(name); passed++; Console.WriteLine("PASS " + name); }
    static void Throws(Action action, string name) { try { action(); } catch { Assert(true, name); return; } throw new Exception(name); }
    static async Task Fails(Func<Task> action, string name) { try { await action(); } catch { Assert(true, name); return; } throw new Exception(name); }
    static async Task Main(string[] args)
    {
        Console.OutputEncoding = new System.Text.UTF8Encoding(false);
        if (args.FirstOrDefault() == "--echo") { Console.Write(Json.Encode(args.Skip(1).ToArray())); return; }
        if (args.FirstOrDefault() == "--wait") { await Task.Delay(TimeSpan.FromMinutes(1)); return; }
        string root = Path.Combine(Path.GetTempPath(), "ssh-link-csharp-tests-" + Guid.NewGuid().ToString("N")); Directory.CreateDirectory(root);
        var paths = new Paths(Path.Combine(root, "profile"), Path.Combine(root, "data"));
        var runner = new CommandRunner(); var host = new FakeHost(root); string key = Path.Combine(root, "中文 key with spaces");
        var echo = await runner.Run(Environment.ProcessPath!, ["--echo", "", "中文 with spaces", "x\"y", "tail\\"]);
        var echoed = System.Text.Json.JsonSerializer.Deserialize<string[]>(echo.Stdout)!;
        Assert(echoed.SequenceEqual(new[] { "", "中文 with spaces", "x\"y", "tail\\" }), "ArgumentList preserves empty/unicode/quote/backslash arguments");
        await Fails(() => runner.Run(Environment.ProcessPath!, ["--wait"], 1), "subprocess timeout terminates bounded command");
        using (var held = new MutationLock())
        {
            await Task.Delay(5);
            await Fails(() => Task.Run(() => { using var blocked = new MutationLock(); }), "parallel mutation rejected across async thread switch");
        }
        using (var reacquired = new MutationLock()) Assert(true, "mutation lock released after await and can be reacquired");
        var keygen = await runner.Run(Tools.Find("ssh-keygen"), ["-q", "-t", "ed25519", "-f", key, "-N", ""]); keygen.RequireSuccess("fixture key");
        var pub = PublicKey.Parse(File.ReadAllText(key + ".pub")); await pub.Validate(runner); Assert(pub.Type == "ssh-ed25519", "real ssh-keygen validates C# public-key parsing and SHA256");
        Throws(() => PublicKey.Parse("-----BEGIN OPENSSH PRIVATE KEY-----"), "private key rejected");
        Throws(() => PublicKey.Parse(pub.Line + "\n" + pub.Line), "multiline public key rejected");
        Throws(() => PublicKey.Parse("ssh-ed25519 Zm9v"), "malformed key rejected");
        string restricted = "from=\"10.66.8.27\" " + pub.Line + "\n";
        Assert(PublicKey.Merge(restricted, pub) == restricted, "existing authorized key restrictions preserved");
        Assert(PublicKey.Merge(PublicKey.Merge("# comment\n", pub), pub) == PublicKey.Merge("# comment\n", pub), "key merge idempotent");
        Permissions.Set(key, Permissions.Me, [Permissions.Me, Permissions.Admin, Permissions.System]); Assert(Permissions.Issues(key, [Permissions.Me, Permissions.Admin, Permissions.System], [Permissions.Me]).Count == 0, "real native private ACL repair and verification");
        string old = "PasswordAuthentication yes\r\nPort 2222\r\nMatch Group administrators\r\n AuthorizedKeysFile __PROGRAMDATA__/ssh/administrators_authorized_keys\r\n";
        string server = Config.Server(old, 22); Assert(server.Contains("PasswordAuthentication yes") && server.IndexOf("Port 22", StringComparison.Ordinal) < server.IndexOf("Match Group", StringComparison.Ordinal), "global config precedes Match and preserves password policy");
        Assert(Config.Server(server, 22) == server, "server config idempotent");
        var target = new Target { Ip = "192.0.2.10", Alias = "node-1", User = "worker", Port = 2222, HostKeys = [new(pub.Line, pub.Fingerprint)] };
        string config = Config.Client("Host untouched\n HostName 192.0.2.55\n", target, key);
        var second = new Target { Ip = "192.0.2.11", Alias = "node-2", User = "worker", HostKeys = [new(pub.Line, pub.Fingerprint)] };
        string two = Config.Client(config, second, key); string tempConfig = Path.Combine(root, "test config"); Files.AtomicWrite(tempConfig, two);
        var g = await runner.Run(Tools.Find("ssh"), ["-G", "-F", tempConfig, target.Alias]); Config.Match(Config.Map(g.Stdout), target); Assert(g.ExitCode == 0 && two.Contains("Host node-1") && two.Contains("Host node-2"), "real ssh parses single-target config and preserves first host");
        Assert(Config.Client(two, second, key) == two, "single-target client config idempotent");
        Throws(() => Config.Client("Host node-1\n HostName 192.0.2.60\n", target, key), "explicit alias owned by other config not overwritten");
        Throws(() => Options.Parse(["connect", "check", "--key-path", "a", "--key-path", "b"]), "duplicate options rejected");
        Throws(() => Config.Validate(new Target { Ip = "999.1.1.1", Alias = "ok", User = "worker" }), "invalid IPv4 rejected");
        Throws(() => Options.Parse(["connect", "check", "--unknown"]), "unknown flags rejected");
        var plan = new Engine(paths, runner, host); await plan.Execute(Options.Parse(["connect", "keygen", "--no-passphrase", "--key-path", Path.Combine(root, "planned")]));
        Assert(!plan.Report.Executed && !File.Exists(Path.Combine(root, "planned")) && plan.Report.Rows[0].State == "PLAN", "plan does not generate key");
        var create = new Engine(paths, runner, host); await create.Execute(Options.Parse(["connect", "keygen", "--no-passphrase", "--key-path", Path.Combine(root, "generated"), "--apply"]));
        Assert(create.Report.Success && File.Exists(Path.Combine(root, "generated")), "C# key generation end to end without PS1");
        var refuse = new Engine(paths, runner, host); await Fails(() => refuse.Execute(Options.Parse(["connect", "keygen", "--no-passphrase", "--key-path", Path.Combine(root, "generated"), "--apply"])), "existing private key not overwritten");
        var backup = new Snapshot(paths, "test"); string file = Path.Combine(root, "bytes"); File.WriteAllBytes(file, [0xFF, 0, 1, 2]); backup.Track(file); File.WriteAllText(file, "changed"); Snapshot.RestoreFiles(backup.Manifest, backup.DirectoryPath);
        Assert(File.ReadAllBytes(file).SequenceEqual(new byte[] { 0xFF, 0, 1, 2 }), "backup restores exact binary bytes and ACL");
        File.WriteAllText(Path.Combine(backup.DirectoryPath, "0.bin"), "tamper"); Throws(() => Snapshot.RestoreFiles(backup.Manifest, backup.DirectoryPath), "tampered backup fails hash before restore");
        string targetFile = Path.Combine(root, "target.json"); File.WriteAllText(targetFile, Json.Encode(target));
        var trustPlan = new Engine(paths, runner, host); await trustPlan.Execute(Options.Parse(["connect", "trust", "--target-file", targetFile, "--fingerprint", pub.Fingerprint]));
        Assert(!File.Exists(paths.KnownHosts), "host trust plan does not modify known_hosts");
        var badTrust = new Engine(paths, runner, host); await Fails(() => badTrust.Execute(Options.Parse(["connect", "trust", "--target-file", targetFile, "--fingerprint", "SHA256:bad", "--apply"])), "incorrect fingerprint refused");
        var trust = new Engine(paths, runner, host); await trust.Execute(Options.Parse(["connect", "trust", "--target-file", targetFile, "--fingerprint", pub.Fingerprint, "--apply"]));
        var found = await runner.Run(Tools.Find("ssh-keygen"), ["-F", target.HostId, "-f", paths.KnownHosts]); Assert(found.ExitCode == 0 && found.Stdout.Contains(pub.Blob), "C# host trust supports nonstandard port and actual OpenSSH lookup");
        string trustedText = File.ReadAllText(paths.KnownHosts);
        File.WriteAllText(paths.KnownHosts, target.HostId + " ssh-ed25519 AAAA-conflicting\n"); string conflictText = File.ReadAllText(paths.KnownHosts);
        var conflict = new Engine(paths, runner, host); await Fails(() => conflict.Execute(Options.Parse(["connect", "trust", "--target-file", targetFile, "--fingerprint", pub.Fingerprint, "--apply"])), "conflicting host fingerprint never overwritten");
        Assert(File.ReadAllText(paths.KnownHosts) == conflictText, "known_hosts conflict leaves original bytes untouched");
        File.WriteAllText(paths.KnownHosts, trustedText);
        var setup = new Engine(paths, runner, host); await setup.Execute(Options.Parse(["connect", "setup", "--target-file", targetFile, "--key-path", key, "--apply"]));
        Assert(setup.Report.Success && File.Exists(paths.Config), "C# single-target setup and ACL succeed");
        string beforeFailure = File.ReadAllText(paths.Config);
        var badClient = new Engine(paths, new MismatchRunner(runner), host);
        await Fails(() => badClient.Execute(Options.Parse(["connect", "setup", "--target-file", targetFile, "--key-path", key, "--apply"])), "effective config override rejects client setup");
        Assert(File.ReadAllText(paths.Config) == beforeFailure, "effective config failure restores original client config and ACL");
        var setup2 = new Engine(paths, runner, host); string t2 = Path.Combine(root, "target2.json"); File.WriteAllText(t2, Json.Encode(second)); await setup2.Execute(Options.Parse(["connect", "setup", "--target-file", t2, "--key-path", key, "--apply"]));
        Assert(File.ReadAllText(paths.Config).Contains("Host node-1") && File.ReadAllText(paths.Config).Contains("Host node-2"), "separate calls do not delete previous target");
        // Restore is itself backed up; client paths limited to isolated Paths instance.
        var restore = new Engine(paths, runner, host); await restore.Execute(Options.Parse(["connect", "restore", "--manifest", Path.Combine(setup2.Report.Backup!, "manifest.json"), "--apply"]));
        Assert(!File.ReadAllText(paths.Config).Contains("Host node-2") && File.ReadAllText(paths.Config).Contains("Host node-1"), "restore recovers prior single-target config");
        var outside = new Engine(paths, runner, host); await Fails(() => outside.Execute(Options.Parse(["connect", "restore", "--manifest", targetFile, "--apply"])), "restore outside owned backup root refused");
        // No remote connections: local TCP listener only.
        var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); int port = ((IPEndPoint)listener.LocalEndpoint).Port;
        Assert((await Network.Tcp("127.0.0.1", port)).Ok, "local TCP success"); listener.Stop(); Assert(!(await Network.Tcp("127.0.0.1", port)).Ok, "local refused port is not auth success");
        var realHost = new WindowsHost(runner); var local = new TcpListener(IPAddress.Any, 0); local.Start(); int localPort = ((IPEndPoint)local.LocalEndpoint).Port;
        try { Assert(realHost.Listens(new ServiceInfo("fixture", "fixture", 4, (uint)Environment.ProcessId, 2), localPort), "native IP Helper verifies actual listener owner PID"); }
        finally { local.Stop(); }
        var localAccount = realHost.Account(Environment.UserName);
        Assert(localAccount.Sid == Permissions.Me, "native NetAPI resolves current local account SID and group membership");
        // Service/firewall APIs mocked; C# config/key files/ACL/rollback are real temporary files.
        string fixture = Path.Combine(root, "controller.pub"); File.WriteAllText(fixture, pub.Line);
        var fake = new FakeRunner(runner, host); string[] serverArgs = ["accept", "setup", "--peer-ip", "10.66.8.27", "--user", "fixture", "--public-key-file", fixture, "--apply"];
        File.WriteAllText(host.ServiceConfig, old); host.Running = true;
        var successServer = new Engine(paths, fake, host); await successServer.Execute(Options.Parse(serverArgs));
        Assert(successServer.Report.Success && host.Rules.Count == 1 && File.ReadAllText(host.AuthFile).Contains(pub.Blob), "mock service transaction with actual temp public-key ACL");
        string goodConfig = File.ReadAllText(host.ServiceConfig), goodAuth = File.ReadAllText(host.AuthFile);
        host.Rules.Clear(); fake.Restricted = true;
        var restrictedServer = new Engine(paths, fake, host); await Fails(() => restrictedServer.Execute(Options.Parse(serverArgs)), "ForceCommand prevents setup");
        Assert(File.ReadAllText(host.ServiceConfig) == goodConfig && File.ReadAllText(host.AuthFile) == goodAuth && host.Rules.Count == 0, "restricted policy restores files and adds no rule");
        fake.Restricted = false; host.Listener = false;
        var failedListener = new Engine(paths, fake, host); await Fails(() => failedListener.Execute(Options.Parse(serverArgs)), "post-restart listener failure rejected");
        Assert(host.Rules.Count == 0 && File.ReadAllText(host.ServiceConfig) == goodConfig, "post-restart failure removes new rule and restores config");
        host.Listener = true; fake.BadSyntax = true;
        var badSyntax = new Engine(paths, fake, host); await Fails(() => badSyntax.Execute(Options.Parse(serverArgs)), "candidate syntax failure rejected");
        Assert(host.Rules.Count == 0 && File.ReadAllText(host.ServiceConfig) == goodConfig, "invalid candidate never replaces real config");
        // Test effective config mismatch halts before any TCP invocation.
        var mismatch = new Engine(paths, runner, host);
        await Fails(() => mismatch.Execute(Options.Parse(["connect", "test", "--target-file", t2, "--key-path", key])), "test rejects missing target alias before network");
        Assert(!mismatch.Report.Rows.Any(r => r.Stage == "TCP"), "wrong alias never progresses to network");
        Console.WriteLine($"ALL PASS: {passed} assertions. Temporary files: {root}");
        Console.WriteLine("No real Windows service/firewall/registry changes or remote target connections.");
    }
}
sealed class MismatchRunner(ICommandRunner real) : ICommandRunner
{
    public Task<CommandResult> Run(string file, IEnumerable<string> args, int timeoutSeconds = 20, IReadOnlyDictionary<string, string>? env = null) =>
        args.Contains("-G") ? Task.FromResult(new CommandResult(0, "hostname 192.0.2.254\nuser wrong\nport 22", "")) : real.Run(file, args, timeoutSeconds, env);
}
sealed class FakeHost : IWindowsHost
{
    readonly string root;
    public string ServiceConfig => Path.Combine(root, "sshd_config");
    public string AuthFile => Path.Combine(root, "profile-fixture", ".ssh", "authorized_keys");
    public bool Running = true, Listener = true;
    public HashSet<string> Rules = [];
    public FakeHost(string root) { this.root = root; Directory.CreateDirectory(Path.Combine(root, "profile-fixture")); }
    public void RequireAdmin() { }
    public ServiceInfo? Service() => new("fixture-sshd", ServiceConfig, Running ? 4u : 1u, 123, 2);
    public LocalAccount Account(string user) => new("fixture", Permissions.Me, false, Path.Combine(root, "profile-fixture"));
    public Task Start(bool restart, bool automatic) { Running = true; return Task.CompletedTask; }
    public bool Listens(ServiceInfo service, int port) => Listener;
    public Task Install() => throw new Exception("unexpected install");
    public Task<bool> EnsureRule(string name, string ip, int port) => Task.FromResult(Rules.Add(name));
    public Task RemoveRule(string name) { Rules.Remove(name); return Task.CompletedTask; }
    public Task<string> FirewallSummary() => Task.FromResult("mock rules");
}
sealed class FakeRunner(ICommandRunner real, FakeHost host) : ICommandRunner
{
    public bool Restricted, BadSyntax;
    public Task<CommandResult> Run(string file, IEnumerable<string> args, int timeoutSeconds = 20, IReadOnlyDictionary<string, string>? env = null)
    {
        if (file != "fixture-sshd") return real.Run(file, args, timeoutSeconds, env);
        string[] a = args.ToArray();
        if (a.Contains("-t")) return Task.FromResult(new CommandResult(BadSyntax ? 1 : 0, "", BadSyntax ? "bad syntax" : ""));
        if (a.Contains("-T")) return Task.FromResult(new CommandResult(0, "pubkeyauthentication yes\nforcecommand " + (Restricted ? "internal-sftp" : "none") + "\nauthorizedkeysfile .ssh/authorized_keys\nhostkey " + Path.Combine(Path.GetDirectoryName(host.ServiceConfig)!, "hostkey"), ""));
        throw new Exception("unexpected command");
    }
}
