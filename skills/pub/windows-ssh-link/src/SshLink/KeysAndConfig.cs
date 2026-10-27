using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace SshLink;

public sealed record PublicKey(string Line, string Type, string Blob, string Fingerprint)
{
    public static PublicKey Parse(string text)
    {
        string line = text.Trim();
        if (line.Contains("PRIVATE KEY", StringComparison.Ordinal) || line.IndexOfAny(['\r', '\n']) >= 0) throw new InvalidDataException("只接受完整单行 .pub 公钥，不能是私钥或多行。");
        var m = Regex.Match(line, @"^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp(?:256|384|521))\s+([A-Za-z0-9+/]+={0,2})(?:\s+[^\r\n]*)?$");
        if (!m.Success) throw new InvalidDataException("不支持或无效的公钥格式。");
        byte[] bytes = Convert.FromBase64String(m.Groups[2].Value);
        if (bytes.Length < 8) throw new InvalidDataException("公钥过短。");
        uint size = BinaryPrimitives.ReadUInt32BigEndian(bytes);
        if (size > 80 || size + 4 >= bytes.Length || Encoding.ASCII.GetString(bytes, 4, (int)size) != m.Groups[1].Value) throw new InvalidDataException("公钥类型与内容不一致。");
        return new(line, m.Groups[1].Value, m.Groups[2].Value, "SHA256:" + Convert.ToBase64String(SHA256.HashData(bytes)).TrimEnd('='));
    }
    public static string Merge(string existing, PublicKey key)
    {
        // Preserve options such as from= or command= on existing matching key.
        string pattern = @"(?:^|\s)" + Regex.Escape(key.Type) + @"\s+" + Regex.Escape(key.Blob) + @"(?:\s|$)";
        if (existing.Split('\n').Any(l => !l.TrimStart().StartsWith('#') && Regex.IsMatch(l, pattern))) return existing;
        return existing.TrimEnd('\r', '\n') + (string.IsNullOrWhiteSpace(existing) ? "" : "\r\n") + key.Line + "\r\n";
    }
    public async Task Validate(ICommandRunner runner)
    {
        string temp = Path.Combine(Path.GetTempPath(), "ssh-link-key-" + Guid.NewGuid().ToString("N"));
        try
        {
            Files.CreateNew(temp, Line + "\n");
            var result = await runner.Run(Tools.Find("ssh-keygen"), ["-lf", temp, "-E", "sha256"]);
            result.RequireSuccess("OpenSSH 公钥校验");
            if (!result.Stdout.Contains(Fingerprint, StringComparison.Ordinal)) throw new InvalidDataException("OpenSSH 指纹不一致。");
        }
        finally { if (File.Exists(temp)) File.Delete(temp); }
    }
}
public static class Config
{
    public static void Validate(Target t)
    {
        if (!Network.IsV4(t.Ip)) throw new ArgumentException("目标必须为单一有效 IPv4。");
        if (!Regex.IsMatch(t.Alias, @"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,62}$")) throw new ArgumentException("别名仅支持字母、数字、下划线和短横线。");
        if (!Regex.IsMatch(t.User, @"^[\p{L}\p{N}_.@\\-]+$")) throw new ArgumentException("目标用户名包含不支持字符。");
        if (t.Port < 1 || t.Port > 65535) throw new ArgumentException("端口范围 1–65535。");
    }
    public static Target Load(string path)
    {
        if (new FileInfo(path).Length > 1024 * 1024) throw new InvalidDataException("目标文件过大。");
        var t = Json.Read<Target>(path);
        if (t.Format is not ("WindowsSshLinkTarget" or "WindowsSshWizardTarget") || t.Version != 1) throw new InvalidDataException("目标文件格式不支持。");
        Validate(t);
        if (t.HostKeys.Count is < 1 or > 10) throw new InvalidDataException("主机密钥数量异常。");
        foreach (var key in t.HostKeys) if (PublicKey.Parse(key.Line).Fingerprint != key.Fingerprint) throw new InvalidDataException("目标文件公钥/指纹不一致。");
        return t;
    }
    public static string Client(string existing, Target t, string key)
    {
        Validate(t);
        if (key.IndexOfAny(['\r', '\n', '"', '\0']) >= 0) throw new ArgumentException("私钥路径含非法字符。");
        string tag = "WINDOWS-SSH-LINK " + t.Alias.ToLowerInvariant();
        string pattern = @"(?ms)^# BEGIN " + Regex.Escape(tag) + @"\r?\n.*?^# END " + Regex.Escape(tag) + @"\r?\n?";
        if (Regex.Matches(existing, pattern).Count > 1) throw new InvalidDataException("重复受管区块。");
        string clean = Regex.Replace(existing, pattern, "");
        foreach (string line in clean.Split('\n'))
        {
            var m = Regex.Match(line, @"^\s*Host\s+(.+)$", RegexOptions.IgnoreCase);
            if (m.Success && Regex.Split(m.Groups[1].Value.Trim(), @"\s+").Any(s => s.Trim('"').Equals(t.Alias, StringComparison.OrdinalIgnoreCase))) throw new InvalidDataException("别名已由其他配置管理；换唯一别名或人工合并，不覆盖。");
        }
        return $"# BEGIN {tag}\r\nHost {t.Alias}\r\n    HostName {t.Ip}\r\n    User {t.User.Replace("\\", "\\\\")}\r\n    Port {t.Port}\r\n    IdentityFile \"{key.Replace('\\', '/')}\"\r\n    IdentitiesOnly yes\r\n    ServerAliveInterval 30\r\n    ServerAliveCountMax 3\r\nHost *\r\n# END {tag}\r\n" + clean;
    }
    public static string Server(string existing, int port)
    {
        string clean = Regex.Replace(existing, @"(?ms)^# BEGIN WINDOWS-SSH-(?:LINK|WIZARD)\r?\n.*?^# END WINDOWS-SSH-(?:LINK|WIZARD)\r?\n?", "");
        bool match = false; List<string> lines = [];
        foreach (string line in Regex.Split(clean, "\r?\n"))
        {
            if (Regex.IsMatch(line, @"^\s*Match\s", RegexOptions.IgnoreCase)) match = true;
            lines.Add(!match && Regex.IsMatch(line, @"^\s*(Port|PubkeyAuthentication)\s", RegexOptions.IgnoreCase) ? "# ssh-link previous: " + line : line);
        }
        return $"# BEGIN WINDOWS-SSH-LINK\r\nPort {port}\r\nPubkeyAuthentication yes\r\n# END WINDOWS-SSH-LINK\r\n" + string.Join("\r\n", lines);
    }
    public static Dictionary<string, string> Map(string text) => Regex.Split(text, "\r?\n").Where(l => l.Contains(' '))
        .GroupBy(l => l[..l.IndexOf(' ')], StringComparer.OrdinalIgnoreCase).ToDictionary(g => g.Key, g => g.First()[(g.First().IndexOf(' ') + 1)..], StringComparer.OrdinalIgnoreCase);
    public static void Match(Dictionary<string, string> map, Target t)
    {
        if (map.GetValueOrDefault("hostname") != t.Ip || !string.Equals(map.GetValueOrDefault("user"), t.User, StringComparison.OrdinalIgnoreCase) || map.GetValueOrDefault("port") != t.Port.ToString(System.Globalization.CultureInfo.InvariantCulture)) throw new InvalidDataException("ssh -G 实际地址/账号/端口与目标不同；先核对 config/Include/Match。");
    }
}
