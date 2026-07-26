[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateScript({ Test-Path -LiteralPath $_ -PathType Leaf })]
    [string]$InputPath,

    [Parameter(Mandatory = $true)]
    [string]$OutputPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)

if ($resolvedInput -eq $resolvedOutput) {
    throw "Eingabe und Ausgabe müssen unterschiedliche Dateien sein."
}

if (Test-Path -LiteralPath $resolvedOutput) {
    throw "Die Ausgabedatei existiert bereits: $resolvedOutput"
}

$extension = [System.IO.Path]::GetExtension($resolvedOutput).ToLowerInvariant()
if ($extension -notin @(".png", ".jpg", ".jpeg")) {
    throw "Unterstützte Ausgabeformate sind PNG und JPEG."
}

$outputDirectory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and
    -not (Test-Path -LiteralPath $outputDirectory -PathType Container)) {
    New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$source = $null
$bitmap = $null
$graphics = $null
$font = $null
$plateBrush = $null
$textBrush = $null

try {
    $source = [System.Drawing.Image]::FromFile($resolvedInput)
    $bitmap = [System.Drawing.Bitmap]::new(
        $source.Width,
        $source.Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CompositingQuality =
        [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.InterpolationMode =
        [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode =
        [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.TextRenderingHint =
        [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $graphics.DrawImage($source, 0, 0, $source.Width, $source.Height)

    $label = "KI-generiert"
    $fontSize = [Math]::Max(14, [Math]::Ceiling($source.Height * 0.03))
    $font = [System.Drawing.Font]::new(
        "Segoe UI Semibold",
        [single]$fontSize,
        [System.Drawing.FontStyle]::Regular,
        [System.Drawing.GraphicsUnit]::Pixel
    )

    $textSize = $graphics.MeasureString($label, $font)
    $padding = [Math]::Max(8, [Math]::Ceiling($source.Height * 0.0125))
    $margin = [Math]::Max(12, [Math]::Ceiling($source.Height * 0.02))
    $plateWidth = [Math]::Ceiling($textSize.Width + (2 * $padding))
    $plateHeight = [Math]::Ceiling($textSize.Height + (2 * $padding))
    $plateX = $source.Width - $margin - $plateWidth
    $plateY = $source.Height - $margin - $plateHeight

    if ($plateX -lt $margin -or $plateY -lt $margin) {
        throw "Das Bild ist zu klein für eine gut lesbare Kennzeichnung."
    }

    # Weiß auf deckendem Dunkelpetrol bietet deutlich mehr als 4,5:1 Kontrast.
    $plateBrush = [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::FromArgb(242, 11, 57, 57)
    )
    $textBrush = [System.Drawing.SolidBrush]::new(
        [System.Drawing.Color]::White
    )
    $graphics.FillRectangle(
        $plateBrush,
        $plateX,
        $plateY,
        $plateWidth,
        $plateHeight
    )
    $graphics.DrawString(
        $label,
        $font,
        $textBrush,
        [single]($plateX + $padding),
        [single]($plateY + $padding)
    )

    if ($extension -eq ".png") {
        $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    else {
        $jpegEncoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
            Where-Object { $_.MimeType -eq "image/jpeg" } |
            Select-Object -First 1
        $encoderParameters =
            [System.Drawing.Imaging.EncoderParameters]::new(1)
        $encoderParameters.Param[0] =
            [System.Drawing.Imaging.EncoderParameter]::new(
                [System.Drawing.Imaging.Encoder]::Quality,
                [long]95
            )
        try {
            $bitmap.Save($resolvedOutput, $jpegEncoder, $encoderParameters)
        }
        finally {
            $encoderParameters.Dispose()
        }
    }

    Write-Output "Kennzeichnung eingefügt: $resolvedOutput"
}
finally {
    if ($textBrush) { $textBrush.Dispose() }
    if ($plateBrush) { $plateBrush.Dispose() }
    if ($font) { $font.Dispose() }
    if ($graphics) { $graphics.Dispose() }
    if ($bitmap) { $bitmap.Dispose() }
    if ($source) { $source.Dispose() }
}
