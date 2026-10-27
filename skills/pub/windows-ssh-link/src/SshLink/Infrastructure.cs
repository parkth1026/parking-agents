using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Text;

namespace SshLink;

public record CommandResult(int ExitCode, string Stdout, string Stderr)
{
    public void RequireSuccess(string operation) { if (ExitCode != 0) throw new InvalidOperationException($"{operation}：{Stderr} {Stdout}".Trim()); }
}
public interface ICommandRunner { Task<CommandResult> Run(string file, IEnumerable<string> args, int timeoutSeconds = 20, IReadOnlyDictionary<string, string>? env = null); }
public sealed class CommandRunner : ICommandRunner
{
    public async Task<CommandResult> Run(string file, IEnumerable<string> args, int timeoutSeconds = 20, IReadOnlyDictionary<string, string>? env = null)
    {
        var info = new ProcessStartInfo(file) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true,
            RedirectStandardOutput = true, RedirectStandardError = true, StandardOutputEncoding = Encoding.UTF8, StandardErrorEncoding = Encoding.UTF8 };
        foreach (string arg in args) info.ArgumentList.Add(arg);
        if (env != null) foreach (var pair in env) info.Environment[pair.Key] = pair.Value;
        using var process = Process.Start(info) ?? throw new InvalidOperationException("无法启动系统命令。");
        process.StandardInput.Close();
        var stdout = process.StandardOutput.ReadToEndAsync(); var stderr = process.StandardError.ReadToEndAsync();
        using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));
        try { await process.WaitForExitAsync(cancel.Token); }
        catch (OperationCanceledException) { try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { } await process.WaitForExitAsync(); throw new TimeoutException($"{Path.GetFileName(file)} 超时（{timeoutSeconds}s），已终止进程树。"); }
        return new(process.ExitCode, (await stdout).Trim(), (await stderr).Trim());
    }
}
public sealed record Paths(string Home, string Data)
{
    public string SshDir => Path.Combine(Home, ".ssh");
    public string Config => Path.Combine(SshDir, "config");
    public string KnownHosts => Path.Combine(SshDir, "known_hosts");
    public string DefaultKey => Path.Combine(SshDir, "id_ed25519_ssh_link");
    public static Paths Current => new(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "WindowsSshLink"));
}
public static class Files
{
    public static readonly UTF8Encoding Utf8 = new(false, true);
    public static void NoLinks(string path)
    {
        for (string? p = Path.GetFullPath(path); p != null; p = Path.GetDirectoryName(p))
            if ((File.Exists(p) || Directory.Exists(p)) && (File.GetAttributes(p) & FileAttributes.ReparsePoint) != 0) throw new IOException($"拒绝修改符号链接/联接：{p}");
    }
    public static void AtomicWrite(string path, string content)
    {
        path = Path.GetFullPath(path); NoLinks(path); Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        string temp = path + ".ssh-link-" + Guid.NewGuid().ToString("N");
        try
        {
            File.WriteAllText(temp, content, Utf8);
            if (File.Exists(path)) { File.Replace(temp, path, null); } else File.Move(temp, path);
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
    public static void CreateNew(string path, string text)
    {
        NoLinks(path);
        using var stream = new FileStream(path, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        var bytes = Utf8.GetBytes(text); stream.Write(bytes);
    }
}
public static class Permissions
{
    public static string Me => WindowsIdentity.GetCurrent().User!.Value;
    public const string Admin = "S-1-5-32-544", System = "S-1-5-18";
    public static bool Elevated => new WindowsPrincipal(WindowsIdentity.GetCurrent()).IsInRole(WindowsBuiltInRole.Administrator);
    public static void RequireAdmin() { if (!Elevated) throw new UnauthorizedAccessException("请在这台电脑的管理员终端执行相同命令；不会自动跨账号提权。"); }
    public static string Sddl(string path) => new FileInfo(path).GetAccessControl(AccessControlSections.Owner | AccessControlSections.Group | AccessControlSections.Access).GetSecurityDescriptorSddlForm(AccessControlSections.Owner | AccessControlSections.Group | AccessControlSections.Access);
    public static void Restore(string path, string sddl)
    {
        var current = new FileInfo(path).GetAccessControl(); var wanted = new FileSecurity();
        wanted.SetSecurityDescriptorSddlForm(sddl);
        var acl = new FileSecurity(); acl.SetSecurityDescriptorSddlForm(sddl, AccessControlSections.Access);
        var owner = wanted.GetOwner(typeof(SecurityIdentifier)); var group = wanted.GetGroup(typeof(SecurityIdentifier));
        if (owner != null && owner.Value != current.GetOwner(typeof(SecurityIdentifier))?.Value) acl.SetOwner(owner);
        if (group != null && group.Value != current.GetGroup(typeof(SecurityIdentifier))?.Value) acl.SetGroup(group);
        new FileInfo(path).SetAccessControl(acl);
    }
    public static List<string> Issues(string path, string[] allowed, string[] required)
    {
        var acl = new FileInfo(path).GetAccessControl(); List<string> issues = [];
        if (!allowed.Contains(acl.GetOwner(typeof(SecurityIdentifier))?.Value ?? "")) issues.Add("所有者不符合预期");
        var rules = acl.GetAccessRules(true, true, typeof(SecurityIdentifier)).Cast<FileSystemAccessRule>().ToArray();
        foreach (var rule in rules)
            if (!allowed.Contains(rule.IdentityReference.Value) || rule.AccessControlType == AccessControlType.Deny) issues.Add("额外或拒绝 ACL：" + rule.IdentityReference.Value);
        foreach (string sid in required)
            if (!rules.Any(r => r.IdentityReference.Value == sid && r.AccessControlType == AccessControlType.Allow && (r.FileSystemRights & FileSystemRights.FullControl) == FileSystemRights.FullControl)) issues.Add("缺少完全控制：" + sid);
        return issues;
    }
    public static void Set(string path, string owner, string[] fullAccess)
    {
        Files.NoLinks(path);
        var acl = new FileSecurity();
        if (new FileInfo(path).GetAccessControl().GetOwner(typeof(SecurityIdentifier))?.Value != owner) acl.SetOwner(new SecurityIdentifier(owner));
        acl.SetAccessRuleProtection(true, false);
        foreach (string sid in fullAccess) acl.AddAccessRule(new FileSystemAccessRule(new SecurityIdentifier(sid), FileSystemRights.FullControl, AccessControlType.Allow));
        new FileInfo(path).SetAccessControl(acl);
        var issues = Issues(path, fullAccess, fullAccess); if (issues.Count != 0) throw new IOException("ACL 复核失败：" + string.Join("；", issues));
    }
}
public static class Network
{
    public static string[] LocalIps() => NetworkInterface.GetAllNetworkInterfaces().SelectMany(n => n.GetIPProperties().UnicastAddresses)
        .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(a.Address)).Select(a => a.Address.ToString()).Distinct().ToArray();
    public static bool IsV4(string ip) => System.Text.RegularExpressions.Regex.IsMatch(ip, @"^\d{1,3}(\.\d{1,3}){3}$") && IPAddress.TryParse(ip, out var a) && a.AddressFamily == AddressFamily.InterNetwork;
    public static async Task<(bool Ok, string Detail)> Tcp(string ip, int port)
    {
        using var client = new TcpClient(); using var cancel = new CancellationTokenSource(TimeSpan.FromSeconds(4));
        try { await client.ConnectAsync(ip, port, cancel.Token); return (true, "TCP 已连通；尚未证明 SSH 认证成功。"); }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException) { return (false, ex is OperationCanceledException ? "TCP 超时。" : ex.Message); }
    }
}
public static class Tools
{
    public static string Find(string name)
    {
        string[] dirs = [Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "System32", "OpenSSH"), Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "OpenSSH")];
        foreach (string d in dirs.Concat((Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator)))
        { string candidate = Path.Combine(d.Trim('"'), name + ".exe"); if (File.Exists(candidate)) return candidate; }
        throw new FileNotFoundException($"找不到 {name}.exe，请检查系统 OpenSSH 安装。");
    }
}
