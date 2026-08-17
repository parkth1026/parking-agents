<#
.SYNOPSIS
  Validates a lightweight AES Goal Contract for direct agent execution.

.EXPECTED BEHAVIOR
  1. A valid Ready or Blocked Contract exits 0.
  2. Missing Goal, Scope, AC, mandate, completion, or blocker boundaries exit 1.
  3. One Contract has 1-7 ACs so it does not grow into a specification.
  4. Hashes, approval receipts, validation matrices, and handoff files are not required.
  5. PowerShell 7 and Windows PowerShell 5.1 use the same rules.
  6. Every AC carries exactly one indented "- Verify: [A|B|C|D] <content>" line; a missing,
     unpaired, or untagged Verify exits 1.
  7. An [A]/[B] Verify without a backtick command or fixture path emits a WARNING, not a failure.
  8. Optional sections Read First, Deliverables, and Iteration Strategy are allowed; when
     Deliverables exists its bullets must be sequential unique "- D-01: <path>: <requirement>".
  9. A [B] Verify without a Deliverables section emits a WARNING (fixtures may already exist on disk).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Path
)

$ErrorActionPreference = 'Stop'
$resolvedPath = (Resolve-Path -LiteralPath $Path).Path
$content = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8
$errors = New-Object System.Collections.Generic.List[string]
$warnings = New-Object System.Collections.Generic.List[string]

function Get-SectionBody {
    param([string]$Heading)
    $match = [regex]::Match(
        $content,
        "(?ms)^## $([regex]::Escape($Heading))\s*\r?\n(?<body>.*?)(?=^## |\z)"
    )
    if (-not $match.Success) {
        return $null
    }
    return $match.Groups['body'].Value.Trim()
}

function Get-ListValue {
    param(
        [string]$Text,
        [string]$Key
    )
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return $null
    }
    $match = [regex]::Match($Text, "(?m)^- $([regex]::Escape($Key)):\s*(\S.*)$")
    if (-not $match.Success) {
        return $null
    }
    return $match.Groups[1].Value.Trim()
}

function Test-MeaningfulValue {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $false
    }
    return $Value -notmatch '(?i)^(none|n/?a|unknown|pending|later|-|todo|tbd|fixme|xxx)[.!]?$'
}

function Get-BulletLines {
    param([string]$Section)
    if ([string]::IsNullOrWhiteSpace($Section)) {
        return @()
    }
    return @(
        $Section -split '\r?\n' |
            Where-Object { $_ -match '^-\s+\S.*$' }
    )
}

$titleMatches = [regex]::Matches($content, '(?m)^# Goal Contract:\s*(?<title>\S.*)$')
if ($titleMatches.Count -ne 1) {
    $errors.Add('Contract requires exactly one non-empty "# Goal Contract:" title.')
}

$goalHeadingIndex = $content.IndexOf('## Goal', [System.StringComparison]::Ordinal)
$preamble = if ($goalHeadingIndex -ge 0) {
    $content.Substring(0, $goalHeadingIndex)
}
else {
    $content
}

$statusMatches = [regex]::Matches($preamble, '(?m)^- Status:\s*(Ready|Blocked)\s*$')
if ($statusMatches.Count -ne 1) {
    $errors.Add('Preamble requires exactly one Status: Ready or Blocked.')
}
$statusMatch = if ($statusMatches.Count -gt 0) { $statusMatches[0] } else { $null }
$status = if ($null -ne $statusMatch) { $statusMatch.Groups[1].Value } else { '' }

$targetMatches = [regex]::Matches($preamble, '(?m)^- Target:\s*(\S.*)$')
$target = Get-ListValue -Text $preamble -Key 'Target'
if ($targetMatches.Count -ne 1 -or -not (Test-MeaningfulValue -Value $target)) {
    $errors.Add('Preamble requires exactly one meaningful Target.')
}
$updatedMatches = [regex]::Matches($preamble, '(?m)^- Updated:\s*(\S.*)$')
$updated = Get-ListValue -Text $preamble -Key 'Updated'
if ($updatedMatches.Count -ne 1 -or $updated -notmatch '^\d{4}-\d{2}-\d{2}$') {
    $errors.Add('Preamble requires exactly one Updated value using YYYY-MM-DD.')
}

