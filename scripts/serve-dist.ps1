param(
    [int]$Port = 5501,
    [string]$Root = "dist",
    [switch]$OpenBrowser
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$rootPath = Join-Path $projectRoot $Root

if (-not (Test-Path $rootPath -PathType Container)) {
    throw "No existe la carpeta de salida: $rootPath"
}

$rootPath = (Resolve-Path $rootPath).Path

$mimeTypes = @{
    ".html" = "text/html"
    ".css"  = "text/css"
    ".js"   = "text/javascript"
    ".mjs"  = "text/javascript"
    ".json" = "application/json"
    ".map"  = "application/json"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".gif"  = "image/gif"
    ".svg"  = "image/svg+xml"
    ".ico"  = "image/x-icon"
    ".webp" = "image/webp"
    ".woff" = "font/woff"
    ".woff2" = "font/woff2"
    ".ttf"  = "font/ttf"
    ".txt"  = "text/plain"
    ".xml"  = "application/xml"
}

function Get-MimeType {
    param([string]$Path)

    $extension = [IO.Path]::GetExtension($Path).ToLowerInvariant()
    if ($mimeTypes.ContainsKey($extension)) {
        return $mimeTypes[$extension]
    }

    return "application/octet-stream"
}

function Send-FileResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [string]$FilePath
    )

    $bytes = [IO.File]::ReadAllBytes($FilePath)
    $mimeType = Get-MimeType -Path $FilePath

    $Response.StatusCode = 200
    $Response.ContentType = $mimeType
    $Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    $Response.Headers["Pragma"] = "no-cache"
    $Response.Headers["Expires"] = "0"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

function Send-TextResponse {
    param(
        [System.Net.HttpListenerResponse]$Response,
        [int]$StatusCode,
        [string]$Message
    )

    $bytes = [Text.Encoding]::UTF8.GetBytes($Message)
    $Response.StatusCode = $StatusCode
    $Response.ContentType = "text/plain; charset=utf-8"
    $Response.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0"
    $Response.Headers["Pragma"] = "no-cache"
    $Response.Headers["Expires"] = "0"
    $Response.ContentLength64 = $bytes.Length
    $Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $Response.OutputStream.Close()
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

function Test-LocalServerUp {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Method Get -TimeoutSec 2
        return ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500)
    }
    catch {
        return $false
    }
}

if (Test-LocalServerUp -Url $prefix) {
    Write-Host "Servidor listo en $prefix (ya activo)"
    Write-Host "Sirviendo carpeta: $rootPath (instancia existente)"
    return
}

try {
    $listener.Start()
}
catch {
    throw "No se pudo iniciar el servidor en $prefix. Error: $($_.Exception.Message)"
}

Write-Host "Servidor listo en $prefix"
Write-Host "Sirviendo carpeta: $rootPath"
Write-Host "Presiona Ctrl+C para detener."

if ($OpenBrowser) {
    Start-Process $prefix | Out-Null
}

try {
    while ($listener.IsListening) {
        try {
            $context = $listener.GetContext()
        }
        catch [System.Net.HttpListenerException] {
            break
        }
        catch {
            Write-Warning "Error leyendo solicitud: $($_.Exception.Message)"
            continue
        }

        $requestPath = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath)
        if ([string]::IsNullOrWhiteSpace($requestPath) -or $requestPath -eq "/") {
            $requestPath = "/index.html"
        }

        $relativePath = $requestPath.TrimStart("/") -replace "/", "\"
        $candidatePath = [IO.Path]::GetFullPath((Join-Path $rootPath $relativePath))

        if (-not $candidatePath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase)) {
            Send-TextResponse -Response $context.Response -StatusCode 403 -Message "403 Forbidden"
            continue
        }

        if (Test-Path $candidatePath -PathType Leaf) {
            Send-FileResponse -Response $context.Response -FilePath $candidatePath
            continue
        }

        # Keep SPA fallback only for extension-less client routes.
        if ([IO.Path]::HasExtension($relativePath)) {
            Send-TextResponse -Response $context.Response -StatusCode 404 -Message "404 Not Found"
            continue
        }

        $indexPath = Join-Path $rootPath "index.html"
        if (Test-Path $indexPath -PathType Leaf) {
            Send-FileResponse -Response $context.Response -FilePath $indexPath
        }
        else {
            Send-TextResponse -Response $context.Response -StatusCode 404 -Message "404 Not Found"
        }
    }
}
finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
    $listener.Close()
}
