<#
.SYNOPSIS
  对 iteration-3（界面 Mock 对齐升级）全部 run 的可脚本化断言评分，生成 grading.json 草稿。

.EXPECTED BEHAVIOR
  1. 自动发现 iteration-3 下所有 eval-*/{with_skill,old_skill}/run-1 目录，无参数直接运行。
  2. 每个 run 产出 grading.json，expectations 数组使用 text/passed/evidence 字段，
     summary 带 passed/total/pass_rate（null 视为未过，供人工补判后重算）。
  3. passes-new-validator 用新版校验器实测（exit code 判定），不靠猜。
  4. 判断型断言（mock 迭代轮次、提问是否浪费）passed 置 null 并标 REVIEW，留待人工复核。
  5. 幂等：重复运行覆盖旧 grading.json。
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
    $questions = if (Test-Path "$outputs\questions.md") { Get-Content "$outputs\questions.md" -Raw -Encoding UTF8 } else { '' }

    # mock 文件：workdir 里契约约定目录下的 *mock*.html
    $mockFile = Get-ChildItem "$workdir\docs\goal-contracts\*mock*.html" -EA 0 | Select-Object -First 1
    $mockHtml = if ($mockFile) { Get-Content $mockFile.FullName -Raw -Encoding UTF8 } else { $null }
    $anyHtml = @(Get-ChildItem -Recurse -File "$workdir" -Filter '*.html' -EA 0)

    # Read First 与 Success Criteria 节
    $readFirst = if ($contract) { [regex]::Match($contract, '(?ms)^## Read First\s*\r?\n(.*?)(?=^## |\z)').Groups[1].Value } else { '' }
    $mandate = if ($contract) { [regex]::Match($contract, '(?ms)^## Agent Mandate\s*\r?\n(.*?)(?=^## |\z)').Groups[1].Value } else { '' }
    $verifyLines = if ($contract) { @([regex]::Matches($contract, '(?m)^\s+-\s+Verify:.*$') | ForEach-Object { $_.Value }) } else { @() }

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

    switch -Wildcard ($evalName) {
        'eval-5-*' {
            $exp.Add(@{ text = 'mock-file-on-disk'; passed = [bool]$mockFile; evidence = if ($mockFile) { $mockFile.FullName.Replace($workdir, '') } else { 'docs/goal-contracts 下无 *mock*.html' } })
            $mockName = if ($mockFile) { [regex]::Escape($mockFile.Name) } else { 'mock' }
            $exp.Add(@{ text = 'mock-in-read-first'; passed = (Test-InText $readFirst $mockName); evidence = 'Read First 节 grep mock 文件名' })
            $mockAcHit = @($verifyLines | Where-Object { $_ -match '(?i)mock' })
            $exp.Add(@{ text = 'mock-comparison-ac'; passed = ($mockAcHit.Count -ge 1); evidence = if ($mockAcHit.Count -ge 1) { $mockAcHit[0].Trim() } else { 'Verify 行均未引用 mock' } })
            # 禁止语义来自 Must not: 前缀本身，不要求行内再有「不得/不可」字样
            $exp.Add(@{ text = 'mock-locked-in-mandate'; passed = (Test-InText $mandate '(?im)^-\s+Must not:[^\r\n]*mock'); evidence = 'Must not 行 grep mock' })
            $critique = (Test-InText $mockHtml '清除筛选') -and (Test-InText $mockHtml '没有匹配的任务')
            $exp.Add(@{ text = 'mock-incorporates-critique'; passed = $critique; evidence = "grep 清除筛选=$(Test-InText $mockHtml '清除筛选'), 空态文案=$(Test-InText $mockHtml '没有匹配的任务')" })
            $exp.Add(@{ text = 'mock-self-contained'; passed = ($mockFile -and -not (Test-InText $mockHtml 'https?://')); evidence = 'grep 无 http(s):// 外链' })
            $exp.Add(@{ text = 'mock-iterated-before-confirm'; passed = $null; evidence = 'REVIEW questions.md：应见 首版展示→三条质疑→修改→二次确认' })
        }
        'eval-6-*' {
            $exp.Add(@{ text = 'no-mock-file'; passed = ($anyHtml.Count -eq 0); evidence = "workdir 内 html 文件数=$($anyHtml.Count)" })
            $exp.Add(@{ text = 'no-mock-ac'; passed = -not (Test-InText $contract '(?i)mock|界面示意'); evidence = '契约 grep 无 mock/界面示意' })
            $exp.Add(@{ text = 'classification-not-wasted'; passed = $null; evidence = 'REVIEW questions.md：不应把「要不要界面」当独立问题问用户' })
            $exp.Add(@{ text = 'dead-letter-in-contract'; passed = (Test-InText $contract 'dead-letter\.jsonl'); evidence = 'grep dead-letter.jsonl' })
            $exp.Add(@{ text = 'compat-preserved'; passed = (Test-InText $contract 'ledger\.jsonl'); evidence = 'grep ledger.jsonl' })
        }
        'eval-7-*' {
            $exp.Add(@{ text = 'classification-escalated'; passed = ((Test-InText $questions 'CLI|命令行') -and (Test-InText $questions '网页|页面|Web')); evidence = 'questions.md grep 网页+CLI 判定问题' })
            $exp.Add(@{ text = 'mock-file-on-disk'; passed = [bool]$mockFile; evidence = if ($mockFile) { $mockFile.FullName.Replace($workdir, '') } else { 'docs/goal-contracts 下无 *mock*.html' } })
            $mockAcHit = @($verifyLines | Where-Object { $_ -match '(?i)mock' })
            $exp.Add(@{ text = 'mock-comparison-ac'; passed = ($mockAcHit.Count -ge 1); evidence = if ($mockAcHit.Count -ge 1) { $mockAcHit[0].Trim() } else { 'Verify 行均未引用 mock' } })
            $exp.Add(@{ text = 'mock-incorporates-critique'; passed = (Test-InText $mockHtml '近 7 天新增|近7天新增'); evidence = 'mock grep 近 7 天新增' })
            $exp.Add(@{ text = 'cli-part-has-own-ac'; passed = (Test-InText $contract '(?m)^-\s+AC-\d{2}:[^\r\n]*(CLI|命令行|stats)'); evidence = 'AC 行 grep CLI/命令行/stats' })
            # 禁止语义来自 Must not: 前缀本身，不要求行内再有「不得/不可」字样
            $exp.Add(@{ text = 'mock-locked-in-mandate'; passed = (Test-InText $mandate '(?im)^-\s+Must not:[^\r\n]*mock'); evidence = 'Must not 行 grep mock' })
        }
    }

    $passedCount = @($exp | Where-Object { $_.passed -eq $true }).Count
    $total = $exp.Count
    $grading = @{
        expectations = $exp
        summary = @{ passed = $passedCount; total = $total; pass_rate = [math]::Round($passedCount / $total, 4) }
    }
    $json = $grading | ConvertTo-Json -Depth 6
    Set-Content -LiteralPath (Join-Path $runDir 'grading.json') -Value $json -Encoding UTF8
    Write-Output "graded: $evalName/$(Split-Path (Split-Path $runDir) -Leaf) -> $passedCount/$total (REVIEW=$(@($exp | Where-Object { $null -eq $_.passed }).Count))"
}