# 占位符判据只认模板那种 <letter...> 的形式。放宽到任意 <...> 会把
# "响应时间 < 200ms 且 QPS > 100" 这类数值阈值 AC 当成占位符拒掉，而阈值恰恰是好 AC 该写的。
if ($content -match '<[A-Za-z][A-Za-z0-9 ,._/|-]{1,80}>') {
    $errors.Add('Contract contains a template placeholder like <...>.')
}

# TODO/TBD/FIXME/XXX 只有以占位符形态出现才算错：独占一行，或行首后跟冒号的空承诺。
# 出现在句子中间的多半是内容本身——「搜索标题含 TODO 的笔记」是合法 AC，拒掉会逼用户
# 为绕过校验器改需求措辞。句中出现降级为 WARNING，供人复核。作为字段值出现
# (如 "- Evidence: TODO") 由 Test-MeaningfulValue 拦截。
if ($content -match '(?im)^\s*(?:[-*+]\s*)?(?:\*\*)?(TODO|TBD|FIXME|XXX)\b\s*(?:[:：]|[\s.!-]*$)') {
    $errors.Add('Contract contains an unresolved TODO/TBD/FIXME marker.')
}
elseif ($content -match '(?i)\b(TODO|TBD|FIXME|XXX)\b') {
    $warnings.Add('Contract mentions TODO/TBD/FIXME/XXX inside a sentence; confirm it is real content, not a deferred-work marker.')
}

$requiredHeadings = @(
    'Goal',
    'Why',
    'Scope',
    'Success Criteria',
    'Constraints',
    'Agent Mandate',
    'Completion',
    'Blockers'
)
$sections = @{}
$lastHeadingIndex = -1
foreach ($heading in $requiredHeadings) {
    $headingMatches = [regex]::Matches(
        $content,
        "(?m)^## $([regex]::Escape($heading))\s*$"
    )
    $body = Get-SectionBody -Heading $heading
    $sections[$heading] = $body
    if ($headingMatches.Count -eq 0) {
        $errors.Add("Missing heading: $heading")
    }
    elseif ($headingMatches.Count -gt 1) {
        $errors.Add("Heading must appear exactly once: $heading")
    }
    elseif ($headingMatches[0].Index -lt $lastHeadingIndex) {
        $errors.Add("Heading is out of order: $heading")
    }
    else {
        $lastHeadingIndex = $headingMatches[0].Index
    }
}

foreach ($legacyHeading in @(
    'Contract Metadata',
    'Validation Matrix',
    'Approval Binding',
    'Independent Handoff',
    'Delivery Standard',
    'Authority and Escalation'
)) {
    if ($content -match "(?m)^## $([regex]::Escape($legacyHeading))\s*$") {
        $errors.Add("Legacy heavy-contract heading is not allowed: $legacyHeading")
    }
}

$goal = $sections['Goal']
if (-not (Test-MeaningfulValue -Value $goal)) {
    $errors.Add('Goal must contain one meaningful observable end state.')
}
elseif ($goal -match '(?m)^-\s+' -or $goal -match '(?m)^\d+[.)]\s+') {
    $errors.Add('Goal must be one end-state statement, not a list of goals or tasks.')
}
elseif ($goal.Length -gt 600) {
    $errors.Add('Goal is too long; move detail to Scope, Success Criteria, or repository references.')
}

$whyBullets = @(Get-BulletLines -Section $sections['Why'])
if ($whyBullets.Count -lt 1) {
    $errors.Add('Why requires at least one concrete problem or value bullet.')
}
if ($whyBullets.Count -gt 3) {
    $errors.Add('Why must stay concise: use no more than three bullets.')
}

