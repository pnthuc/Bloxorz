param(
    [string]$OutputDirectory = $PSScriptRoot,
    [ValidateSet('result-tables', 'chart-notes', 'ucs-results')]
    [string[]]$Documents = @('result-tables', 'chart-notes')
)

$ErrorActionPreference = 'Stop'
$pandoc = (Get-Command pandoc -ErrorAction Stop).Source
$null = Get-Command xelatex -ErrorAction Stop
$outputPath = [IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Path $outputPath -Force | Out-Null

foreach ($name in $Documents) {
    $filterName = if ($name -eq 'ucs-results') { 'ucs-results-layout.lua' } else { 'page-layout.lua' }
    $layoutFilter = Join-Path $PSScriptRoot $filterName
    $markdown = Join-Path $PSScriptRoot "$name.md"
    $document = Join-Path $outputPath "$name.docx"
    $pdf = Join-Path $outputPath "$name.pdf"
    & $pandoc $markdown --from markdown --to docx --standalone --lua-filter $layoutFilter --output $document
    if ($LASTEXITCODE -ne 0) { throw "Pandoc Markdown -> DOCX failed: $name" }
    & $pandoc $document --from docx --standalone --lua-filter $layoutFilter --pdf-engine=xelatex `
        -V 'mainfont=Arial' -V 'sansfont=Arial' -V 'monofont=Consolas' `
        -V 'geometry:margin=1.7cm' -V 'fontsize=10pt' -V 'papersize=a4' `
        --output $pdf
    if ($LASTEXITCODE -ne 0) { throw "Pandoc DOCX -> XeLaTeX PDF failed: $name" }
    Write-Output "Created $document and $pdf"
}
