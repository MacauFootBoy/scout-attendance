$data = Import-Csv -Path "optimized_salary.csv"

$output = @()

foreach ($row in $data) {
    # 轉換 "-" 為 0
    $photo = $row.Photo; if ($photo -eq "-") { $photo = "0" }
    $video = $row.Video; if ($video -eq "-") { $video = "0" }
    $other = $row.Other; if ($other -eq "-") { $other = "0" }
    $total = $row.Total; if ($total -eq "-") { $total = "0" }
    $unpaid = $row.Unpaid; if ($unpaid -eq "-") { $unpaid = "0" }
    
    # 轉換為小數
    $photoVal = [decimal]$photo
    $videoVal = [decimal]$video
    $otherVal = [decimal]$other
    $totalVal = [decimal]$total
    $unpaidVal = [decimal]$unpaid
    
    # 計算
    $paidVal = $totalVal - $unpaidVal
    $status = if ($unpaidVal -eq 0) { "Paid" } else { "Unpaid" }
    
    $output += [PSCustomObject]@{
        Year = $row.Year
        Month = $row.Month
        Photo = $photoVal.ToString("0.00")
        Video = $videoVal.ToString("0.00")
        Other = $otherVal.ToString("0.00")
        Total = $totalVal.ToString("0.00")
        Unpaid = $unpaidVal.ToString("0.00")
        Paid = $paidVal.ToString("0.00")
        PaymentStatus = $status
    }
}

$output | Export-Csv -Path "improved_salary.csv" -NoTypeInformation -Encoding UTF8
Write-Host "Created improved_salary.csv"