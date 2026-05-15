#Requires -Version 5.1
<#
.SYNOPSIS
  Baixa dados do TSE e gera tse-voter-data.json com perfil do eleitorado.
.NOTES
  Executar a partir da raiz do monorepo:
    powershell -ExecutionPolicy Bypass -File .\scripts\generate-tse-voters.ps1
  Requer ~250 MB de espaco temporario em $env:TEMP.
  Dados fonte: TSE -- Perfil do Eleitorado por Secao Eleitoral (Atual).
#>
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Configuracoes
$UFS = @('AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT',
    'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO', 'ZZ')

$CDN_BASE = "https://cdn.tse.jus.br/estatistica/sead/odsele/perfil_eleitor_secao"
$TEMP_DIR = Join-Path $env:TEMP "tse_voters"
$OUTPUT_JSON = Join-Path $PSScriptRoot "..\apps\web\src\lib\geo\tse-voter-data.json"

# Mapeamento faixa etaria -> grupo agregado
$AGE_MAP = @{
    '"15 anos"'          = 'a16'
    '"16 anos"'          = 'a16'
    '"17 anos"'          = 'a16'
    '"18 anos"'          = 'a18'
    '"19 anos"'          = 'a18'
    '"20 anos"'          = 'a18'
    '"21 a 24 anos"'     = 'a18'
    '"25 a 29 anos"'     = 'a25'
    '"30 a 34 anos"'     = 'a25'
    '"35 a 39 anos"'     = 'a35'
    '"40 a 44 anos"'     = 'a35'
    '"45 a 49 anos"'     = 'a45'
    '"50 a 54 anos"'     = 'a45'
    '"55 a 59 anos"'     = 'a45'
    '"60 a 64 anos"'     = 'a60'
    '"65 a 69 anos"'     = 'a60'
    '"70 a 74 anos"'     = 'a70'
    '"75 a 79 anos"'     = 'a70'
    '"80 a 84 anos"'     = 'a80'
    '"85 a 89 anos"'     = 'a80'
    '"90 a 94 anos"'     = 'a80'
    '"95 a 99 anos"'     = 'a80'
    '"100 anos ou mais"' = 'a80'
}

Add-Type -AssemblyName System.IO.Compression.FileSystem

# Helpers
function Get-AgeGroup([string]$raw) {
    if ($AGE_MAP.ContainsKey($raw)) { return $AGE_MAP[$raw] }
    return $null
}

# Main
$null = New-Item -ItemType Directory -Force -Path $TEMP_DIR | Out-Null

# acumulador global: chave = "UF:CODE"
$data = [System.Collections.Generic.Dictionary[string, object]]::new()

foreach ($uf in $UFS) {
    $zipPath = Join-Path $TEMP_DIR "tse_$uf.zip"
    $url = "$CDN_BASE/perfil_eleitor_secao_ATUAL_$uf.zip"

    Write-Host "[$uf] Baixando..." -ForegroundColor Cyan

    if (-not (Test-Path $zipPath)) {
        try {
            Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
        }
        catch {
            Write-Warning "[$uf] Erro ao baixar. Pulando."
            continue
        }
    }
    else {
        Write-Host "[$uf] Cache local OK." -ForegroundColor DarkGray
    }

    Write-Host "[$uf] Processando CSV..." -ForegroundColor Yellow

    $zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
    $csvEntry = $zip.Entries | Where-Object { $_.Name -like "*.csv" } | Select-Object -First 1
    if (-not $csvEntry) {
        Write-Warning "[$uf] Sem CSV no ZIP. Pulando."
        $zip.Dispose()
        continue
    }

    $stream = $csvEntry.Open()
    $enc = [System.Text.Encoding]::GetEncoding("iso-8859-1")
    $reader = New-Object System.IO.StreamReader($stream, $enc)

    $cols = ($reader.ReadLine() -split ";")
    $idxUF = [Array]::IndexOf($cols, '"SG_UF"')
    $idxCod = [Array]::IndexOf($cols, '"CD_MUNICIPIO"')
    $idxNome = [Array]::IndexOf($cols, '"NM_MUNICIPIO"')
    $idxGenero = [Array]::IndexOf($cols, '"DS_GENERO"')
    $idxFaixa = [Array]::IndexOf($cols, '"DS_FAIXA_ETARIA"')
    $idxQty = [Array]::IndexOf($cols, '"QT_ELEITORES"')

    if ($idxUF -lt 0 -or $idxCod -lt 0 -or $idxNome -lt 0 -or $idxGenero -lt 0 -or $idxFaixa -lt 0 -or $idxQty -lt 0) {
        Write-Warning "[$uf] Colunas nao encontradas. Pulando."
        $reader.Dispose(); $stream.Dispose(); $zip.Dispose()
        continue
    }

    $lineCount = 0
    while (-not $reader.EndOfStream) {
        $lineCount++
        $parts = $reader.ReadLine() -split ";"
        if ($parts.Count -le $idxQty) { continue }

        $stUF = $parts[$idxUF].Trim('"')
        $code = $parts[$idxCod].Trim('"')
        $nome = $parts[$idxNome].Trim('"')
        $genero = $parts[$idxGenero]
        $faixa = $parts[$idxFaixa]
        $qtyStr = $parts[$idxQty].Trim('"') -replace '\D', ''
        if ([string]::IsNullOrEmpty($qtyStr)) { continue }
        $qty = [int]$qtyStr

        $key = "${stUF}:${code}"

        if (-not $data.ContainsKey($key)) {
            $data[$key] = [ordered]@{
                uf = ''; code = ''; name = ''; total = 0; m = 0; f = 0; n = 0
                a16 = 0; a18 = 0; a25 = 0; a35 = 0; a45 = 0; a60 = 0; a70 = 0; a80 = 0
            }
        }

        $rec = $data[$key]
        $rec.uf = $stUF
        $rec.code = $code
        $rec.name = $nome
        $rec.total += $qty

        if ($genero -eq '"MASCULINO"') { $rec.m += $qty }
        elseif ($genero -eq '"FEMININO"') { $rec.f += $qty }
        else { $rec.n += $qty }

        if ($AGE_MAP.ContainsKey($faixa)) { $rec[$AGE_MAP[$faixa]] += $qty }
    }

    $reader.Dispose(); $stream.Dispose(); $zip.Dispose()
    Write-Host "[$uf] $lineCount linhas, $($data.Count) municipios total." -ForegroundColor Green

    # Gravar JSON incremental apos cada estado (permite uso de dados parciais)
    $objInc = [ordered]@{}
    foreach ($kvp in $data.GetEnumerator()) { $objInc[$kvp.Key] = $kvp.Value }
    $jsonInc = $objInc | ConvertTo-Json -Depth 3 -Compress
    $outPathInc = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OUTPUT_JSON)
    [System.IO.File]::WriteAllText($outPathInc, $jsonInc, [System.Text.Encoding]::UTF8)
}

# Gerar JSON
$outputPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OUTPUT_JSON)
$kb = [math]::Round((Get-Item $outputPath).Length / 1KB, 0)
Write-Host "`nArquivo gerado: $outputPath ($kb KB)" -ForegroundColor Green
Write-Host "Concluido. $($data.Count) municipios processados." -ForegroundColor Green
