$ErrorActionPreference = "SilentlyContinue"

$ports = @(5173, 7474)
$stopped = @()

foreach ($port in $ports) {
    $processIds = Get-NetTCPConnection -LocalPort $port -State Listen |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($processId in $processIds) {
        if ($processId -and $processId -ne 0) {
            Stop-Process -Id $processId -Force
            $stopped += "${port}:${processId}"
        }
    }
}

if ($stopped.Count -eq 0) {
    Write-Output "no emiya dev ports were listening"
} else {
    Write-Output "stopped $($stopped -join ', ')"
}
