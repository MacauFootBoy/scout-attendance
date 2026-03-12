$rawData = Get-Content -Path "raw_data.txt" -Raw
$lines = $rawData -split "`n" | Where-Object { $_ -match '\d+\s+\$' }

$output = @()

foreach ($line in $lines) {
    # 清理行
    $line = $line.Trim()
    
    # 匹配月份數字
    if ($line -match '^(\d+)\s+\$') {
        $month = $matches[1]
        
        # 提取三個年度的數據
        # 模式：$ 金額 $ 金額 $ 金額 $ 金額 $ 金額
        $pattern = '\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)\s+\$ ([0-9,.-]+)'
        
        $matchesList = [regex]::Matches($line, $pattern)
        
        if ($matchesList.Count -eq 3) {
            # 年度1 (推測2026)
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
            
            # 年度2 (推測2025)
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
            
            # 年度3 (推測2024)
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

# 輸出到CSV
$output | Export-Csv -Path "optimized_salary.csv" -NoTypeInformation -Encoding UTF8

Write-Host "轉換完成！共 $(@($output).Count) 筆記錄"