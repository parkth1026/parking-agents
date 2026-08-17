$ErrorActionPreference='SilentlyContinue'
$samples = (Get-Counter '\Processor(_Total)\% Processor Time','\Process(Idle)\% Processor Time').CounterSamples
foreach ($s in $samples) { Write-Output ($s.Path + '=' + $s.CookedValue) }
