# EpicAssistant.psm1 - Query Epic Games UE5 Official Knowledge Base
# Uses the dev.epicgames.com community assistant API (SSE streaming)
# Uses curl.exe to bypass Cloudflare challenge (Invoke-WebRequest gets blocked)

$script:BaseApiUrl = "https://dev.epicgames.com/community/api"
$script:UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"
$script:CookieFile = Join-Path $env:TEMP "epic_assistant_cookies.txt"

function Get-EpicCsrfToken {
    <#
    .SYNOPSIS
    Obtains a CSRF token from Epic Games API via curl.
    Returns the public CSRF token string, or $null on failure.
    #>
    $url = "$script:BaseApiUrl/csrf_protection/token.json"

    $output = & curl.exe -s -c $script:CookieFile `
        $url -X POST `
        -H "User-Agent: $script:UserAgent" `
        -H "Content-Type: application/json" `
        -H "Accept: application/json" `
        -H "Origin: https://dev.epicgames.com" `
        -H "Referer: https://dev.epicgames.com/community/assistant/unreal-engine" `
        -d '{"create_csrf_token_request":"true"}' 2>&1

    try {
        $json = $output | ConvertFrom-Json
        if ($json.public_csrf_token) {
            return $json.public_csrf_token
        }
    }
    catch {
        Write-Warning "Failed to parse CSRF response: $_"
    }

    Write-Warning "Failed to get CSRF token. Response: $output"
    return $null
}

function Invoke-EpicAssistantQuery {
    <#
    .SYNOPSIS
    Sends a question to Epic's UE5 AI assistant and returns the parsed response.

    .PARAMETER Question
    The question to ask about Unreal Engine.

    .PARAMETER Application
    The application context. Default: "unreal_engine"

    .PARAMETER ConversationId
    Optional conversation ID for follow-up questions.

    .PARAMETER TimeoutSec
    Request timeout in seconds. Default: 60

    .OUTPUTS
    Hashtable with keys: AgentAnswer, HtmlAnswer, References, ConversationId, Error
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Question,

        [string]$Application = "unreal_engine",

        [string]$ConversationId,

        [int]$TimeoutSec = 120
    )

    # Step 1: Get CSRF token
    $csrfToken = Get-EpicCsrfToken
    if (-not $csrfToken) {
        return @{ Error = "Failed to obtain CSRF token" }
    }

    # Step 2: Build request body
    $bodyObj = @{ content = $Question; application = $Application; format = "html" }
    if ($ConversationId) {
        $bodyObj.conversation_id = $ConversationId.ToUpper()
    }
    $bodyJson = $bodyObj | ConvertTo-Json -Compress

    # Step 3: Send question via curl (SSE response)
    $url = "$script:BaseApiUrl/assistant/questions"
    $bodyFile = Join-Path $env:TEMP "epic_assistant_body.json"
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($bodyFile, $bodyJson, $utf8NoBom)

    $outputFile = Join-Path $env:TEMP "epic_assistant_response.txt"

    & curl.exe -s -b $script:CookieFile -c $script:CookieFile `
        $url -X POST `
        -H "User-Agent: $script:UserAgent" `
        -H "Content-Type: application/json" `
        -H "Accept: text/event-stream" `
        -H "Origin: https://dev.epicgames.com" `
        -H "Referer: https://dev.epicgames.com/community/assistant/unreal-engine" `
        -H "PUBLIC-CSRF-TOKEN: $csrfToken" `
        -d "@$bodyFile" `
        --max-time $TimeoutSec `
        -o $outputFile 2>&1 | Out-Null

    $raw = [System.IO.File]::ReadAllText($outputFile, [System.Text.Encoding]::UTF8)

    if (-not $raw -or $raw.Length -lt 10) {
        return @{ Error = "Empty response from Epic Assistant API" }
    }

    return ParseSSEResponse $raw
}

function ParseSSEResponse {
    param([string]$Raw)

    $result = @{
        ConversationId   = $null
        ConversationName = $null
        QuestionId       = $null
        AnswerId         = $null
        AgentAnswer      = ""
        HtmlAnswer       = ""
        References       = @()
        Error            = $null
    }

    # Split by double newline (SSE event boundary)
    $events = $Raw -split "\n\n"

    foreach ($event in $events) {
        $eventType = $null
        $eventData = $null

        foreach ($line in ($event -split "\n")) {
            if ($line -match "^event:\s*(.+)$") {
                $eventType = $Matches[1].Trim()
            }
            elseif ($line -match "^data:\s*(.+)$") {
                $eventData = $Matches[1].Trim()
            }
        }

        if (-not $eventType -or -not $eventData) { continue }

        try {
            $data = $eventData | ConvertFrom-Json -ErrorAction SilentlyContinue
        }
        catch { continue }

        switch ($eventType) {
            "conversation_loaded" {
                $result.ConversationId = $data.id
                $result.ConversationName = $data.name
            }
            "question_created" {
                $result.QuestionId = $data.id
            }
            "answer_created" {
                $result.AnswerId = $data.id
            }
            "reference" {
                $result.References += @{
                    Title       = $data.title
                    Url         = $data.content
                    Description = $data.description
                    Type        = $data.type
                }
            }
            "agent_code" {
                $result.AgentAnswer = $data.content
            }
            "answer_update" {
                $result.HtmlAnswer = $data.content
            }
        }
    }

    return $result
}

function Get-EpicUEAnswer {
    <#
    .SYNOPSIS
    High-level function: ask a UE5 question and get a clean markdown answer.

    .PARAMETER Question
    The UE5 question to ask.

    .OUTPUTS
    String - the markdown answer text, or $null on failure.
    #>
    [CmdletBinding()]
    param(
        [Parameter(Mandatory)]
        [string]$Question
    )

    $response = Invoke-EpicAssistantQuery -Question $Question

    if ($response.Error) {
        Write-Warning "Epic Assistant error: $($response.Error)"
        return $null
    }

    # Prefer agent_code (markdown), fall back to html answer
    if ($response.AgentAnswer) {
        return $response.AgentAnswer
    }
    elseif ($response.HtmlAnswer) {
        return $response.HtmlAnswer
    }

    return $null
}

Export-ModuleMember -Function Get-EpicCsrfToken, Invoke-EpicAssistantQuery, Get-EpicUEAnswer
