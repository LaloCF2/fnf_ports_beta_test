# =====================================================================
# Generador de iconos de FNF' Ports
# ---------------------------------------------------------------------
# Lee todos los .svg de assets/iconos/<carpeta>/ y crea js/modules/icons.js,
# que mete los iconos dentro de la página (así cargan al instante, funcionan
# sin internet y toman el color del tema).
#
# Para agregar o cambiar un icono:
#   1. Pon tu archivo .svg en assets/iconos/<carpeta>/nombre.svg
#      (de 24x24, con trazo: stroke="currentColor", sin colores fijos).
#   2. Clic derecho en este archivo → "Ejecutar con PowerShell"
#      (o en la terminal:  powershell -ExecutionPolicy Bypass -File tools\generar-iconos.ps1)
#   3. En el código úsalo por su nombre:  FNF.fi('nombre')  o  <i data-fi="nombre"></i>
# =====================================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'assets\iconos'
$out = Join-Path $root 'js\modules\icons.js'

$symbols = @()
$nombres = @()
$porCarpeta = @()
foreach ($dir in Get-ChildItem $src -Directory | Sort-Object Name) {
  $lista = @()
  foreach ($f in Get-ChildItem $dir.FullName -Filter *.svg | Sort-Object Name) {
    $name = $f.BaseName.ToLower() -replace '[^a-z0-9-]', ''
    if ($nombres -contains $name) { Write-Warning "Icono repetido: $name ($($dir.Name)) — se usa el primero"; continue }
    $svg = [IO.File]::ReadAllText($f.FullName)
    $m = [regex]::Match($svg, '<svg[^>]*>([\s\S]*)</svg>')
    if (-not $m.Success) { Write-Warning "No es un SVG válido: $($f.FullName)"; continue }
    $vb = [regex]::Match($svg, 'viewBox="([^"]+)"')
    $viewBox = if ($vb.Success) { $vb.Groups[1].Value } else { '0 0 24 24' }
    $inner = ($m.Groups[1].Value -replace '\s+', ' ').Trim()
    $symbols += "<symbol id=""i-$name"" viewBox=""$viewBox"">$inner</symbol>"
    $nombres += $name
    $lista += $name
  }
  $porCarpeta += "  // $($dir.Name): $($lista -join ', ')"
}

$sprite = ('<svg width="0" height="0" style="position:absolute" aria-hidden="true">' + ($symbols -join '') + '</svg>') -replace "'", "\'"
$js = @"
// GENERADO por tools/generar-iconos.ps1 a partir de assets/iconos/ — no lo edites a mano.
// Iconos propios (estilo de línea, inspirados en Feather/Lucide, licencias MIT/ISC).
$($porCarpeta -join "`n")
(() => {
  document.body.insertAdjacentHTML('afterbegin', '$sprite');
  window.ICONOS = $(ConvertTo-Json @($nombres) -Compress);
})();
"@
[IO.File]::WriteAllText($out, $js + "`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Listo: $($nombres.Count) iconos en js/modules/icons.js"
