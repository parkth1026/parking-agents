using System.Text;

namespace SshLink;

public static class Program
{
    const string Help = """
        ssh-link 2.0 — Windows SSH 单连接工具（C# 核心）
        ssh-link <connect|accept> <action> [options]

        connect check                         检查本机客户端/密钥 ACL
        connect keygen --no-passphrase         计划创建专用无口令密钥
        connect agent                         计划启用 agent；用户自行 ssh-add
        accept check --peer-ip IP --user NAME  检查本机服务与目标账号
        accept setup --peer-ip IP --user NAME --public-key-file controller.pub
        accept export --peer-ip IP --user NAME --local-ip IP --alias NAME --out-file target.json
        connect trust --target-file target.json --fingerprint SHA256:完整指纹
        connect setup --target-file target.json
        connect test --target-file target.json [--check-codex]
        <role> restore --manifest <本机备份manifest.json>

        --apply             执行变更；setup/trust/keygen/agent/restore 默认仅计划
        --key-path PATH     发起端私钥；默认当前用户 .ssh/id_ed25519_ssh_link
        --port 22           接受端监听端口；发起端从目标 JSON 读取
        --json              结构化输出，SchemaVersion=2
        --report-file PATH  新建诊断报告，不覆盖已有文件
        --help / --version

        accept 在被连接电脑运行，--user 是该电脑的本地账号。
        connect 在发起端运行。每次一个目标，私钥不传出，主机校验不关闭。
        退出码：0=无FAIL；1=失败；2=仅计划，未执行。WARN/UNKNOWN 仍需核实。
        此 EXE 不需要附带 PS1 或预装 .NET；少数系统防火墙操作调用系统 PowerShell。
        """;
    public static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = new UTF8Encoding(false);
        if (args.Length == 0 || args is ["--help"] or ["help"]) { Console.WriteLine(Help); return 0; }
        if (args is ["--version"]) { Console.WriteLine("ssh-link 2.0.0"); return 0; }
        Report report = new(); Options? options = null;
        try
        {
            options = Options.Parse(args);
            if (!OperatingSystem.IsWindows() || !Environment.Is64BitProcess) throw new PlatformNotSupportedException("需要 64 位 Windows。");
            if (options.Has("report-file"))
            {
                string path = Path.GetFullPath(options.Get("report-file")); Files.NoLinks(path);
                if (File.Exists(path)) throw new IOException("报告文件已存在，不覆盖；请选择新文件名。");
                if (!Directory.Exists(Path.GetDirectoryName(path))) throw new DirectoryNotFoundException("报告父目录不存在。");
            }
            var runner = new CommandRunner(); var engine = new Engine(Paths.Current, runner, new WindowsHost(runner)); report = engine.Report;
            try { await engine.Execute(options); }
            catch (Exception ex) { report.Add("操作错误", "FAIL", ex.Message, "按首个失败层级处理；详见 Skill 的 troubleshooting.md。若已开始变更，核对 Backup 和回退结果。"); }
        }
        catch (Exception ex) { report.Add("参数/环境错误", "FAIL", ex.Message); }
        if (options?.Has("report-file") == true)
        {
            try { Files.CreateNew(options.Get("report-file"), Json.Encode(report)); }
            catch (Exception ex) { report.Add("保存报告", "FAIL", ex.Message); }
        }
        if (args.Contains("--json", StringComparer.Ordinal)) Console.WriteLine(Json.Encode(report));
        else
        {
            Console.WriteLine($"{report.Machine} / {report.User} / {report.Role} {report.Action}");
            foreach (var row in report.Rows) { Console.WriteLine($"[{row.State}] {row.Stage}：{row.Detail}"); if (row.Remedy != null) Console.WriteLine("  建议：" + row.Remedy); }
            if (report.Backup != null) Console.WriteLine("备份：" + report.Backup);
            if (report.Meta.TryGetValue("PublicKey", out var pub)) Console.WriteLine("仅把此公钥交给目标端：" + pub);
            if (report.Meta.TryGetValue("ExportFile", out var path)) Console.WriteLine("目标信息：" + path);
        }
        return !report.Success ? 1 : report.Rows.Any(r => r.State == "PLAN") ? 2 : 0;
    }
}
