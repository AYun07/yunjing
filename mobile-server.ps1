$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8777
$enc = [Text.Encoding]::UTF8
$mimeMap = @{
    '.html' = 'text/html; charset=utf-8'; '.js' = 'application/javascript; charset=utf-8';
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png';
    '.ico' = 'image/x-icon'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml';
    '.webmanifest' = 'application/manifest+json'; '.txt' = 'text/plain; charset=utf-8'
}
$listener = $null
foreach ($p in @($port, 8778, 8779, 8780)) {
    try {
        $listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Any, $p)
        $listener.Start()
        $port = $p
        break
    } catch { $listener = $null }
}
if (-not $listener) { Write-Host '端口被占用且备用端口都失败,请关闭其他云境窗口后重试'; Read-Host '回车退出'; exit 1 }
Clear-Host
Write-Host '=============================================='
Write-Host '  云境工坊已启动 - 本窗口保持开着就是平台'
Write-Host ''
$lan = ''
Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | ForEach-Object {
    $ip = $_.IPAddress
    if ($ip -notlike '127.*' -and $ip -notlike '169.254.*') {
        Write-Host ("  手机(同一WiFi)打开:  http://" + $ip + ":" + $port)
        $lan = "http://" + $ip + ":" + $port
    }
}
Write-Host ("  本机电脑打开:  http://127.0.0.1:" + $port)
Write-Host '  关闭本窗口即退出。首次访问如防火墙提示,点"允许"。'
Write-Host '=============================================='
try { Start-Process ("http://127.0.0.1:" + $port) } catch { }
while ($true) {
    $client = $null
    try {
        $client = $listener.AcceptTcpClient()
        $client.NoDelay = $true
        $stream = $client.GetStream()
        $stream.ReadTimeout = 5000
        $buf = New-Object byte[] 16384
        $sb = New-Object Text.StringBuilder
        while (-not $sb.ToString().Contains("`r`n`r`n")) {
            $n = $stream.Read($buf, 0, $buf.Length)
            if ($n -le 0) { break }
            [void]$sb.Append($enc.GetString($buf, 0, $n))
            if ($sb.Length -gt 32768) { break }
        }
        $req = $sb.ToString()
        $line = ($req -split "`r`n")[0]
        $path = '/'
        if ($line -match '^[A-Z]+\s+(\S+)') { $path = $Matches[1] }
        $qi = $path.IndexOf('?')
        if ($qi -ge 0) { $path = $path.Substring(0, $qi) }
        $path = [Uri]::UnescapeDataString($path)
        if ($path -eq '/') { $path = '/index.html' }
        $file = Join-Path $root ($path -replace '/', '\')
        $code = '200 OK'
        if (-not (Test-Path $file -PathType Leaf)) {
            $code = '404 Not Found'
            $bytes = $enc.GetBytes('404 Not Found: ' + $path)
            $mime = 'text/plain; charset=utf-8'
        } else {
            $bytes = [IO.File]::ReadAllBytes($file)
            $ext = [IO.Path]::GetExtension($file).ToLower()
            $mime = 'application/octet-stream'
            if ($mimeMap.ContainsKey($ext)) { $mime = $mimeMap[$ext] }
        }
        $head = "HTTP/1.1 $code`r`nContent-Type: $mime`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`nCache-Control: no-cache`r`n`r`n"
        $hb = [Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($bytes, 0, $bytes.Length)
        $stream.Flush()
    } catch { }
    if ($client) { try { $client.Close() } catch { } }
}