<#
.SYNOPSIS
  对 iteration-2 全部 run 的可脚本化断言评分，生成 grading.json 草稿。

.EXPECTED BEHAVIOR
  1. 自动发现 iteration-2 下所有 eval-*/{with_skill,old_skill}/run-1 目录，无参数直接运行。
  2. 每个 run 产出 grading.json，expectations 数组使用 text/passed/evidence 字段。
  3. passes-new-validator 断言用新版校验器实测（exit code 判定），不靠猜。
  4. 判断型断言（提问批量性/是否升级为用户问题）passed 置 null 并标 REVIEW，留待人工复核。
  5. 幂等：重复运行覆盖旧 grading.json。
#>
$ErrorActionPreference = 'Stop'
$iter = $PSScriptRoot
$validator = "G:\GIT\AI_WorkFlow\parking-agents\.claude\skills\aes-grilling\scripts\validate-goal-contract.ps1"

function Test-InContract { param($Contract, $Pattern) if ($null -eq $Contract) { return $false } return [bool]($Contract -match $Pattern) }

foreach ($runDir in Get-ChildItem -Directory $iter -Filter 'eval-*' | ForEach-Object { Get-ChildItem -Directory $_.FullName | ForEach-Object { Join-Path $_.FullName 'run-1' } }) {
    if (-not (Test-Path $runDir)) { continue }
    $evalName = Split-Path (Split-Path (Split-Path $runDir)) -Leaf
    $outputs = Join-Path $runDir 'outputs'
    $workdir = Join-Path $runDir 'workdir'
    $contractFile = Get-ChildItem "$outputs\*.md" -EA 0 | Where-Object { (Get-Content $_.FullName -Raw -Encoding UTF8) -match '^# Goal Contract:' } | Select-Object -First 1
    $contract = if ($contractFile) { Get-Content $contractFile.FullName -Raw -Encoding UTF8 } else { $null }
    $questions = if (Test-Path "$outputs\questions.md") { Get-Content "$outputs\questions.md" -Raw -Encoding UTF8 } else { '' }
    $exp = New-Object System.Collections.Generic.List[object]

    $exp.Add(@{ text = 'contract-exists'; passed = [bool]$contractFile; evidence = if ($contractFile) { $contractFile.Name } else { 'outputs 中未找到 # Goal Contract 开头的 .md' } })

    if ($contractFile) {
        $null = pwsh -NoProfile -File $validator -Path $contractFile.FullName 2>&1
        $vExit = $LASTEXITCODE
        $vOut = (pwsh -NoProfile -File $validator -Path $contractFile.FullName 2>&1) -join '; '
        $exp.Add(@{ text = 'passes-new-validator'; passed = ($vExit -eq 0); evidence = "exit=$vExit; $vOut" })
    } else { $exp.Add(@{ text = 'passes-new-validator'; passed = $false; evidence = 'no contract' }) }

    $acCount = ([regex]::Matches("$contract", '(?m)^-\s+AC-\d{2}:')).Count
    $verifyCount = ([regex]::Matches("$contract", '(?m)^\s+-\s+Verify:\s*\[[ABCD]\]')).Count
    $exp.Add(@{ text = 'every-ac-has-tiered-verify'; passed = ($acCount -ge 1 -and $acCount -eq $verifyCount); evidence = "AC=$acCount, tiered Verify=$verifyCount" })

    switch -Wildcard ($evalName) {
        'eval-2-*' {
            $exp.Add(@{ text = 'verify-uses-repo-test-command'; passed = (Test-InContract $contract 'npm test|node test[/\\]run-tests\.mjs'); evidence = 'grep: npm test / run-tests.mjs' })
            $exp.Add(@{ text = 'verification-not-asked'; passed = $null; evidence = 'REVIEW questions.md' })
        }
        'eval-3-*' {
            $exp.Add(@{ text = 'golden-case-b-tier'; passed = ((Test-InContract $contract '\[B\]') -and (Test-InContract $contract 'bill-2026-07\.csv')); evidence = 'grep: [B] 且 bill-2026-07.csv' })
            $fixtureHit = (Get-ChildItem -Recurse -File $workdir -EA 0 | Where-Object { $_.FullName -notmatch 'data\\bill' } | Where-Object { (Get-Content $_.FullName -Raw -EA 0) -match '1482\.80' } | Select-Object -First 1)
            $exp.Add(@{ text = 'expected-summary-pinned'; passed = ((Test-InContract $contract '1482\.80') -or [bool]$fixtureHit); evidence = if ($fixtureHit) { "fixture: $($fixtureHit.FullName.Replace($workdir,''))" } else { 'contract grep 1482.80' } })
            $exp.Add(@{ text = 'fixture-planned-on-disk'; passed = ((Test-Path "$workdir\tests\fixtures") -or (Test-InContract $contract 'tests[/\\]fixtures')); evidence = "tests/fixtures exists=$(Test-Path "$workdir\tests\fixtures")" })
            $exp.Add(@{ text = 'verification-escalated'; passed = $null; evidence = 'REVIEW questions.md' })
        }
        'eval-4-*' {
            $exp.Add(@{ text = 'threshold-present'; passed = ((Test-InContract $contract 'p95') -and (Test-InContract $contract '200\s*ms')); evidence = 'grep: p95 且 200ms' })
            $exp.Add(@{ text = 'bench-script-named'; passed = (Test-InContract $contract 'bench\.mjs|scripts[/\\]bench'); evidence = 'grep: bench 脚本' })
            $exp.Add(@{ text = 'scale-locked'; passed = (Test-InContract $contract '不可修改|不得修改|锁定|不许改|不能修改|不可变更'); evidence = 'grep: 锁尺子表述' })
            $exp.Add(@{ text = 'verification-escalated'; passed = $null; evidence = 'REVIEW questions.md' })
        }
    }
    $exp.Add(@{ text = 'single-batched-round'; passed = $null; evidence = 'REVIEW questions.md + process-notes.md' })

    @{ expectations = $exp } | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $runDir 'grading.json') -Encoding UTF8
    Write-Output "graded: $($runDir.Replace($iter,''))"
}
