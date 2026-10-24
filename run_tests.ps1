$port = 8899
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()

$workspace = "D:\sohail-smit-hackathon-projects\Smit-First-Hackathon-Project"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"

# Launch Chrome to the HTTP server
$proc = Start-Process -FilePath $chromePath -ArgumentList "--headless=new --disable-gpu http://localhost:$port/tests.html" -PassThru

$testReport = $null
$running = $true

while ($running) {
    $context = $listener.GetContext()
    $req = $context.Request
    $res = $context.Response

    $urlPath = $req.Url.AbsolutePath

    if ($req.HttpMethod -eq "POST" -and $urlPath -eq "/results") {
        $reader = New-Object System.IO.StreamReader($req.InputStream)
        $testReport = $reader.ReadToEnd()
        $reader.Close()

        $buf = [System.Text.Encoding]::UTF8.GetBytes("OK")
        $res.ContentLength64 = $buf.Length
        $res.OutputStream.Write($buf, 0, $buf.Length)
        $res.Close()
        $running = $false
        break
    }

    # Serve static files
    $localFile = $req.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($localFile)) { $localFile = "tests.html" }
    $fullPath = Join-Path $workspace $localFile

    if (Test-Path $fullPath) {
        $bytes = [System.IO.File]::ReadAllBytes($fullPath)
        if ($fullPath.EndsWith(".html")) { $res.ContentType = "text/html" }
        elseif ($fullPath.EndsWith(".js")) { $res.ContentType = "application/javascript" }
        elseif ($fullPath.EndsWith(".css")) { $res.ContentType = "text/css" }
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.Close()
    } else {
        $res.StatusCode = 404
        $res.Close()
    }
}

$listener.Stop()
$listener.Close()

if (-not $proc.HasExited) {
    $proc.Kill()
}

Write-Output "--- TEST RESULTS RECEIVED ---"
Write-Output $testReport
