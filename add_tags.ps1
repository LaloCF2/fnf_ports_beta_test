$path = "index.html"
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

$pattern = '(?s)<div\s+class="mod-card"\s+data-gama="([^"]+)"([^>]*)>'

$evaluator = [System.Text.RegularExpressions.MatchEvaluator] {
    param($m)
    $gama = $m.Groups[1].Value
    $rest = $m.Groups[2].Value
    
    if ($rest -match "data-engine") {
        return $m.Value
    }
    
    $ram = "2GB RAM"
    if ($gama -eq "mid") { $ram = "3GB RAM" }
    if ($gama -eq "mid-high" -or $gama -eq "high") { $ram = "4GB RAM" }
    
    return "<div class=`"mod-card`" data-gama=`"$gama`" data-engine=`"Psych Engine`" data-ram=`"$ram`" data-size=`"300 MB`"$rest>"
}

$newContent = [System.Text.RegularExpressions.Regex]::Replace($content, $pattern, $evaluator)

[System.IO.File]::WriteAllText($path, $newContent, [System.Text.Encoding]::UTF8)
Write-Host "Updated index.html with new attributes!"
