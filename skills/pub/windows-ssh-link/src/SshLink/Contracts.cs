using System.Text.Json;
using System.Text.Json.Serialization;

namespace SshLink;

public record Finding(string Stage, string State, string Detail, string? Remedy = null);
public sealed class Report
{
    public int SchemaVersion { get; set; } = 2;
    public string Version { get; set; } = "2.0.0";
    public string Role { get; set; } = "";
    public string Action { get; set; } = "";
    public string Machine { get; set; } = Environment.MachineName;
    public string User { get; set; } = System.Security.Principal.WindowsIdentity.GetCurrent().Name;
    public DateTimeOffset Time { get; set; } = DateTimeOffset.Now;
    public bool Executed { get; set; }
    public bool Success => Rows.All(r => r.State != "FAIL");
    public string? Backup { get; set; }
    public List<Finding> Rows { get; set; } = [];
    public Dictionary<string, object> Meta { get; set; } = [];
    public void Add(string stage, string state, string detail, string? remedy = null) => Rows.Add(new(stage, state, detail, remedy));
}
public sealed record HostKey(string Line, string Fingerprint);
public sealed class Target
{
    public string Format { get; set; } = "WindowsSshLinkTarget";
    public int Version { get; set; } = 1;
    public string Computer { get; set; } = "";
    public string Alias { get; set; } = "";
    public string Ip { get; set; } = "";
    public int Port { get; set; } = 22;
    public string User { get; set; } = "";
    public List<HostKey> HostKeys { get; set; } = [];
    public DateTimeOffset Created { get; set; } = DateTimeOffset.Now;
    public string HostId => Port == 22 ? Ip : $"[{Ip}]:{Port}";
}
public static class Json
{
    public static readonly JsonSerializerOptions Options = new() { WriteIndented = true, PropertyNameCaseInsensitive = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.Create(System.Text.Unicode.UnicodeRanges.All),
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull };
    public static string Encode<T>(T value) => JsonSerializer.Serialize(value, Options);
    public static T Read<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllText(path), Options) ?? throw new InvalidDataException("JSON 为空。");
}
public sealed class Options
{
    public string Role { get; private set; } = "";
    public string Action { get; private set; } = "";
    readonly Dictionary<string, string> values = new(StringComparer.Ordinal);
    static readonly HashSet<string> Flags = ["apply", "json", "no-passphrase", "check-codex"];
    static readonly HashSet<string> Values = ["peer-ip", "local-ip", "user", "alias", "port", "key-path", "public-key-file", "target-file", "fingerprint", "out-file", "manifest", "report-file"];
    public static IEnumerable<string> AllNames => Flags.Concat(Values);
    public bool Has(string key) => values.ContainsKey(key);
    public string Get(string key, string fallback = "") => values.GetValueOrDefault(key, fallback);
    public string Need(string key) => Has(key) && Get(key).Length > 0 ? Get(key) : throw new ArgumentException($"需要 --{key}。");
    public static Options Parse(string[] args)
    {
        if (args.Length < 2 || args[0] is not ("connect" or "accept")) throw new ArgumentException("用法：ssh-link <connect|accept> <action>，查看 --help。");
        if (args[1] is not ("check" or "setup" or "export" or "trust" or "test" or "keygen" or "agent" or "restore")) throw new ArgumentException("未知 action。");
        var o = new Options { Role = args[0], Action = args[1] };
        for (int i = 2; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal)) throw new ArgumentException("未知位置参数。");
            string key = args[i][2..];
            if (o.Has(key)) throw new ArgumentException($"重复选项 --{key}。");
            if (Flags.Contains(key)) o.values.Add(key, "true");
            else if (Values.Contains(key) && ++i < args.Length && !args[i].StartsWith("--", StringComparison.Ordinal))
            {
                if (args[i].IndexOfAny(['\r', '\n', '\0']) >= 0) throw new ArgumentException("参数不能包含换行或 NUL。");
                o.values.Add(key, args[i]);
            }
            else throw new ArgumentException($"未知选项或缺值：--{key}。");
        }
        return o;
    }
}