$inScope = Get-ListValue -Text $sections['Scope'] -Key 'In'
$outOfScope = Get-ListValue -Text $sections['Scope'] -Key 'Out'
if (-not (Test-MeaningfulValue -Value $inScope)) {
    $errors.Add('Scope requires a meaningful In value.')
}
if (-not (Test-MeaningfulValue -Value $outOfScope)) {
    $errors.Add('Scope requires a meaningful Out value.')
}

$acMatches = [regex]::Matches(
    $sections['Success Criteria'],
    '(?m)^-\s+(AC-\d{2}):\s*(\S.*)$'
)
$successCriterionBullets = @(Get-BulletLines -Section $sections['Success Criteria'])
if ($successCriterionBullets.Count -ne $acMatches.Count) {
    $errors.Add('Every Success Criteria bullet must use "- AC-01: <decidable result>" format.')
}
foreach ($line in @($sections['Success Criteria'] -split '\r?\n')) {
    if ($line -match 'AC-\d' -and $line -notmatch '^-\s+AC-\d{2}:\s*\S.*$' -and
        $line -notmatch '^\s+-\s+Verify:') {
        $errors.Add("Malformed acceptance criterion line: $line")
    }
}
$acceptanceIds = @($acMatches | ForEach-Object { $_.Groups[1].Value })
$uniqueAcceptanceIds = @($acceptanceIds | Sort-Object -Unique)
if ($acceptanceIds.Count -lt 1) {
    $errors.Add('Success Criteria requires at least one AC.')
}
if ($acceptanceIds.Count -gt 7) {
    $errors.Add('A Goal Contract may contain at most seven ACs; split independent Goals instead of writing a Spec.')
}
if ($uniqueAcceptanceIds.Count -ne $acceptanceIds.Count) {
    $errors.Add('Acceptance criterion identifiers must be unique.')
}
for ($index = 0; $index -lt $acceptanceIds.Count; $index++) {
    $expectedId = 'AC-{0:D2}' -f ($index + 1)
    if ($acceptanceIds[$index] -ne $expectedId) {
        $errors.Add("Acceptance criteria must be sequential; expected $expectedId.")
        break
    }
}
foreach ($match in $acMatches) {
    $criterion = $match.Groups[2].Value.Trim()
    if ($criterion.Length -lt 8) {
        $errors.Add("Acceptance criterion $($match.Groups[1].Value) is too short to define a decidable result.")
    }
    if ($criterion -match '(?i)^(works?|working correctly|done|complete|tests? pass)[.!]?$') {
        $errors.Add("Acceptance criterion $($match.Groups[1].Value) is not independently decidable.")
    }
}

# 每条 AC 恰好一条缩进的 Verify 行。Verify 是「怎么算过」的落点：审计只认命令、落盘
# 文件和门槛值，没有 Verify 的 AC 在执行侧无法判定完成。逐块配对而不是数总数，防止
# 一条 AC 挂两行、另一条挂零行时总数恰好相等而漏检。
$currentAcId = $null
$verifyPerAc = @{}
foreach ($line in @($sections['Success Criteria'] -split '\r?\n')) {
    if ($line -match '^-\s+(AC-\d{2}):') {
        $currentAcId = $Matches[1]
        if (-not $verifyPerAc.ContainsKey($currentAcId)) {
            $verifyPerAc[$currentAcId] = 0
        }
    }
    elseif ($line -match '^\s+-\s+Verify:') {
        if ($null -eq $currentAcId) {
            $errors.Add('Verify line appears before any acceptance criterion.')
        }
        else {
            $verifyPerAc[$currentAcId]++
        }
    }
}
foreach ($id in $uniqueAcceptanceIds) {
    $verifyCount = if ($verifyPerAc.ContainsKey($id)) { $verifyPerAc[$id] } else { 0 }
    if ($verifyCount -ne 1) {
        $errors.Add("$id requires exactly one indented Verify line; found $verifyCount.")
    }
}

