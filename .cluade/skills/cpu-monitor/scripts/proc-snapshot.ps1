# proc-snapshot.ps1 — 一次性快照:枚举所有进程的 CPU 时间
#
# 通过 P/Invoke 直接调 Win32 API(EnumProcesses + GetProcessTimes),
# 完全不经过 WMI Provider Service,因此不会拉高 WmiPrvSE。
# 这是 bottom(btm)的 sysinfo crate 在 Windows 上的同款实现路径。
#
# 输出(stdout,UTF-8,CSV):每行 "pid,kernel100ns,user100ns"
#   kernel100ns/user100ns 是 100 纳秒为单位的累计 CPU 时间(含 K+U 即进程总 CPU)
#
# 非管理员:用 PROCESS_QUERY_LIMITED_INFORMATION(0x1000),能拿到大多数进程;
#           系统/受保护进程会失败被跳过(正常现象)。
# 管理员:  能拿到全部进程。

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

$sig = @'
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool GetProcessTimes(IntPtr h, out long creation, out long exit, out long kernel, out long user);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern IntPtr OpenProcess(int access, bool inherit, int pid);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool CloseHandle(IntPtr h);
[DllImport("psapi.dll", SetLastError=true)]
public static extern bool EnumProcesses([MarshalAs(UnmanagedType.LPArray)] int[] pids, int cb, out int bytesReturned);
[DllImport("kernel32.dll")]
public static extern long GetTickCount64();
'@

if (-not ('W32.PT' -as [type])) {
    Add-Type -MemberDefinition $sig -Name 'PT' -Namespace 'W32'
}

# 取枚举时刻的 wall-clock(毫秒),用于跨进程求差时统一时间基准
$wallMs = [W32.PT]::GetTickCount64()

$pids = New-Object int[] 8192
$bytesBack = 0
$null = [W32.PT]::EnumProcesses($pids, $pids.Length * 4, [ref]$bytesBack)
$count = $bytesBack / 4

# 第一行输出元数据,后续行是进程数据
Write-Output ("#wallMs=$wallMs,count=$count")

for ($i = 0; $i -lt $count; $i++) {
    $p = $pids[$i]
    if ($p -eq 0) { continue }
    $h = [W32.PT]::OpenProcess(0x1000, $false, $p)
    if ($h -eq [IntPtr]::Zero) { continue }
    try {
        $c=0;$e=0;$k=0;$u=0
        if ([W32.PT]::GetProcessTimes($h, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) {
            Write-Output ("{0},{1},{2}" -f $p, $k, $u)
        }
    } finally {
        $null = [W32.PT]::CloseHandle($h)
    }
}
