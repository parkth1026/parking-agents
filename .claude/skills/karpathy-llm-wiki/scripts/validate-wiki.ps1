# Wiki Validation Script v4 - Comprehensive 8-Dimension Check
# Usage: .\validate-wiki.ps1 -WikiPath "path/to/wiki" [-ConfigPath "path/to/config.json"]
param(
    [Parameter(Mandatory=$true)][string]$WikiPath,
    [string]$ConfigPath
)

Write-Host "=== Wiki Validation Script v4 ===" -ForegroundColor Cyan
if (-not (Test-Path $WikiPath)) { Write-Error "Wiki path does not exist: $WikiPath"; exit 1 }

# Load config (optional — use defaults if not provided)
$maxLines = 200
$minOutboundLinks = 2
$minScore = 9.0
$weights = @{
    brokenLinks = 0.25; selfReferences = 0.10; orphanPages = 0.10
    indexCompleteness = 0.15; frontmatter = 0.15; pageSize = 0.10
    outboundLinks = 0.10; tagCompliance = 0.05
}

if ($ConfigPath -and (Test-Path $ConfigPath)) {
    $config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($config.page.maxLines) { $maxLines = $config.page.maxLines }
    if ($config.page.minOutboundLinks) { $minOutboundLinks = $config.page.minOutboundLinks }
    if ($config.scoring.minScore) { $minScore = $config.scoring.minScore }
    if ($config.scoring.weights) {
        $w = $config.scoring.weights
        if ($w.brokenLinks) { $weights.brokenLinks = $w.brokenLinks }
        if ($w.selfReferences) { $weights.selfReferences = $w.selfReferences }
        if ($w.orphanPages) { $weights.orphanPages = $w.orphanPages }
        if ($w.indexCompleteness) { $weights.indexCompleteness = $w.indexCompleteness }
        if ($w.frontmatter) { $weights.frontmatter = $w.frontmatter }
        if ($w.pageSize) { $weights.pageSize = $w.pageSize }
        if ($w.outboundLinks) { $weights.outboundLinks = $w.outboundLinks }
        if ($w.tagCompliance) { $weights.tagCompliance = $w.tagCompliance }
    }
}

# Collect all .md files (excluding SCHEMA.md, index.md, log.md, and raw/ directory)
$allFiles = Get-ChildItem -Path $WikiPath -Recurse -Filter "*.md" | Where-Object {
    $_.Name -notin @("SCHEMA.md", "index.md", "log.md") -and
    $_.FullName -notmatch '[/\\]raw[/\\]'
}
$totalPages = $allFiles.Count
Write-Host "Found $totalPages wiki pages" -ForegroundColor Green

if ($totalPages -eq 0) {
    Write-Host "No wiki pages found. Nothing to validate." -ForegroundColor Yellow
    exit 0
}

# Load SCHEMA.md for tag taxonomy
$validTags = @()
$schemaPath = Join-Path $WikiPath "SCHEMA.md"
if (Test-Path $schemaPath) {
    $schemaContent = Get-Content $schemaPath -Raw -Encoding UTF8
    $tagMatches = [regex]::Matches($schemaContent, '^\s*-\s+(\S+)', [System.Text.RegularExpressions.RegexOptions]::Multiline)
    foreach ($m in $tagMatches) {
        $tag = $m.Groups[1].Value.Trim()
        if ($tag -match '^[a-z][a-z0-9\-]+$') { $validTags += $tag }
    }
}

# Load index.md for completeness check
$indexedPages = @()
$indexPath = Join-Path $WikiPath "index.md"
if (Test-Path $indexPath) {
    $indexContent = Get-Content $indexPath -Raw -Encoding UTF8
    $indexLinks = [regex]::Matches($indexContent, '\[\[([^\]]+)\]\]')
    foreach ($m in $indexLinks) { $indexedPages += $m.Groups[1].Value }
}

# === Dimension 1: Broken Links ===
$brokenLinks = @()
$selfReferences = @()
$allPageNames = @{}
$inboundCount = @{}
$outboundCount = @{}

foreach ($file in $allFiles) {
    $allPageNames[$file.BaseName] = $file.FullName
    $inboundCount[$file.BaseName] = 0
}

foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $links = [regex]::Matches($content, '\[\[([^\]]+)\]\]')
    $outbound = 0

    foreach ($link in $links) {
        $linkText = $link.Groups[1].Value

        # Dimension 2: Self References
        if ($linkText -eq $file.BaseName) {
            $selfReferences += @{File=$file.Name; Link=$linkText}
            continue
        }

        $outbound++

        # Check if link target exists
        $found = $false
        $searchDirs = @("entities", "concepts", "sources", "comparisons", "queries", "details", "scratch", "patterns", "")
        foreach ($dir in $searchDirs) {
            $targetPath = if ($dir) { Join-Path $WikiPath "$dir\$linkText.md" } else { Join-Path $WikiPath "$linkText.md" }
            if (Test-Path $targetPath) { $found = $true; break }
        }

        if ($found) {
            if ($inboundCount.ContainsKey($linkText)) { $inboundCount[$linkText]++ }
        } else {
            $brokenLinks += @{File=$file.Name; Link=$linkText}
        }
    }
    $outboundCount[$file.BaseName] = $outbound
}

