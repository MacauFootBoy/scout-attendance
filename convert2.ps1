$rawData = Get-Content -Path "raw_data.txt" -Raw
$lines = $rawData -split "`n" | Where-Object { $_ -match '\d+\s+\$' }

$output = @()

foreach ($line in $lines) {
    $line = $line.Trim()
    
    if ($line -match '^(\d+)\s+\$') {
        $month = $matches[1]
        
        # 提取三個年度的數據
        $pattern = '\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)'
        
        $matchesList = [regex]::Matches($line, $pattern)
        
        if ($matchesList.Count -eq 3) {
            # Year 1 (2026)
            $y1 = $matchesList[0].Groups
            $output += [PSCustomObject]@{
                Year = 2026
                Month = $month
                Photo = $y1[1].Value -replace ',',''
                Video = $y1[2].Value -replace ',',''
                Other = $y1[3].Value -replace ',',''
                Total = $y1[4].Value -replace ',',''
                Unpaid = $y1[5].Value -replace ',',''
            }
            
            # Year 2 (2025)
            $y2 = $matchesList[1].Groups
            $output += [PSCustomObject]@{
                Year = 2025
                Month = $month
                Photo = $y2[1].Value -replace ',',''
                Video = $y2[2].Value -replace ',',''
                Other = $y2[3].Value -replace ',',''
                Total = $y2[4].Value -replace ',',''
                Unpaid = $y2[5].Value -replace ',',''
            }
            
            # Year 3 (2024)
            $y3 = $matchesList[2].Groups
            $output += [PSCustomObject]@{
                Year = 2024
                Month = $month
                Photo = $y3[1].Value -replace ',',''
                Video = $y3[2].Value -replace ',',''
                Other = $y3[3].Value -replace ',',''
                Total = $y3[4].Value -replace ',',''
                Unpaid = $y3[5].Value -replace ',',''
            }
        }
    }
}

$output | Export-Csv -Path "optimized_salary.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Conversion complete! $($output.Count) records"