$data = Import-Csv -Path "optimized_salary.csv"

$enhanced = @()
$cumulativeUnpaid = 0

foreach ($row in $data) {
    # 轉換 "-" 為 0
    $photo = if ($row.Photo -eq "-" -or $row.Photo -eq "") { "0" } else { $row.Photo }
    $video = if ($row.Video -eq "-" -or $row.Video -eq "") { "0" } else { $row.Video }
    $other = if ($row.Other -eq "-" -or $row.Other -eq "") { "0" } else { $row.Other }
    $total = if ($row.Total -eq "-" -or $row.Total -eq "") { "0" } else { $row.Total }
    $unpaid = if ($row.Unpaid -eq "-" -or $row.Unpaid -eq "") { "0" } else { $row.Unpaid }
    
    # 轉換為數值
    $photoVal = [decimal]$photo
    $videoVal = [decimal]$video
    $otherVal = [decimal]$other
    $totalVal = [decimal]$total
    $unpaidVal = [decimal]$unpaid
    
    # 計算已付金額
    $paidVal = $totalVal - $unpaidVal
    
    # 付款狀態
    $status = if ($unpaidVal -eq 0) { "Paid" } elseif ($unpaidVal -eq $totalVal) { "Unpaid" } else { "Partial" }
    
    # 類別百分比
    $photoPct = if ($totalVal -gt 0) { ($photoVal / $totalVal).ToString("P1") } else { "0%" }
    $videoPct = if ($totalVal -gt 0) { ($videoVal / $totalVal).ToString("P1") } else { "0%" }
    $otherPct = if ($totalVal -gt 0) { ($otherVal / $totalVal).ToString("P1") } else { "0%" }
    
    # 累積未付
    $cumulativeUnpaid += $unpaidVal
    
    # Year-Month 用於排序
    $yearMonth = "$($row.Year)-$($row.Month.PadLeft(2, '0'))"
    
    $enhanced += [PSCustomObject]@{
        Year = $row.Year
        Month = $row.Month
        YearMonth = $yearMonth
        Photo = $photoVal.ToString("0.00")
        Video = $videoVal.ToString("0.00")
        Other = $otherVal.ToString("0.00")
        Total = $totalVal.ToString("0.00")
        Unpaid = $unpaidVal.ToString("0.00")
        Paid = $paidVal.ToString("0.00")
        PaymentStatus = $status
        PhotoPercentage = $photoPct
        VideoPercentage = $videoPct
        OtherPercentage = $otherPct
        CumulativeUnpaid = $cumulativeUnpaid.ToString("0.00")
    }
}

$enhanced | Export-Csv -Path "enhanced_salary.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Enhanced CSV created with $($enhanced.Count) records"