# === Dimension 3: Orphan Pages ===
$orphanPages = @()
foreach ($page in $allPageNames.Keys) {
    if ($inboundCount[$page] -eq 0) {
        $orphanPages += $page
    }
}

# === Dimension 4: Index Completeness ===
$missingFromIndex = @()
foreach ($page in $allPageNames.Keys) {
    if ($page -notin $indexedPages) {
        $missingFromIndex += $page
    }
}

# === Dimension 5: Frontmatter Validity ===
$requiredFields = @("title", "type", "tags")
$frontmatterIssues = @()
foreach ($file in $allFiles) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if ($content -notmatch '^---\s*\r?\n') {
        $frontmatterIssues += @{File=$file.Name; Issue="Missing frontmatter"}
        continue
    }
    $fmMatch = [regex]::Match($content, '^---\s*\r?\n(.*?)\r?\n---', [System.Text.RegularExpressions.RegexOptions]::Singleline)
    if (-not $fmMatch.Success) {
        $frontmatterIssues += @{File=$file.Name; Issue="Malformed frontmatter"}
        continue
    }
    $fm = $fmMatch.Groups[1].Value
    foreach ($field in $requiredFields) {
        if ($fm -notmatch "(?m)^${field}:") {
            $frontmatterIssues += @{File=$file.Name; Issue="Missing field: $field"}
        }
    }
}

# === Dimension 6: Page Size ===
$oversizedPages = @()
foreach ($file in $allFiles) {
    $lineCount = (Get-Content $file.FullName -Encoding UTF8).Count
    if ($lineCount -gt $maxLines) {
        $oversizedPages += @{File=$file.Name; Lines=$lineCount; Max=$maxLines}
    }
}

# === Dimension 7: Outbound Links ===
$underlinkedPages = @()
foreach ($page in $outboundCount.Keys) {
    if ($outboundCount[$page] -lt $minOutboundLinks) {
        $underlinkedPages += @{Page=$page; Count=$outboundCount[$page]; Min=$minOutboundLinks}
    }
}

# === Dimension 8: Tag Compliance ===
$invalidTags = @()
if ($validTags.Count -gt 0) {
    foreach ($file in $allFiles) {
        $content = Get-Content $file.FullName -Raw -Encoding UTF8
        $fmMatch = [regex]::Match($content, '^---\s*\r?\n(.*?)\r?\n---', [System.Text.RegularExpressions.RegexOptions]::Singleline)
        if ($fmMatch.Success) {
            $fm = $fmMatch.Groups[1].Value
            $tagLine = [regex]::Match($fm, '(?m)^tags:\s*\[([^\]]*)\]')
            if ($tagLine.Success) {
                $tags = $tagLine.Groups[1].Value -split ',' | ForEach-Object { $_.Trim().Trim('"').Trim("'") }
                foreach ($tag in $tags) {
                    if ($tag -and $tag -notin $validTags) {
                        $invalidTags += @{File=$file.Name; Tag=$tag}
                    }
                }
            }
        }
    }
}

# === Scoring ===
$dimScores = @{}

# Broken links: 10 if 0, proportional penalty otherwise
$dimScores.brokenLinks = if ($brokenLinks.Count -eq 0) { 10 } else {
    $totalLinks = $brokenLinks.Count + ($allFiles | ForEach-Object {
        ([regex]::Matches((Get-Content $_.FullName -Raw -Encoding UTF8), '\[\[([^\]]+)\]\]')).Count
    } | Measure-Object -Sum).Sum
    if ($totalLinks -gt 0) { [Math]::Max(0, 10 * (1 - ($brokenLinks.Count / $totalLinks))) } else { 10 }
}

# Self references: 10 if 0, 0 otherwise
$dimScores.selfReferences = if ($selfReferences.Count -eq 0) { 10 } else { 0 }

# Orphan pages: proportional
$dimScores.orphanPages = if ($totalPages -eq 0) { 10 } else {
    [Math]::Max(0, 10 * (1 - ($orphanPages.Count / $totalPages)))
}

# Index completeness: proportional
$dimScores.indexCompleteness = if ($totalPages -eq 0) { 10 } else {
    10 * (($totalPages - $missingFromIndex.Count) / $totalPages)
}

# Frontmatter: proportional (count pages with issues, not total issues)
$pagesWithFmIssues = ($frontmatterIssues | ForEach-Object { $_.File } | Sort-Object -Unique).Count
$dimScores.frontmatter = if ($totalPages -eq 0) { 10 } else {
    10 * (($totalPages - $pagesWithFmIssues) / $totalPages)
}

# Page size: proportional
$dimScores.pageSize = if ($totalPages -eq 0) { 10 } else {
    10 * (($totalPages - $oversizedPages.Count) / $totalPages)
}