$verifyMatches = [regex]::Matches(
    $sections['Success Criteria'],
    '(?m)^\s+-\s+Verify:\s*(?<rest>\S.*)$'
)
$hasGoldenCaseVerify = $false
foreach ($verifyMatch in $verifyMatches) {
    $rest = $verifyMatch.Groups['rest'].Value.Trim()
    $tierMatch = [regex]::Match($rest, '^\[(?<tier>[ABCD])\]\s+(?<body>\S.*)$')
    if (-not $tierMatch.Success) {
        $errors.Add("Verify line requires a tier tag [A]/[B]/[C]/[D] followed by content: $rest")
        continue
    }
    $tier = $tierMatch.Groups['tier'].Value
    $body = $tierMatch.Groups['body'].Value.Trim()
    if ($tier -eq 'B') {
        $hasGoldenCaseVerify = $true
    }
    if ($body.Length -lt 8) {
        $errors.Add("Verify [$tier] body is too short to be checkable: $body")
    }
    # [A]/[B] 不带反引号只降级为 WARNING：命令或 fixture 路径可能确实还没有惯用写法，
    # 但缺了它审计要靠猜，值得人工复核一次。
    if ($tier -eq 'A' -and $body -notmatch '`[^`]+`') {
        $warnings.Add("Verify [A] should name an executable command in backticks: $body")
    }
    if ($tier -eq 'B' -and $body -notmatch '`[^`]+`') {
        $warnings.Add("Verify [B] should name on-disk fixture paths in backticks: $body")
    }
}

if (@(Get-BulletLines -Section $sections['Constraints']).Count -lt 1) {
    $errors.Add('Constraints requires at least one concrete bullet or an explicit repository-rules-only boundary.')
}

# 可选节：出现即校验，不出现不要求。Read First 指路、Deliverables 承载 [B] fixture 与
# 必须落盘的产物、Iteration Strategy 是一句话策略。
foreach ($optionalHeading in @('Read First', 'Deliverables', 'Iteration Strategy')) {
    $optionalMatches = [regex]::Matches(
        $content,
        "(?m)^## $([regex]::Escape($optionalHeading))\s*$"
    )
    if ($optionalMatches.Count -gt 1) {
        $errors.Add("Heading must appear exactly once: $optionalHeading")
    }
}

$readFirst = Get-SectionBody -Heading 'Read First'
if ($null -ne $readFirst -and @(Get-BulletLines -Section $readFirst).Count -lt 1) {
    $errors.Add('Read First, when present, requires at least one pointer bullet.')
}

$deliverables = Get-SectionBody -Heading 'Deliverables'
if ($null -ne $deliverables) {
    $deliverableBullets = @(Get-BulletLines -Section $deliverables)
    $deliverableMatches = [regex]::Matches($deliverables, '(?m)^-\s+(D-\d{2}):\s*(\S.*)$')
    if ($deliverableBullets.Count -lt 1 -or
        $deliverableBullets.Count -ne $deliverableMatches.Count) {
        $errors.Add('Every Deliverables bullet must use "- D-01: <path>: <requirement>" format.')
    }
    $deliverableIds = @($deliverableMatches | ForEach-Object { $_.Groups[1].Value })
    if (@($deliverableIds | Sort-Object -Unique).Count -ne $deliverableIds.Count) {
        $errors.Add('Deliverable identifiers must be unique.')
    }
    for ($index = 0; $index -lt $deliverableIds.Count; $index++) {
        $expectedId = 'D-{0:D2}' -f ($index + 1)
        if ($deliverableIds[$index] -ne $expectedId) {
            $errors.Add("Deliverables must be sequential; expected $expectedId.")
            break
        }
    }
}
elseif ($hasGoldenCaseVerify) {
    $warnings.Add('A [B] Verify exists but there is no Deliverables section; confirm the fixtures already exist on disk.')
}

