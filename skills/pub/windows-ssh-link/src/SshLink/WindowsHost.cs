using Microsoft.Win32;
using Microsoft.Win32.SafeHandles;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Text.RegularExpressions;
using System.Text;
using System.Text.Json;

namespace SshLink;

public sealed record ServiceInfo(string Exe, string Config, uint State, uint Pid, uint StartType);
public sealed record LocalAccount(string Name, string Sid, bool Admin, string? Profile);
internal sealed class ServiceHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    private ServiceHandle() : base(true) { }
    protected override bool ReleaseHandle() => Native.CloseServiceHandle(handle);
}
internal static class Native
{
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] internal static extern ServiceHandle OpenSCManager(string? machine, string? database, uint access);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] internal static extern ServiceHandle OpenService(ServiceHandle manager, string name, uint access);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool CloseServiceHandle(IntPtr handle);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool QueryServiceStatusEx(ServiceHandle service, int info, out Status status, int size, out int needed);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool StartService(ServiceHandle service, int count, IntPtr args);
    [DllImport("advapi32.dll", SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool ControlService(ServiceHandle service, uint control, out Status status);
    [DllImport("advapi32.dll", CharSet = CharSet.Unicode, SetLastError = true)] [return: MarshalAs(UnmanagedType.Bool)] internal static extern bool ChangeServiceConfig(ServiceHandle service, uint type, uint start, uint error, string? binary, string? group, IntPtr tag, string? dependencies, string? user, string? password, string? display);
    [StructLayout(LayoutKind.Sequential)] internal struct Status { public uint Type, State, Controls, ExitCode, SpecificExit, CheckPoint, WaitHint, Pid, Flags; }
    [DllImport("Netapi32.dll", CharSet = CharSet.Unicode)] internal static extern int NetUserGetInfo(string? server, string user, int level, out IntPtr buffer);
    [DllImport("Netapi32.dll", CharSet = CharSet.Unicode)] internal static extern int NetUserGetLocalGroups(string? server, string user, int level, int flags, out IntPtr buffer, int preferred, out int read, out int total);
    [DllImport("Netapi32.dll")] internal static extern int NetApiBufferFree(IntPtr buffer);
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] internal struct User23 { public IntPtr Name, FullName, Comment; public uint Flags; public IntPtr Sid; }
    [DllImport("iphlpapi.dll")] internal static extern uint GetExtendedTcpTable(IntPtr table, ref int size, [MarshalAs(UnmanagedType.Bool)] bool order, int family, int tableClass, uint reserved);
}
public interface IWindowsHost
{
    void RequireAdmin();
    ServiceInfo? Service();
    LocalAccount Account(string user);
    Task Start(bool restart, bool automatic);
    bool Listens(ServiceInfo service, int port);
    Task Install();
    Task<bool> EnsureRule(string name, string ip, int port);
    Task RemoveRule(string name);
    Task<string> FirewallSummary();
}
public sealed class WindowsHost(ICommandRunner runner) : IWindowsHost
{
    public void RequireAdmin() => Permissions.RequireAdmin();
    static ServiceHandle Manager()
    {
        var h = Native.OpenSCManager(null, null, 1); if (h.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error()); return h;
    }
    static ServiceHandle Open(ServiceHandle manager, uint access)
    {
        var h = Native.OpenService(manager, "sshd", access); if (h.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error()); return h;
    }
    public ServiceInfo? Service()
    {
        using var reg = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Services\sshd"); if (reg == null) return null;
        string image = Environment.ExpandEnvironmentVariables((string?)reg.GetValue("ImagePath") ?? "");
        var m = Regex.Match(image, "^(?:\"([^\"]+)\"|(.+?\\.exe))(?:\\s|$)", RegexOptions.IgnoreCase);
        if (!m.Success) throw new InvalidDataException("无法解析 sshd ImagePath。");
        string exe = m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value;
        if (!Path.IsPathFullyQualified(exe) || !File.Exists(exe)) throw new FileNotFoundException("sshd 服务程序不存在。", exe);
        var f = Regex.Match(image, "(?:^|\\s)-f\\s+(?:\"([^\"]+)\"|(\\S+))");
        string config = f.Success ? (f.Groups[1].Success ? f.Groups[1].Value : f.Groups[2].Value) : Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "ssh", "sshd_config");
        if (!Path.IsPathFullyQualified(config)) throw new InvalidDataException("sshd 自定义配置必须是绝对路径。");
        using var manager = Manager(); using var service = Open(manager, 4);
        if (!Native.QueryServiceStatusEx(service, 0, out var status, Marshal.SizeOf<Native.Status>(), out _)) throw new Win32Exception(Marshal.GetLastWin32Error());
        return new(exe, config, status.State, status.Pid, Convert.ToUInt32(reg.GetValue("Start")));
    }
    public LocalAccount Account(string user)
    {
        string name = user;
        if (user.Contains('\\'))
        {
            string[] split = user.Split('\\'); if (split.Length != 2 || (split[0] != "." && !split[0].Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase))) throw new ArgumentException("自动配置仅支持本地 Windows 账号。"); name = split[1];
        }
        if (!Regex.IsMatch(name, @"^[\p{L}\p{N}_.-]+$")) throw new ArgumentException("本地用户名不支持。");
        int result = Native.NetUserGetInfo(null, name, 23, out var buffer);
        if (result != 0) throw new Win32Exception(result, "无法读取本地账号。");
        string sid;
        try { var u = Marshal.PtrToStructure<Native.User23>(buffer); if ((u.Flags & 2) != 0) throw new InvalidDataException("目标账号已禁用。"); sid = new SecurityIdentifier(u.Sid).Value; name = Marshal.PtrToStringUni(u.Name)!; }
        finally { Native.NetApiBufferFree(buffer); }
        result = Native.NetUserGetLocalGroups(null, name, 0, 0, out buffer, -1, out int read, out _);
        if (result != 0) throw new Win32Exception(result, "无法判断本地管理员组成员资格。");
        bool admin = false;
        string adminGroup = ((NTAccount)new SecurityIdentifier(Permissions.Admin).Translate(typeof(NTAccount))).Value.Split('\\')[^1];
        try
        {
            for (int i = 0; i < read; i++)
            {
                string group = Marshal.PtrToStringUni(Marshal.ReadIntPtr(buffer, i * IntPtr.Size))!;
                // Built-in groups belong to BUILTIN, not the machine's account
                // domain; comparing the localized name resolved from its SID
                // also avoids translating unrelated/orphaned group names.
                if (group.Equals(adminGroup, StringComparison.OrdinalIgnoreCase)) admin = true;
            }
        }
        finally { Native.NetApiBufferFree(buffer); }
        using var profileKey = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList\" + sid);
        string? profile = profileKey?.GetValue("ProfileImagePath") as string; if (profile != null) profile = Environment.ExpandEnvironmentVariables(profile);
        if (!admin && (profile == null || !Directory.Exists(profile))) throw new InvalidDataException("普通账号无真实 profile；请先在本机用该账号登录一次。");
        return new(name, sid, admin, profile);
    }
    public async Task Start(bool restart, bool automatic)
    {
        Permissions.RequireAdmin(); using var manager = Manager(); using var service = Open(manager, 4 | 16 | 32 | 2);
        if (automatic && !Native.ChangeServiceConfig(service, uint.MaxValue, 2, uint.MaxValue, null, null, IntPtr.Zero, null, null, null, null)) throw new Win32Exception(Marshal.GetLastWin32Error());
        var current = Service()!;
        if (restart && current.State != 1)
        {
            if (!Native.ControlService(service, 1, out _) && Marshal.GetLastWin32Error() != 1062) throw new Win32Exception(Marshal.GetLastWin32Error());
            await WaitState(1);
        }
        if (Service()!.State != 4)
        {
            if (!Native.StartService(service, 0, IntPtr.Zero) && Marshal.GetLastWin32Error() != 1056) throw new Win32Exception(Marshal.GetLastWin32Error());
            await WaitState(4);
        }
    }
    async Task WaitState(uint wanted)
    {
        var deadline = DateTime.UtcNow.AddSeconds(25);
        while (Service()!.State != wanted) { if (DateTime.UtcNow > deadline) throw new TimeoutException("sshd 状态转换超时。"); await Task.Delay(250); }
    }
    public bool Listens(ServiceInfo service, int port)
    {
        // IPv4 target requires an actual IPv4 listener owned by this service.
        int size = 0; uint code = Native.GetExtendedTcpTable(IntPtr.Zero, ref size, false, 2, 3, 0);
        if (code != 122 && code != 0) throw new Win32Exception((int)code);
        IntPtr table = Marshal.AllocHGlobal(size);
        try
        {
            code = Native.GetExtendedTcpTable(table, ref size, false, 2, 3, 0); if (code != 0) throw new Win32Exception((int)code);
            int count = Marshal.ReadInt32(table);
            for (int i = 0; i < count; i++)
            {
                IntPtr row = IntPtr.Add(table, 4 + i * 24);
                uint addr = unchecked((uint)Marshal.ReadInt32(row, 4)); int rawPort = Marshal.ReadInt32(row, 8);
                int localPort = ((rawPort & 255) << 8) | ((rawPort >> 8) & 255);
                uint pid = unchecked((uint)Marshal.ReadInt32(row, 20));
                if (localPort == port && pid == service.Pid && (addr & 255) != 127 && service.State == 4) return true;
            }
            return false;
        }
        finally { Marshal.FreeHGlobal(table); }
    }
    public async Task Install()
    {
        Permissions.RequireAdmin();
        try { _ = Tools.Find("sshd"); throw new InvalidOperationException("已有独立版 sshd 但没有服务；先用对应安装包注册服务，避免叠装。"); } catch (FileNotFoundException) { }
        var result = await runner.Run(Path.Combine(Environment.SystemDirectory, "dism.exe"), ["/Online", "/Add-Capability", "/CapabilityName:OpenSSH.Server~~~~0.0.1.0", "/NoRestart"], 600);
        if (result.ExitCode == 3010) throw new InvalidOperationException("Windows 功能安装需要重启，请重启后重跑；文件回退不会卸载该功能。");
        result.RequireSuccess("OpenSSH Server 安装");
    }
    // Narrow system adapter: only firewall operations use fixed PowerShell code.
    // Input is JSON in a child environment variable, never interpolated as code.
    async Task<JsonElement> Firewall(string operation, string name = "", string ip = "", int port = 0)
    {
        const string script = """
            $ErrorActionPreference='Stop';$ProgressPreference='SilentlyContinue';[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false)
            try {
              $p=$env:SSH_LINK_FIREWALL_INPUT|ConvertFrom-Json
              switch($p.Operation) {
                'list' { $rules=@(Get-NetFirewallRule -PolicyStore ActiveStore -ErrorAction Stop|Where-Object {$_.Name -match 'SSH' -or $_.DisplayName -match 'SSH'}|Select-Object Name,Enabled,Direction,Action,Profile); @{Rules=$rules}|ConvertTo-Json -Depth 5 -Compress }
                'ensure' {
                  $r=Get-NetFirewallRule -Name $p.Name -ErrorAction SilentlyContinue
                  if($r){
                    $pf=$r|Get-NetFirewallPortFilter;$af=$r|Get-NetFirewallAddressFilter
                    if($r.Enabled -ne 'True' -or $r.Direction -ne 'Inbound' -or $r.Action -ne 'Allow' -or [string]$pf.LocalPort -ne [string]$p.Port -or [string]$pf.Protocol -notin @('TCP','6') -or @($af.RemoteAddress).Count -ne 1 -or [string]$af.RemoteAddress -notin @($p.Ip,($p.Ip+'/32'))){throw '同名规则与预期不同，拒绝覆盖。'}
                    @{Created=$false}|ConvertTo-Json -Compress
                  } else {
                    New-NetFirewallRule -Name $p.Name -DisplayName ('SSH Link from '+$p.Ip) -Enabled True -Direction Inbound -Action Allow -Protocol TCP -LocalPort $p.Port -RemoteAddress $p.Ip -Profile Any|Out-Null
                    @{Created=$true}|ConvertTo-Json -Compress
                  }
                }
                'remove' { Remove-NetFirewallRule -Name $p.Name -ErrorAction Stop; @{Removed=$true}|ConvertTo-Json -Compress }
                default {throw '未知防火墙操作。'}
              }
            } catch { [Console]::Error.WriteLine($_.Exception.Message);exit 1 }
            """;
        if (operation != "list" && !Regex.IsMatch(name, @"^WindowsSshLink-\d+-\d+-\d+-\d+-\d+$")) throw new ArgumentException("规则名不受本工具管理。");
        var result = await runner.Run(Path.Combine(Environment.SystemDirectory, "WindowsPowerShell", "v1.0", "powershell.exe"),
            ["-NoProfile", "-NonInteractive", "-EncodedCommand", Convert.ToBase64String(Encoding.Unicode.GetBytes(script))], 45,
            new Dictionary<string, string> { ["SSH_LINK_FIREWALL_INPUT"] = Json.Encode(new { Operation = operation, Name = name, Ip = ip, Port = port }) });
        result.RequireSuccess("防火墙操作");
        return JsonSerializer.Deserialize<JsonElement>(result.Stdout);
    }
    public async Task<bool> EnsureRule(string name, string ip, int port) => (await Firewall("ensure", name, ip, port)).GetProperty("Created").GetBoolean();
    public async Task RemoveRule(string name) => _ = await Firewall("remove", name);
    public async Task<string> FirewallSummary() => (await Firewall("list")).ToString();
}
