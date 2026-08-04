$baseUrl = "http://10.66.12.40"
$tmpDir = "C:\Users\Administrator\.openclaw-autoclaw\skills\jenkins-log-auto-learning\tmp\builds"
$builds = @(310, 316, 326, 331)
foreach ($n in $builds) {
    $url = "${baseUrl}/job/wdp-ue/job/Earth/job/twe-ue5.5-installed/$n/api/json?tree=changeSet[items[commitId,msg,affectedPaths,author[fullName]]]"
    $outFile = "$tmpDir\changeset-$n.json"
    Write-Host "Fetching changeSet for #$n..."
    curl.exe -s $url --globoff -o $outFile
    $raw = Get-Content $outFile -Raw -ErrorAction SilentlyContinue
    if ($raw -and $raw.StartsWith("{")) {
        $json = $raw | ConvertFrom-Json
        $items = $json.changeSet.items
        if ($items -and $items.Count -gt 0) {
            Write-Host "  #$n : $($items.Count) commits"
            foreach ($item in $items) {
                Write-Host "    commit=$($item.commitId) author=$($item.author.fullName)"
                Write-Host "    msg=$($item.msg)"
                Write-Host "    paths=$($item.affectedPaths -join ', ')"
            }
        } else {
            Write-Host "  #$n : changeSet empty"
        }
    } else {
        Write-Host "  #$n : Failed to parse"
    }
}
