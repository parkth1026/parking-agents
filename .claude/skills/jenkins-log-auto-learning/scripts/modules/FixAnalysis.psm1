# Fix Analysis Module
# 修复分析模块 - 通过代码理解生成修复方案

function Get-FixAnalysis {
    param(
        [string]$FailLog,
        [string]$SuccessLog,
        [array]$Commits,
        [object]$ErrorInfo
    )

    $analysis = @{
        RootCause = ""
        FixSteps = @()
        FixReason = ""
        Confidence = "Low"
    }

    # 分析错误类型
    switch ($ErrorInfo.ErrorCode) {
        "C2061" {
            $analysis.RootCause = "使用了未定义的类型或标识符"
            $analysis.FixSteps = @(
                "1. 查找 $($ErrorInfo.Identifier) 的定义位置",
                "2. 在 $($ErrorInfo.FilePath) 中添加对应的 #include",
                "3. 如果头文件已包含，检查命名空间"
            )
            $analysis.FixReason = "编译器在遇到标识符时找不到其定义，需要包含声明该标识符的头文件"
            $analysis.Confidence = "High"
        }

        "C1083" {
            $analysis.RootCause = "无法找到指定的头文件"
            $analysis.FixSteps = @(
                "1. 确认头文件路径是否正确",
                "2. 在 .Build.cs 中添加对应的模块依赖",
                "3. 重新生成项目文件 (GenerateProjectFiles)"
            )
            $analysis.FixReason = "UE5 模块系统需要显式声明依赖关系，否则无法访问其他模块的头文件"
            $analysis.Confidence = "High"
        }

        "LNK2019" {
            $analysis.RootCause = "方法声明了但没有实现"
            $analysis.FixSteps = @(
                "1. 在对应的 .cpp 文件中添加方法实现",
                "2. 检查该 .cpp 文件是否包含在构建设置中",
                "3. 如果是虚函数，确保有默认实现"
            )
            $analysis.FixReason = "链接器找不到方法的实现代码，可能是忘记写实现或文件未参与编译"
            $analysis.Confidence = "Medium"
        }

        default {
            $analysis.RootCause = "需要进一步分析"
            $analysis.FixSteps = @("查看完整错误日志", "对比成功构建的差异", "定位问题代码")
            $analysis.Confidence = "Low"
        }
    }

    return $analysis
}

function Get-CommitDiffAnalysis {
    param(
        [array]$Commits,
        [string]$ErrorFile
    )

    $relevantCommits = $Commits | Where-Object {
        $_.Files -contains $ErrorFile -or
        $_.Message -match "fix|修复|解决"
    }

    return @{
        RelevantCommits = $relevantCommits
        FixCommit = $relevantCommits | Select-Object -First 1
        IsVerified = ($relevantCommits.Count -gt 0)
    }
}

Export-ModuleMember -Function Get-FixAnalysis, Get-CommitDiffAnalysis
