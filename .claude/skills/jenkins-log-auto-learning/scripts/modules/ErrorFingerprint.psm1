function ConvertTo-Hashtable {
    param($obj)
    $hash = @{}
    if ($obj -is [System.Collections.IDictionary]) {
        return $obj
    }
    foreach ($prop in $obj.PSObject.Properties) {
        $hash[$prop.Name] = $prop.Value
    }
    return $hash
}
# Error Fingerprint Database
# 错误指纹数据库 - 识别和复用历史修复方案

$script:FingerprintDBPath = "$env:USERPROFILE/.openclaw-autoclaw/workspace/memory/jenkins-log-auto-learning/error-fingerprints.json"

function Initialize-FingerprintDB {
    if (-not (Test-Path $script:FingerprintDBPath)) {
        $db = @{
            version = "1.0"
            fingerprints = @{}
            patterns = @()
            stats = @{
                totalErrors = 0
                fixedErrors = 0
            }
        }
        Save-FingerprintDB $db
    }
}

function Load-FingerprintDB {
    Initialize-FingerprintDB
    return Get-Content $script:FingerprintDBPath | ConvertFrom-Json 
}

function Save-FingerprintDB {
    param($DB)
    $DB | ConvertTo-Json -Depth 10 | Set-Content $script:FingerprintDBPath -Encoding UTF8
}

function Get-ErrorFingerprint {
    param(
        [string]$ErrorCode,
        [string]$ErrorMessage,
        [string]$FilePath,
        [string]$LineNumber
    )
    
    # 提取关键标识符
    $identifiers = @()
    $identifierPattern = "[FUAT][A-Z][a-zA-Z0-9_]+"
    $matches = [regex]::Matches($ErrorMessage, $identifierPattern)
    foreach ($match in $matches) {
        $identifiers += $match.Value
    }
    
    # 提取文件名关键词
    $fileKeyword = ""
    if ($FilePath -match "([^/\\]+)\.(cpp|h|cs)$") {
        $fileKeyword = $matches[1]
    }
    
    # 生成指纹 ID
    $fingerprintId = $ErrorCode
    if ($identifiers.Count -gt 0) {
        $fingerprintId += "_" + $identifiers[0]
    }
    if ($fileKeyword) {
        $fingerprintId += "_" + $fileKeyword
    }
    
    # 生成精确哈希
    $hashInput = "$ErrorCode|$ErrorMessage|$FilePath|$LineNumber"
    $hash = [System.BitConverter]::ToString(
        [System.Security.Cryptography.SHA256]::Create().ComputeHash(
            [System.Text.Encoding]::UTF8.GetBytes($hashInput)
        )
    ).Replace("-", "").Substring(0, 16)
    
    return @{
        FingerprintId = $fingerprintId
        Hash = $hash
        Identifiers = $identifiers
        FileKeyword = $fileKeyword
    }
}

function Find-SimilarError {
    param(
        [string]$FingerprintId,
        [string]$Hash
    )
    
    $db = Load-FingerprintDB
    
    # 精确匹配
    if (($db.fingerprints.PSObject.Properties.Name -contains $Hash)) {
        return @{
            Found = $true
            MatchType = "Exact"
            Error = (ConvertTo-Hashtable $db.fingerprints)[$Hash]
        }
    }
    
    # 指纹 ID 匹配
    $similar = @()
    foreach ($key in $db.fingerprints.Keys) {
        $entry = $db.fingerprints[$key]
        if ($entry.FingerprintId -eq $FingerprintId) {
            $similar += $entry
        }
    }
    
    if ($similar.Count -gt 0) {
        return @{
            Found = $true
            MatchType = "Similar"
            Error = $similar | Sort-Object OccurrenceCount -Descending | Select-Object -First 1
            SimilarCount = $similar.Count
        }
    }
    
    return @{
        Found = $false
    }
}

function Add-ErrorToFingerprintDB {
    param(
        [string]$ErrorCode,
        [string]$ErrorMessage,
        [string]$FilePath,
        [string]$LineNumber,
        [string]$FixMethod,
        [string]$FixCommit,
        [int]$BuildNumber
    )
    
    $fp = Get-ErrorFingerprint -ErrorCode $ErrorCode -ErrorMessage $ErrorMessage -FilePath $FilePath -LineNumber $LineNumber
    $db = Load-FingerprintDB
    
    if (($db.fingerprints.PSObject.Properties.Name -contains $fp.Hash)) {
        # 更新现有记录
        $entry = (ConvertTo-Hashtable $db.fingerprints)[$fp.Hash]
        $entry.OccurrenceCount++
        $entry.LastOccurrence = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        $entry.BuildNumbers += $BuildNumber
        if ($FixMethod -and -not $entry.FixMethod) {
            $entry.FixMethod = $FixMethod
        }
    } else {
        # 新建记录
        (ConvertTo-Hashtable $db.fingerprints)[$fp.Hash] = @{
            FingerprintId = $fp.FingerprintId
            Hash = $fp.Hash
            ErrorCode = $ErrorCode
            ErrorMessage = $ErrorMessage
            FilePath = $FilePath
            LineNumber = $LineNumber
            Identifiers = $fp.Identifiers
            FirstOccurrence = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            LastOccurrence = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
            OccurrenceCount = 1
            BuildNumbers = @($BuildNumber)
            FixMethod = $FixMethod
            FixCommit = $FixCommit
            SuccessRate = 0
        }
        $db.stats.totalErrors++
    }
    
    Save-FingerprintDB $db
    return $fp.FingerprintId
}

function Get-FixRecommendation {
    param(
        [string]$ErrorCode,
        [string]$ErrorMessage,
        [string]$FilePath
    )
    
    $fp = Get-ErrorFingerprint -ErrorCode $ErrorCode -ErrorMessage $ErrorMessage -FilePath $FilePath
    $match = Find-SimilarError -FingerprintId $fp.FingerprintId -Hash $fp.Hash
    
    if ($match.Found) {
        $entry = $match.Error
        return @{
            HasRecommendation = $true
            MatchType = $match.MatchType
            FingerprintId = $entry.FingerprintId
            OccurrenceCount = $entry.OccurrenceCount
            FixMethod = $entry.FixMethod
            Confidence = if ($match.MatchType -eq "Exact") { "High" } else { "Medium" }
            Message = "这个错误之前出现过 $($entry.OccurrenceCount) 次，修复方案：$($entry.FixMethod)"
        }
    }
    
    return @{
        HasRecommendation = $false
        Message = "没有找到历史修复记录"
    }
}

Export-ModuleMember -Function *

