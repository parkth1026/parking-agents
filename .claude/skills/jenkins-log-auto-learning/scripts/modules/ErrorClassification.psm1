# Error Classification Module

function Get-ErrorClassification {
    param(
        [string]$ErrorCode,
        [string]$ErrorMessage,
        [string]$FilePath
    )
    
    $classification = @{
        ErrorType = "Unknown"
        ErrorCategory = "Unknown"
        RootCause = "Unknown"
    }
    
    if ($ErrorCode -match "^C\d+$") {
        $classification.ErrorCategory = "Compile"
        if ($ErrorCode -eq "C2061") {
            $classification.ErrorType = "Syntax"
            $classification.RootCause = "IdentifierUndefined"
        }
        elseif ($ErrorCode -eq "C1083") {
            $classification.ErrorType = "MissingHeader"
            $classification.RootCause = "DependencyIssue"
        }
    }
    elseif ($ErrorCode -match "^LNK\d+$") {
        $classification.ErrorCategory = "Link"
        if ($ErrorCode -eq "LNK2019") {
            $classification.ErrorType = "UnresolvedExternal"
            $classification.RootCause = "MissingImplementation"
        }
    }
    
    return $classification
}

Export-ModuleMember -Function Get-ErrorClassification
