$ErrorActionPreference = 'Stop'
$modelDirectory = Join-Path $PSScriptRoot 'models'
$manifest = Get-Content (Join-Path $modelDirectory 'manifest.json') -Raw | ConvertFrom-Json
foreach ($model in $manifest.models) {
    $target = Join-Path $modelDirectory $model.file
    if ((Test-Path -LiteralPath $target) -and ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -eq $model.sha256)) {
        Write-Output "Verified: $($model.file)"
        continue
    }
    $partial = "$target.partial"
    Invoke-WebRequest -Uri $model.url -OutFile $partial -UseBasicParsing
    if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $model.sha256) {
        throw "Model checksum mismatch: $($model.file)"
    }
    Move-Item -LiteralPath $partial -Destination $target -Force
    Write-Output "Downloaded and verified: $($model.file)"
}
