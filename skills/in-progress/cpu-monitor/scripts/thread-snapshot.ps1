# thread-snapshot.ps1 — 一次性快照:枚举所有线程的 CPU 时间
#
# 通过 P/Invoke 直接调 Win32 API(CreateToolhelp32Snapshot + GetThreadTimes),
# 完全不经过 WMI Provider Service,不会拉高 WmiPrvSE。
#
# 输出(stdout,UTF-8,CSV):
#   第一行: #wallMs=<毫秒>,count=<总线程数>
#   后续每行: tid,ownerPid,kernel100ns,user100ns
#
# 非管理员用 THREAD_QUERY_LIMITED_INFORMATION(0x0400) 能开大多数线程;
# 受保护线程会失败被跳过(正常现象)。

[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$ErrorActionPreference = 'Stop'

$sig = @'
[StructLayout(LayoutKind.Sequential, Size=28)]
public struct Te32 {
    public uint Size;
    public int Usage;
    public uint Tid;
    public uint OwnerPid;
    public int BasePri;
    public int DeltaPri;
}
[DllImport("kernel32.dll", SetLastError=true)]
public static extern IntPtr CreateToolhelp32Snapshot(uint flags, uint pid);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool Thread32First(IntPtr h, ref Te32 t);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool Thread32Next(IntPtr h, ref Te32 t);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool GetThreadTimes(IntPtr h, out long creation, out long exit, out long kernel, out long user);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern IntPtr OpenThread(int access, bool inherit, int tid);
[DllImport("kernel32.dll", SetLastError=true)]
public static extern bool CloseHandle(IntPtr h);
[DllImport("kernel32.dll")]
public static extern long GetTickCount64();
'@

if (-not ('W32T.TL' -as [type])) {
    Add-Type -MemberDefinition $sig -Name 'TL' -Namespace 'W32T'
}

$wallMs = [W32T.TL]::GetTickCount64()

# 先拿 PID -> 进程名映射(用 Get-Process,快速,只拿 Name)
$pid2name = @{}
try {
    Get-Process -ErrorAction SilentlyContinue | ForEach-Object { $pid2name[[int]$_.Id] = $_.Name }
} catch {}

# TH32CS_SNAPTHREAD = 0x4
$h = [W32T.TL]::CreateToolhelp32Snapshot(0x4, 0)
if ($h -eq [IntPtr]::Zero) {
    Write-Error "CreateToolhelp32Snapshot 失败"; exit 1
}

$t = New-Object W32T.TL+Te32
$t.Size = 28
$ok = [W32T.TL]::Thread32First($h, [ref]$t)

$totalCount = 0
$sampled = 0
# 先收集所有线程信息(快速),然后输出
$all = New-Object System.Collections.Generic.List[object]
while ($ok) {
    $totalCount++
    $tid = [int]$t.Tid
    $ownerPid = [int]$t.OwnerPid
    if ($tid -ne 0) {
        $th = [W32T.TL]::OpenThread(0x0040, $false, $tid)  # THREAD_QUERY_INFORMATION
        if ($th -ne [IntPtr]::Zero) {
            try {
                $c=0;$e=0;$k=0;$u=0
                if ([W32T.TL]::GetThreadTimes($th, [ref]$c, [ref]$e, [ref]$k, [ref]$u)) {
                    $pname = $pid2name[$ownerPid]
                    if (-not $pname) { $pname = '' }
                    $all.Add([pscustomobject]@{ Tid=$tid; Pid=$ownerPid; Name=$pname; K=$k; U=$u })
                    $sampled++
                }
            } finally {
                $null = [W32T.TL]::CloseHandle($th)
            }
        }
    }
    $ok = [W32T.TL]::Thread32Next($h, [ref]$t)
}
$null = [W32T.TL]::CloseHandle($h)

# 输出元数据行
Write-Output ("#wallMs={0},count={1},sampled={2}" -f $wallMs, $totalCount, $sampled)
# 输出线程数据: tid,pid,name,kernel100ns,user100ns
foreach ($x in $all) {
    Write-Output ("{0},{1},{2},{3},{4}" -f $x.Tid, $x.Pid, $x.Name, $x.K, $x.U)
}
