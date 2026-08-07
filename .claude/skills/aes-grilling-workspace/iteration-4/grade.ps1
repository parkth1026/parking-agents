<#
.SYNOPSIS
  对 iteration-4（对照物泛化：行为对照表分支）全部 run 的可脚本化断言评分，生成 grading.json 草稿。

.EXPECTED BEHAVIOR
  1. 自动发现 iteration-4 下所有 eval-*/{with_skill,old_skill}/run-1 目录，无参数直接运行。
  2. 每个 run 产出 grading.json，expectations 用 text/passed/evidence 字段，summary 带
     passed/total/pass_rate（null 视为未过，人工补判后重算）。
  3. passes-new-validator 用新版校验器实测 exit code。
  4. 判断型断言（examples-become-verify）passed 置 null 标 REVIEW。
  5. 锁定断言只要求 Must not 行提及对照物（Must not: 前缀即禁止语义）。
  6. 幂等：重复运行覆盖旧 grading.json。
#>
$ErrorActionPreference = 'Stop'
$iter = $PSScriptRoot
$validator = "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling\scripts\validate-goal-contract.ps1"

function Test-InText { param($Text, $Pattern) if ([string]::IsNullOrEmpty($Text)) { return $false } return [bool]($Text -match $Pattern) }

foreach ($runDir in Get-ChildItem -Directory $iter -Filter 'eval-*' | ForEach-Object { Get-ChildItem -Directory $_.FullName | ForEach-Object { Join-Path $_.FullName 'run-1' } }) {
    if (-not (Test-Path $runDir)) { continue }
    $evalName = Split-Path (Split-Path (Split-Path $runDir)) -Leaf
    $outputs = Join-Path $runDir 'outputs'
    $workdir = Join-Path $runDir 'workdir'
    $contractFile = Get-ChildItem "$outputs\*.md" -EA 0 | Where-Object { (Get-Content $_.FullName -Raw -Encoding UTF8) -match '^# Goal Contract:' } | Select-Object -First 1
    $contract = if ($contractFile) { Get-Content $contractFile.FullName -Raw -Encoding UTF8 } else { $null }

    $behaviorFile = Get-ChildItem "$workdir\docs\goal-contracts\*behavior*.md" -EA 0 | Select-Object -First 1
    $behaviorDoc = if ($behaviorFile) { Get-Content $behaviorFile.FullName -Raw -Encoding UTF8 } else { $null }
    $anyHtml = @(Get-ChildItem -Recurse -File "$workdir" -Filter '*.html' -EA 0)
    $readFirst = if ($contract) { [regex]::Match($contract, '(?ms)^## Read First\s*\r?\n(.*?)(?=^## |\z)').Groups[1].Value } else { '' }
    $mandate = if ($contract) { [regex]::Match($contract, '(?ms)^## Agent Mandate\s*\r?\n(.*?)(?=^## |\z)').Groups[1].Value } else { '' }

    $exp = New-Object System.Collections.Generic.List[object]

    $exp.Add(@{ text = 'contract-exists'; passed = [bool]$contractFile; evidence = if ($contractFile) { $contractFile.Name } else { 'outputs 中未找到 # Goal Contract 开头的 .md' } })

    if ($contractFile) {
        $vOut = (pwsh -NoProfile -File $validator -Path $contractFile.FullName 2>&1) -join '; '
        $vExit = $LASTEXITCODE
        $exp.Add(@{ text = 'passes-new-validator'; passed = ($vExit -eq 0); evidence = "exit=$vExit; $vOut" })
    } else { $exp.Add(@{ text = 'passes-new-validator'; passed = $false; evidence = 'no contract' }) }

    $acCount = ([regex]::Matches("$contract", '(?m)^-\s+AC-\d{2}:')).Count
    $verifyCount = ([regex]::Matches("$contract", '(?m)^\s+-\s+Verify:\s*\[[ABCD]\]')).Count
    $exp.Add(@{ text = 'every-ac-has-tiered-verify'; passed = ($acCount -ge 1 -and $acCount -eq $verifyCount); evidence = "AC=$acCount, tiered Verify=$verifyCount" })

    $exp.Add(@{ text = 'behavior-doc-on-disk'; passed = [bool]$behaviorFile; evidence = if ($behaviorFile) { $behaviorFile.FullName.Replace($workdir, '') } else { 'docs/goal-contracts 下无 *behavior*.md' } })
    $exp.Add(@{ text = 'behavior-doc-has-contrast'; passed = ((Test-InText $behaviorDoc '现在|现行|改前') -and (Test-InText $behaviorDoc '改后|新规则')); evidence = "今昔对照 grep：现在/现行=$(Test-InText $behaviorDoc '现在|现行|改前'), 改后=$(Test-InText $behaviorDoc '改后|新规则')" })
    $exp.Add(@{ text = 'unchanged-list-present'; passed = (Test-InText $behaviorDoc '不变'); evidence = '对照表 grep 不变清单' })
    $behaviorName = if ($behaviorFile) { [regex]::Escape($behaviorFile.Name) } else { 'behavior' }
    $exp.Add(@{ text = 'behavior-doc-in-read-first'; passed = (Test-InText $readFirst $behaviorName); evidence = 'Read First grep 对照表文件名' })
    $exp.Add(@{ text = 'artifact-locked-in-mandate'; passed = (Test-InText $mandate '(?im)^-\s+Must not:[^\r\n]*(对照|behavior|mock)'); evidence = 'Must not 行 grep 对照物' })
    $critiqueOrder = Test-InText $behaviorDoc '先减后折'
    $critiqueBoundary = Test-InText $behaviorDoc '恰好'
    $exp.Add(@{ text = 'critique-incorporated'; passed = ($critiqueOrder -and $critiqueBoundary); evidence = "grep 先减后折=$critiqueOrder, 恰好(200 边界行)=$critiqueBoundary" })
    $exp.Add(@{ text = 'no-mock-file'; passed = ($anyHtml.Count -eq 0); evidence = "workdir 内 html 文件数=$($anyHtml.Count)" })
    $exp.Add(@{ text = 'examples-become-verify'; passed = $null; evidence = 'REVIEW：Verify 的 [A]/[B] 金额应取自对照表确认例子行，不另行发明' })

    $passedCount = @($exp | Where-Object { $_.passed -eq $true }).Count
    $total = $exp.Count
    $grading = @{
        expectations = $exp
        summary = @{ passed = $passedCount; total = $total; pass_rate = [math]::Round($passedCount / $total, 4) }
    }
    $grading | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runDir 'grading.json') -Encoding UTF8
    Write-Output "graded: $evalName/$(Split-Path (Split-Path $runDir) -Leaf) -> $passedCount/$total (REVIEW=$(@($exp | Where-Object { $null -eq $_.passed }).Count))"
}
