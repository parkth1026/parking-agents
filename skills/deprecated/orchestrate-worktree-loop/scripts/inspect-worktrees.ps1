[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string[]]$Path,

    [string]$IntegrationBranch = 'dev',

    [switch]$Json
)

$ErrorActionPreference = 'Stop'

function Invoke-GitText {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,

        [switch]$AllowFailure
    )

    # Capture native stderr as data. With ErrorActionPreference=Stop,
    # redirecting it to $null can still surface a non-zero probe as a
    # terminating ErrorRecord before -AllowFailure sees the exit code.
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $nativeOutput = & git -C $Repository @Arguments 2>&1
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }
    if ($exitCode -ne 0 -and -not $AllowFailure) {
        throw "git -C '$Repository' $($Arguments -join ' ') failed with exit code $exitCode"
    }

    $output = @($nativeOutput | Where-Object {
        $_ -isnot [System.Management.Automation.ErrorRecord]
    })

    [pscustomobject]@{
        ExitCode = $exitCode
        Text = (($output | Out-String).Trim())
    }
}

function Test-GitOperation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Repository,

        [Parameter(Mandatory = $true)]
        [string]$GitPath
    )

    $resolved = Invoke-GitText -Repository $Repository -Arguments @('rev-parse', '--git-path', $GitPath)
    Test-Path -LiteralPath $resolved.Text
}

$normalizedPaths = foreach ($pathArgument in $Path) {
    foreach ($candidate in ($pathArgument -split '[;,]')) {
        $trimmed = $candidate.Trim().Trim("'", '"')
        if ($trimmed) {
            $trimmed
        }
    }
}

$rows = foreach ($rawPath in $normalizedPaths) {
    $repository = (Resolve-Path -LiteralPath $rawPath).Path
    $inside = Invoke-GitText -Repository $repository -Arguments @('rev-parse', '--is-inside-work-tree')
    if ($inside.Text -ne 'true') {
        throw "Not a Git worktree: $repository"
    }

    $branchResult = Invoke-GitText -Repository $repository -Arguments @('branch', '--show-current')
    $headResult = Invoke-GitText -Repository $repository -Arguments @('rev-parse', 'HEAD')
    $upstreamResult = Invoke-GitText -Repository $repository -Arguments @('rev-parse', '--abbrev-ref', '@{upstream}') -AllowFailure
    $statusResult = Invoke-GitText -Repository $repository -Arguments @('status', '--porcelain=v1', '--untracked-files=all')
    $lastCommit = Invoke-GitText -Repository $repository -Arguments @('log', '-1', '--pretty=format:%H%x09%s%x09%cI')

    $ahead = $null
    $behind = $null
    if ($upstreamResult.ExitCode -eq 0 -and $upstreamResult.Text) {
        $counts = Invoke-GitText -Repository $repository -Arguments @('rev-list', '--left-right', '--count', "$($upstreamResult.Text)...HEAD")
        $parts = $counts.Text -split '\s+'
        if ($parts.Count -ge 2) {
            $behind = [int]$parts[0]
            $ahead = [int]$parts[1]
        }
    }

    $dirty = [bool]$statusResult.Text
    $integrationRef = "refs/heads/$IntegrationBranch"
    $integrationExists = (Invoke-GitText -Repository $repository -Arguments @('show-ref', '--verify', '--quiet', $integrationRef) -AllowFailure).ExitCode -eq 0
    $headMergedToIntegration = $null
    if ($integrationExists) {
        $headMergedToIntegration = (Invoke-GitText -Repository $repository -Arguments @('merge-base', '--is-ancestor', $headResult.Text, $integrationRef) -AllowFailure).ExitCode -eq 0
    }

    $operation = @()
    if (Test-GitOperation -Repository $repository -GitPath 'MERGE_HEAD') { $operation += 'merge' }
    if (Test-GitOperation -Repository $repository -GitPath 'REBASE_HEAD') { $operation += 'rebase' }
    if (Test-GitOperation -Repository $repository -GitPath 'CHERRY_PICK_HEAD') { $operation += 'cherry-pick' }
    if ($operation.Count -eq 0) { $operation = @('none') }

    $commitParts = $lastCommit.Text -split "`t", 3
    [pscustomobject]@{
        path = $repository
        branch = if ($branchResult.Text) { $branchResult.Text } else { '(detached)' }
        head = $headResult.Text
        headShort = $headResult.Text.Substring(0, [Math]::Min(8, $headResult.Text.Length))
        subject = if ($commitParts.Count -ge 2) { $commitParts[1] } else { '' }
        committedAt = if ($commitParts.Count -ge 3) { $commitParts[2] } else { '' }
        dirty = $dirty
        changedEntries = if ($statusResult.Text) { @($statusResult.Text -split "`r?`n").Count } else { 0 }
        upstream = if ($upstreamResult.ExitCode -eq 0) { $upstreamResult.Text } else { $null }
        ahead = $ahead
        behind = $behind
        integrationBranch = $IntegrationBranch
        integrationExists = $integrationExists
        headMergedToIntegration = $headMergedToIntegration
        deliverableMergedToIntegration = if ($dirty) { $false } else { $headMergedToIntegration }
        gitOperation = ($operation -join ',')
    }
}

if ($Json) {
    $rows | ConvertTo-Json -Depth 4
} else {
    $rows | Format-Table path, branch, headShort, dirty, changedEntries, upstream, ahead, behind, headMergedToIntegration, deliverableMergedToIntegration, gitOperation -AutoSize
}