$iterationStrategy = Get-SectionBody -Heading 'Iteration Strategy'
if ($null -ne $iterationStrategy) {
    if (-not (Test-MeaningfulValue -Value $iterationStrategy)) {
        $errors.Add('Iteration Strategy, when present, requires one meaningful sentence.')
    }
    elseif (@(Get-BulletLines -Section $iterationStrategy).Count -gt 1 -or
        @($iterationStrategy -split '\r?\n').Count -gt 2) {
        $warnings.Add('Iteration Strategy should be one sentence of attack order, not a step list.')
    }
}

$mandate = $sections['Agent Mandate']
foreach ($key in @('May decide', 'Must ask', 'Must not')) {
    if (-not (Test-MeaningfulValue -Value (Get-ListValue -Text $mandate -Key $key))) {
        $errors.Add("Agent Mandate requires a meaningful '$key' boundary.")
    }
}

foreach ($key in @('Evidence', 'Quality', 'Final report')) {
    if (-not (Test-MeaningfulValue -Value (
        Get-ListValue -Text $sections['Completion'] -Key $key
    ))) {
        $errors.Add("Completion requires a meaningful '$key' value.")
    }
}

$blockers = $sections['Blockers']
$blockerBullets = @(Get-BulletLines -Section $blockers)
$noneBlocker = $blockers -match '(?im)^-\s*None\.?\s*$'
if ($blockerBullets.Count -lt 1) {
    $errors.Add('Blockers requires an explicit None or an objective blocker.')
}
elseif ($status -eq 'Ready') {
    if (-not $noneBlocker -or $blockerBullets.Count -ne 1 -or
        $blockers.Trim() -notmatch '^- None\.?$') {
        $errors.Add('Ready requires Blockers to contain only "- None.".')
    }
}
elseif ($status -eq 'Blocked') {
    if ($noneBlocker) {
        $errors.Add('Blocked cannot declare that no blocker exists.')
    }
    $blockerType = Get-ListValue -Text $blockers -Key 'Blocker Type'
    if ($blockerType -notmatch '^(User decision|Permission|Credential|External prerequisite)$') {
        $errors.Add('Blocked requires an allowed Blocker Type.')
    }
    if (-not (Test-MeaningfulValue -Value (Get-ListValue -Text $blockers -Key 'Blocker'))) {
        $errors.Add('Blocked requires "- Blocker: <objective obstacle>".')
    }
    if (-not (Test-MeaningfulValue -Value (Get-ListValue -Text $blockers -Key 'Unblock when'))) {
        $errors.Add('Blocked requires "- Unblock when: <exact condition>".')
    }
}

$lineCount = @($content -split '\r?\n').Count
if ($lineCount -gt 180) {
    $errors.Add('Contract exceeds 180 lines and has become a Spec; split the Goal or move implementation detail out.')
}
elseif ($lineCount -gt 120) {
    $warnings.Add('Contract exceeds 120 lines; review whether implementation detail can be removed.')
}
if ($content.Length -gt 12000) {
    $warnings.Add('Contract exceeds 12,000 characters; prefer links to stable repository context over copied detail.')
}

if ($errors.Count -gt 0) {
    Write-Output "INVALID: $resolvedPath"
    foreach ($item in $errors) {
        Write-Output "ERROR: $item"
    }
    foreach ($item in $warnings) {
        Write-Output "WARNING: $item"
    }
    exit 1
}

Write-Output "VALID: $resolvedPath"
Write-Output 'FORMAT: AES Goal Contract B'
Write-Output "STATUS: $status"
Write-Output "AC_COUNT: $($acceptanceIds.Count)"
Write-Output "LINE_COUNT: $lineCount"
foreach ($item in $warnings) {
    Write-Output "WARNING: $item"
}
exit 0