# Outbound links: proportional
$dimScores.outboundLinks = if ($totalPages -eq 0) { 10 } else {
    10 * (($totalPages - $underlinkedPages.Count) / $totalPages)
}

# Tag compliance: proportional (10 if no schema or no invalid tags)
$dimScores.tagCompliance = if ($validTags.Count -eq 0 -or $invalidTags.Count -eq 0) { 10 } else {
    $pagesWithBadTags = ($invalidTags | ForEach-Object { $_.File } | Sort-Object -Unique).Count
    10 * (($totalPages - $pagesWithBadTags) / $totalPages)
}

# Weighted total
$totalScore = 0
foreach ($dim in $weights.Keys) {
    $totalScore += $dimScores[$dim] * $weights[$dim]
}

# === Output Report ===
Write-Host "`n=== Dimension Scores ===" -ForegroundColor Cyan
$dimOrder = @("brokenLinks","selfReferences","orphanPages","indexCompleteness","frontmatter","pageSize","outboundLinks","tagCompliance")
$dimLabels = @{
    brokenLinks="Broken Links"; selfReferences="Self References"; orphanPages="Orphan Pages"
    indexCompleteness="Index Completeness"; frontmatter="Frontmatter"; pageSize="Page Size"
    outboundLinks="Outbound Links"; tagCompliance="Tag Compliance"
}

foreach ($dim in $dimOrder) {
    $score = [Math]::Round($dimScores[$dim], 1)
    $w = [Math]::Round($weights[$dim] * 100)
    $color = if ($score -ge 9) { "Green" } elseif ($score -ge 7) { "Yellow" } else { "Red" }
    Write-Host ("  {0,-22} {1,5}/10  (weight: {2}%)" -f $dimLabels[$dim], $score, $w) -ForegroundColor $color
}

Write-Host "`n=== Issues ===" -ForegroundColor Cyan

if ($brokenLinks.Count -gt 0) {
    Write-Host "  Broken Links ($($brokenLinks.Count)):" -ForegroundColor Red
    $brokenLinks | ForEach-Object { Write-Host "    $($_.File) -> [[$($_.Link)]]" -ForegroundColor Red }
}

if ($selfReferences.Count -gt 0) {
    Write-Host "  Self References ($($selfReferences.Count)):" -ForegroundColor Red
    $selfReferences | ForEach-Object { Write-Host "    $($_.File) -> [[$($_.Link)]]" -ForegroundColor Red }
}

if ($orphanPages.Count -gt 0) {
    Write-Host "  Orphan Pages ($($orphanPages.Count)):" -ForegroundColor Yellow
    $orphanPages | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
}

if ($missingFromIndex.Count -gt 0) {
    Write-Host "  Missing from Index ($($missingFromIndex.Count)):" -ForegroundColor Yellow
    $missingFromIndex | ForEach-Object { Write-Host "    $_" -ForegroundColor Yellow }
}

if ($frontmatterIssues.Count -gt 0) {
    Write-Host "  Frontmatter Issues ($($frontmatterIssues.Count)):" -ForegroundColor Yellow
    $frontmatterIssues | ForEach-Object { Write-Host "    $($_.File): $($_.Issue)" -ForegroundColor Yellow }
}

if ($oversizedPages.Count -gt 0) {
    Write-Host "  Oversized Pages ($($oversizedPages.Count)):" -ForegroundColor Yellow
    $oversizedPages | ForEach-Object { Write-Host "    $($_.File): $($_.Lines) lines (max: $($_.Max))" -ForegroundColor Yellow }
}

if ($underlinkedPages.Count -gt 0) {
    Write-Host "  Under-linked Pages ($($underlinkedPages.Count)):" -ForegroundColor Yellow
    $underlinkedPages | ForEach-Object { Write-Host "    $($_.Page): $($_.Count) links (min: $($_.Min))" -ForegroundColor Yellow }
}

if ($invalidTags.Count -gt 0) {
    Write-Host "  Invalid Tags ($($invalidTags.Count)):" -ForegroundColor Yellow
    $invalidTags | ForEach-Object { Write-Host "    $($_.File): tag '$($_.Tag)' not in SCHEMA.md" -ForegroundColor Yellow }
}

# === Final Score ===
Write-Host "`n=== Final Score ===" -ForegroundColor Cyan
$totalRounded = [Math]::Round($totalScore, 1)
$scoreColor = if ($totalRounded -ge 9) { "Green" } elseif ($totalRounded -ge 7) { "Yellow" } else { "Red" }
Write-Host "  Total: $totalRounded / 10" -ForegroundColor $scoreColor
Write-Host "  Threshold: $minScore / 10" -ForegroundColor White
Write-Host "  Status: $(if ($totalRounded -ge $minScore -and $brokenLinks.Count -eq 0) { 'PASS' } else { 'FAIL' })" -ForegroundColor $(if ($totalRounded -ge $minScore -and $brokenLinks.Count -eq 0) { "Green" } else { "Red" })

# Exit code
if ($totalRounded -ge $minScore -and $brokenLinks.Count -eq 0) { exit 0 } else { exit 1 }
