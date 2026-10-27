using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace SshLink;

public sealed record SavedFile(string Path, bool Existed, string Copy, string? Sddl, string? Sha256);
public sealed class Manifest
{
    public int Version { get; set; } = 2;
    public string Machine { get; set; } = Environment.MachineName;
    public string OperatorSid { get; set; } = Permissions.Me;
    public string Purpose { get; set; } = "";
    public List<SavedFile> Files { get; set; } = [];
    public List<string> CreatedRules { get; set; } = [];
    public List<string> Notes { get; set; } = [];
}
public sealed class Snapshot
{
    public string DirectoryPath { get; }
    public Manifest Manifest { get; }
    public Snapshot(Paths paths, string purpose)
    {
        DirectoryPath = Path.Combine(paths.Data, "backups", DateTime.Now.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N"));
        Files.NoLinks(DirectoryPath); Directory.CreateDirectory(DirectoryPath);
        // Backup contents must not inherit arbitrary read/write access from parent.
        var di = new DirectoryInfo(DirectoryPath); var acl = new System.Security.AccessControl.DirectorySecurity();
        if (System.IO.FileSystemAclExtensions.GetAccessControl(di).GetOwner(typeof(System.Security.Principal.SecurityIdentifier))?.Value != Permissions.Me)
            acl.SetOwner(new System.Security.Principal.SecurityIdentifier(Permissions.Me));
        acl.SetAccessRuleProtection(true, false);
        foreach (string sid in new[] { Permissions.Me, Permissions.Admin, Permissions.System })
            acl.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(new System.Security.Principal.SecurityIdentifier(sid), System.Security.AccessControl.FileSystemRights.FullControl,
                System.Security.AccessControl.InheritanceFlags.ContainerInherit | System.Security.AccessControl.InheritanceFlags.ObjectInherit, System.Security.AccessControl.PropagationFlags.None, System.Security.AccessControl.AccessControlType.Allow));
        System.IO.FileSystemAclExtensions.SetAccessControl(di, acl);
        Manifest = new Manifest { Purpose = purpose }; Save();
    }
    public void Save() => Files.AtomicWrite(Path.Combine(DirectoryPath, "manifest.json"), Json.Encode(Manifest));
    public void Track(string path)
    {
        path = Path.GetFullPath(path); Files.NoLinks(path);
        if (Manifest.Files.Any(f => f.Path.Equals(path, StringComparison.OrdinalIgnoreCase))) return;
        bool existed = File.Exists(path); string copy = Manifest.Files.Count + ".bin"; string? hash = null, sddl = null;
        if (existed)
        {
            sddl = Permissions.Sddl(path); byte[] bytes = File.ReadAllBytes(path);
            File.WriteAllBytes(Path.Combine(DirectoryPath, copy), bytes); hash = Convert.ToHexString(SHA256.HashData(bytes));
        }
        Manifest.Files.Add(new(path, existed, copy, sddl, hash)); Save();
    }
    public static void Validate(Manifest m, string dir)
    {
        if (m.Version != 2 || m.Machine != Environment.MachineName || m.OperatorSid != Permissions.Me) throw new InvalidDataException("备份版本、所属电脑或操作员不匹配。");
        foreach (var f in m.Files)
        {
            Files.NoLinks(f.Path);
            if (!Path.IsPathFullyQualified(f.Path)) throw new InvalidDataException("备份路径必须为绝对路径。");
            if (!Regex.IsMatch(f.Copy, @"^\d+\.bin$")) throw new InvalidDataException("备份条目无效。");
            string bin = Path.Combine(dir, f.Copy); Files.NoLinks(bin);
            if (f.Existed && (!File.Exists(bin) || Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(bin))) != f.Sha256)) throw new InvalidDataException("备份不完整或字节校验失败。");
            if (f.Existed && f.Sddl == null) throw new InvalidDataException("备份缺少 ACL。");
            if (f.Sddl != null) _ = new System.Security.AccessControl.RawSecurityDescriptor(f.Sddl);
        }
        if (m.Files.Select(f => Path.GetFullPath(f.Path)).Distinct(StringComparer.OrdinalIgnoreCase).Count() != m.Files.Count) throw new InvalidDataException("备份包含重复路径。");
    }
    public static void RestoreFiles(Manifest m, string dir)
    {
        Validate(m, dir);
        foreach (var f in m.Files)
        {
            if (f.Existed)
            {
                // Restore original bytes, including original encoding, without text conversion.
                Directory.CreateDirectory(Path.GetDirectoryName(f.Path)!);
                File.Copy(Path.Combine(dir, f.Copy), f.Path, true); Permissions.Restore(f.Path, f.Sddl!);
            }
            else if (File.Exists(f.Path)) File.Delete(f.Path);
        }
    }
}
