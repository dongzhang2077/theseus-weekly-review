param(
  [Parameter(Mandatory = $true)][string]$Url,
  [Parameter(Mandatory = $true)][string]$OutputPath,
  [Parameter(Mandatory = $true)][int]$Width,
  [Parameter(Mandatory = $true)][int]$Height,
  [string]$ClickLabel = "",
  [int]$Port = 9223
)

$targetUrl = "http://127.0.0.1:$Port/json/new?$([Uri]::EscapeDataString($Url))"
$target = Invoke-RestMethod -Method Put -Uri $targetUrl
$socket = [System.Net.WebSockets.ClientWebSocket]::new()
$null = $socket.ConnectAsync(
  [Uri]$target.webSocketDebuggerUrl,
  [Threading.CancellationToken]::None
).GetAwaiter().GetResult()
$nextId = 0

function Invoke-Cdp {
  param(
    [Parameter(Mandatory = $true)][string]$Method,
    [hashtable]$Params = @{}
  )

  $script:nextId += 1
  $requestId = $script:nextId
  $payload = @{
    id = $requestId
    method = $Method
    params = $Params
  } | ConvertTo-Json -Compress -Depth 10
  $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
  $segment = [ArraySegment[byte]]::new($bytes)
  $null = $socket.SendAsync(
    $segment,
    [System.Net.WebSockets.WebSocketMessageType]::Text,
    $true,
    [Threading.CancellationToken]::None
  ).GetAwaiter().GetResult()

  while ($true) {
    $stream = [IO.MemoryStream]::new()
    do {
      $buffer = New-Object byte[] 65536
      $result = $socket.ReceiveAsync(
        [ArraySegment[byte]]::new($buffer),
        [Threading.CancellationToken]::None
      ).GetAwaiter().GetResult()
      $stream.Write($buffer, 0, $result.Count)
    } while (-not $result.EndOfMessage)

    $message = [Text.Encoding]::UTF8.GetString($stream.ToArray()) |
      ConvertFrom-Json
    if ($message.id -eq $requestId) {
      if ($message.error) {
        throw "CDP $Method failed: $($message.error.message)"
      }
      return $message.result
    }
  }
}

$null = Invoke-Cdp -Method "Emulation.setDeviceMetricsOverride" -Params @{
  width = $Width
  height = $Height
  deviceScaleFactor = 1
  mobile = $false
}
$null = Invoke-Cdp -Method "Page.enable"
$null = Invoke-Cdp -Method "Page.navigate" -Params @{ url = $Url }
Start-Sleep -Milliseconds 900

if ($ClickLabel) {
  $labelJson = $ClickLabel | ConvertTo-Json -Compress
  $expression = @"
[...document.querySelectorAll('button')].find(
  button => button.getAttribute('aria-label') === $labelJson ||
    button.textContent.trim() === $labelJson
)?.click()
"@
  $null = Invoke-Cdp -Method "Runtime.evaluate" -Params @{
    expression = $expression
    returnByValue = $true
  }
  Start-Sleep -Milliseconds 300
}

$capture = Invoke-Cdp -Method "Page.captureScreenshot" -Params @{
  format = "png"
  fromSurface = $true
  captureBeyondViewport = $false
}
[IO.File]::WriteAllBytes(
  $OutputPath,
  [Convert]::FromBase64String($capture.data)
)

$null = $socket.CloseAsync(
  [System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure,
  "done",
  [Threading.CancellationToken]::None
).GetAwaiter().GetResult()
