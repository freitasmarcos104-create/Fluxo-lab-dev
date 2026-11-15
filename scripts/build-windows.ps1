$ErrorActionPreference = 'Stop'

$desktopPath = Join-Path $PSScriptRoot '..\desktop'
Set-Location $desktopPath

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js/npm não foi encontrado. Instale Node.js 22 e abra o PowerShell novamente.'
}

Write-Host 'Instalando dependências do Fluxo Lab...'
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'Falha ao instalar dependências.' }

Write-Host 'Gerando instalador Windows...'
npm run dist:win
if ($LASTEXITCODE -ne 0) { throw 'Falha ao gerar o instalador.' }

Write-Host "Concluído. Confira: $(Join-Path $desktopPath 'dist')"
