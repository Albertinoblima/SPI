param(
    [string]$DocsDir = "docs"
)

$ErrorActionPreference = "Stop"

$pandoc = Get-Command pandoc -ErrorAction SilentlyContinue
if (-not $pandoc) {
    Write-Error "Pandoc nao encontrado no PATH. Instale o pandoc para gerar PDFs de documentacao."
}

$docBases = @(
    "apresentacao_sistema",
    "dashboard_detalhado",
    "modelo_relatorio_pesquisa"
)

foreach ($base in $docBases) {
    $mdPath = Join-Path $DocsDir ("$base.md")
    $pdfPath = Join-Path $DocsDir ("$base.pdf")

    if (-not (Test-Path $mdPath)) {
        Write-Warning "Arquivo markdown nao encontrado: $mdPath"
        continue
    }

    Write-Host "Gerando $pdfPath a partir de $mdPath ..."
    pandoc "$mdPath" -o "$pdfPath"
}

Write-Host "Concluido. PDFs atualizados em $DocsDir."
