# Precise Fix Generator
function Get-PreciseFix {
    param(
        [string]$ErrorCode,
        [string]$ErrorMessage,
        [string]$FilePath
    )
    
    $fix = @{
        Steps = @()
        CodeChanges = @()
        Verification = @()
        Confidence = "Low"
    }
    
    if ($ErrorCode -eq "C2061") {
        $fix.Steps = @(
            "1. 打开文件: $FilePath"
            "2. 在第 1 行添加缺失的头文件 #include"
            "3. 如果涉及模块，检查 .Build.cs 依赖"
        )
        $fix.Confidence = "High"
    }
    elseif ($ErrorCode -eq "C1083") {
        $fix.Steps = @(
            "1. 找到 .Build.cs 文件"
            "2. 添加 PublicDependencyModuleNames"
            "3. 重新生成项目文件"
        )
        $fix.Confidence = "High"
    }
    elseif ($ErrorCode -eq "LNK2019") {
        $fix.Steps = @(
            "1. 在 .cpp 文件中添加方法实现"
            "2. 确保文件参与编译"
        )
        $fix.Confidence = "Medium"
    }
    
    return $fix
}

Export-ModuleMember -Function Get-PreciseFix
