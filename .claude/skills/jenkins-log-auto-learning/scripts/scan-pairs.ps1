<#
.SYNOPSIS
    Jenkins build pre-scan: pull all builds, find adjacent FAILURE->SUCCESS pairs
.DESCRIPTION
    Reads config.json enabled jobs, pulls all builds from Jenkins API.
    Pairs logic: FAILURE and SUCCESS must be ADJACENT (ignoring ABORTED/NOT_BUILT only).
    Consecutive FAILURES followed by a SUCCESS = ONE group.
    No cross-FAILURE pairing allowed.
.PARAMETER ConfigPath
    config.json path (default: ../config.json)
.PARAMETER OutputPath
    Output path (default: ../tmp/pending-pairs.json)
#>
param(
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\config.json"),
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\tmp\pending-pairs.json")
)

$ErrorActionPreference = "Stop"

$config = Get-Content $ConfigPath -Encoding UTF8 | ConvertFrom-Json
$baseUrl = $config.jenkins.baseUrl
$trackFile = $config.trackFile
$enabledJobs = $config.jobs | Where-Object { $_.enabled -eq $true }

if (Test-Path $trackFile) {
    $track = Get-Content $trackFile -Encoding UTF8 -Raw | ConvertFrom-Json
} else {
    $track = @{ last_analyzed = @{}; analyzed = @{}; runHistory = @() } | ConvertFrom-Json
}

$tmpDir = Split-Path $OutputPath -Parent
if (-not (Test-Path $tmpDir)) { New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null }

$allPairs = @()
$totalBuilds = 0
$totalFailures = 0
$totalSuccess = 0
$totalSkipped = 0

foreach ($job in $enabledJobs) {
    $jobPath = $job.path
    $jobName = $job.name
    Write-Host "`n--- Scanning: $jobName ($jobPath) ---"

    $url = "$baseUrl/$jobPath/api/json?tree=allBuilds[number,result,timestamp,duration]{0,500}"
    try {
        $raw = curl.exe -s $url --globoff --max-time 30
        $resp = $raw | ConvertFrom-Json
    } catch {
        Write-Host "  WARN: Cannot access $jobPath, skipping"
        continue
    }

    $builds = $resp.allBuilds | Sort-Object number
    if (-not $builds) {
        Write-Host "  (no builds)"
        continue
    }

    Write-Host "  Builds: $($builds.Count) (#$($builds[0].number) ~ #$($builds[-1].number))"

    # Phase 1: Record SUCCESS / ABORTED / NOT_BUILT quickly
    foreach ($build in $builds) {
        $key = "$jobPath#$($build.number)"
        $totalBuilds++

        if ($track.analyzed.PSObject.Properties.Name -contains $key) {
            continue
        }

        $result = $build.result
        if ($null -eq $result) { $result = "BUILDING" }

        switch ($result) {
            "SUCCESS" {
                if ($track.analyzed.PSObject.Properties.Name -contains $key) {
                    $track.analyzed.$key = "success:w=?"
                } else {
                    $track.analyzed | Add-Member -NotePropertyName $key -NotePropertyValue "success:w=?"
                }
                $totalSuccess++
            }
            { $_ -in "ABORTED", "NOT_BUILT", "BUILDING", "null" } {
                if ($track.analyzed.PSObject.Properties.Name -contains $key) {
                    $track.analyzed.$key = "skip:$result"
                } else {
                    $track.analyzed | Add-Member -NotePropertyName $key -NotePropertyValue "skip:$result"
                }
                $totalSkipped++
            }
            "FAILURE" {
                $totalFailures++
            }
        }
    }

    # Phase 2: Find ADJACENT FAILURE->SUCCESS pairs
    # Core logic: scan build list, group consecutive FAILURES (ignoring ABORTED/NOT_BUILT)
    # When a SUCCESS follows a FAILURE group, that is ONE pair.
    # A FAILURE not followed directly by SUCCESS = no fix found.
    
    # Filter to only FAILURE and SUCCESS (skip ABORTED etc for pairing)
    $meaningful = $builds | Where-Object { $_.result -eq "FAILURE" -or $_.result -eq "SUCCESS" }
    
    $i = 0
    while ($i -lt $meaningful.Count) {
        $current = $meaningful[$i]
        
        if ($current.result -eq "FAILURE") {
            # Start collecting consecutive FAILURE group
            $failGroup = @($current.number)
            $j = $i + 1
            
            while ($j -lt $meaningful.Count -and $meaningful[$j].result -eq "FAILURE") {
                $failGroup += $meaningful[$j].number
                $j++
            }
            
            # Check what follows: is it a SUCCESS?
            if ($j -lt $meaningful.Count -and $meaningful[$j].result -eq "SUCCESS") {
                $fixBuild = $meaningful[$j].number
                
                # Check if already analyzed
                $firstKey = "$jobPath#$($failGroup[0])"
                if ($track.analyzed.PSObject.Properties.Name -notcontains $firstKey) {
                    $allPairs += @{
                        jobName    = $jobName
                        jobPath    = $jobPath
                        failBuilds = $failGroup
                        fixBuild   = $fixBuild
                        hasFix     = $true
                    }
                }
            } else {
                # No SUCCESS follows this FAILURE group = no fix found
                # Still record them so they don't pile up
                foreach ($fb in $failGroup) {
                    $key = "$jobPath#$fb"
                    if ($track.analyzed.PSObject.Properties.Name -notcontains $key) {
                        $track.analyzed | Add-Member -NotePropertyName $key -NotePropertyValue "failure:no-fix-found"
                    }
                }
            }
            
            $i = $j
        } else {
            # SUCCESS with no preceding FAILURE in current position = standalone, already recorded
            $i++
        }
    }

    $jobPairCount = ($allPairs | Where-Object { $_.jobPath -eq $jobPath }).Count
    Write-Host "  FAILURE->SUCCESS pairs: $jobPairCount"
}

# Output
$output = @{
    generatedAt   = (Get-Date -Format "yyyy-MM-ddTHH:mm:ss")
    totalBuilds   = $totalBuilds
    totalFailures = $totalFailures
    totalPairs    = $allPairs.Count
    pairs         = $allPairs
} | ConvertTo-Json -Depth 5

[System.IO.File]::WriteAllText($OutputPath, $output, [System.Text.Encoding]::UTF8)
Write-Host "`n=== DONE ==="
Write-Host "Pairs file: $OutputPath"
Write-Host "Total builds: $totalBuilds | FAILURE: $totalFailures | Adjacent pairs: $($allPairs.Count)"

[System.IO.File]::WriteAllText($trackFile, ($track | ConvertTo-Json -Depth 10), [System.Text.Encoding]::UTF8)
Write-Host "Tracking updated"