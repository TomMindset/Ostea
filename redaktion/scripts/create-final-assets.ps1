[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$BaseImagePath,

    [Parameter(Mandatory = $true)]
    [string]$PackagePath,

    [Parameter(Mandatory = $true)]
    [string]$OutputDirectory,

    [Parameter(Mandatory = $true)]
    [string]$ManifestPath,

    [bool]$PhotoLabelRequired = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$baseImageFile = (Resolve-Path -LiteralPath $BaseImagePath).Path
$packageFile = (Resolve-Path -LiteralPath $PackagePath).Path
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$manifestFile = [System.IO.Path]::GetFullPath($ManifestPath)
$cleanRoot = Join-Path $outputRoot ".clean"

[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null
[System.IO.Directory]::CreateDirectory($cleanRoot) | Out-Null

$package = Get-Content -Raw -LiteralPath $packageFile | ConvertFrom-Json
$slides = @($package.payload.instagram.slides)
if ($slides.Count -lt 6 -or $slides.Count -gt 8) {
    throw "Das Instagram-Carousel muss sechs bis acht Folien enthalten."
}

$title = [string]$package.title
if ([string]::IsNullOrWhiteSpace($title)) {
    throw "Der Beitragstitel fehlt."
}

function New-Canvas {
    param([int]$Width, [int]$Height)

    $bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
    $bitmap.SetResolution(96, 96)
    return $bitmap
}

function Set-Quality {
    param([System.Drawing.Graphics]$Graphics)

    $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
}

function Draw-CoverCrop {
    param(
        [System.Drawing.Graphics]$Graphics,
        [System.Drawing.Image]$Image,
        [int]$Width,
        [int]$Height
    )

    $targetRatio = $Width / $Height
    $sourceRatio = $Image.Width / $Image.Height
    if ($sourceRatio -gt $targetRatio) {
        $sourceHeight = $Image.Height
        $sourceWidth = [int][Math]::Round($sourceHeight * $targetRatio)
        $sourceX = [int][Math]::Round(($Image.Width - $sourceWidth) / 2)
        $sourceY = 0
    }
    else {
        $sourceWidth = $Image.Width
        $sourceHeight = [int][Math]::Round($sourceWidth / $targetRatio)
        $sourceX = 0
        $sourceY = [int][Math]::Round(($Image.Height - $sourceHeight) / 2)
    }
    $destination = [System.Drawing.Rectangle]::new(0, 0, $Width, $Height)
    $source = [System.Drawing.Rectangle]::new(
        $sourceX,
        $sourceY,
        $sourceWidth,
        $sourceHeight
    )
    $Graphics.DrawImage(
        $Image,
        $destination,
        $source.X,
        $source.Y,
        $source.Width,
        $source.Height,
        [System.Drawing.GraphicsUnit]::Pixel
    )
}

function Save-Jpeg {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Path,
        [long]$Quality = 90
    )

    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
        Where-Object { $_.MimeType -eq "image/jpeg" } |
        Select-Object -First 1
    $parameters = [System.Drawing.Imaging.EncoderParameters]::new(1)
    $parameters.Param[0] = [System.Drawing.Imaging.EncoderParameter]::new(
        [System.Drawing.Imaging.Encoder]::Quality,
        $Quality
    )
    try {
        $Bitmap.Save($Path, $codec, $parameters)
    }
    finally {
        $parameters.Dispose()
    }
}

function Draw-TextBlock {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [System.Drawing.RectangleF]$Bounds,
        [System.Drawing.StringAlignment]$Alignment = [System.Drawing.StringAlignment]::Near
    )

    $format = [System.Drawing.StringFormat]::new()
    try {
        $format.Alignment = $Alignment
        $format.LineAlignment = [System.Drawing.StringAlignment]::Near
        $format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
        $Graphics.DrawString($Text, $Font, $Brush, $Bounds, $format)
    }
    finally {
        $format.Dispose()
    }
}

function Add-AiLabel {
    param([string]$CleanPath, [string]$FinalPath)

    & (Join-Path $PSScriptRoot "add-ai-label.ps1") `
        -InputPath $CleanPath `
        -OutputPath $FinalPath
}

$assets = [System.Collections.Generic.List[object]]::new()
$baseImage = [System.Drawing.Image]::FromFile($baseImageFile)
try {
    $websiteClean = Join-Path $cleanRoot "website-hero.jpg"
    $websiteFinal = Join-Path $outputRoot "website-hero.jpg"
    $websiteBitmap = New-Canvas -Width 1536 -Height 864
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($websiteBitmap)
        try {
            Set-Quality -Graphics $graphics
            Draw-CoverCrop -Graphics $graphics -Image $baseImage -Width 1536 -Height 864
        }
        finally {
            $graphics.Dispose()
        }
        Save-Jpeg -Bitmap $websiteBitmap -Path $websiteClean -Quality 90
    }
    finally {
        $websiteBitmap.Dispose()
    }
    if ($PhotoLabelRequired) {
        Add-AiLabel -CleanPath $websiteClean -FinalPath $websiteFinal
    }
    else {
        Copy-Item -LiteralPath $websiteClean -Destination $websiteFinal -Force
    }
    $assets.Add([pscustomobject]@{
        fileName = "website-hero.jpg"
        channel = "website"
        role = "hero"
        position = 1
        altText = "Ruhiges redaktionelles OSTEA-Motiv zum Thema $title."
        expectedText = if ($PhotoLabelRequired) { @("KI-generiert") } else { @() }
        aiGenerated = $true
        labelRequired = $PhotoLabelRequired
    })

    $facebookClean = Join-Path $cleanRoot "facebook-preview.jpg"
    $facebookFinal = Join-Path $outputRoot "facebook-preview.jpg"
    $facebookBitmap = New-Canvas -Width 1200 -Height 630
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($facebookBitmap)
        try {
            Set-Quality -Graphics $graphics
            Draw-CoverCrop -Graphics $graphics -Image $baseImage -Width 1200 -Height 630
            $overlay = [System.Drawing.SolidBrush]::new(
                [System.Drawing.Color]::FromArgb(184, 18, 47, 66)
            )
            $white = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
            $eyebrowFont = [System.Drawing.Font]::new(
                "Segoe UI",
                22,
                [System.Drawing.FontStyle]::Bold,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            $titleFont = [System.Drawing.Font]::new(
                "Georgia",
                48,
                [System.Drawing.FontStyle]::Regular,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            try {
                $graphics.FillRectangle($overlay, 0, 300, 1200, 330)
                Draw-TextBlock -Graphics $graphics -Text "OSTEA RATGEBER" `
                    -Font $eyebrowFont -Brush $white `
                    -Bounds ([System.Drawing.RectangleF]::new(64, 338, 760, 42))
                Draw-TextBlock -Graphics $graphics -Text $title `
                    -Font $titleFont -Brush $white `
                    -Bounds ([System.Drawing.RectangleF]::new(64, 390, 1010, 150))
            }
            finally {
                $overlay.Dispose()
                $white.Dispose()
                $eyebrowFont.Dispose()
                $titleFont.Dispose()
            }
        }
        finally {
            $graphics.Dispose()
        }
        Save-Jpeg -Bitmap $facebookBitmap -Path $facebookClean -Quality 90
    }
    finally {
        $facebookBitmap.Dispose()
    }
    if ($PhotoLabelRequired) {
        Add-AiLabel -CleanPath $facebookClean -FinalPath $facebookFinal
    }
    else {
        Copy-Item -LiteralPath $facebookClean -Destination $facebookFinal -Force
    }
    $facebookExpectedText = @("OSTEA RATGEBER", $title)
    if ($PhotoLabelRequired) {
        $facebookExpectedText += "KI-generiert"
    }
    $assets.Add([pscustomobject]@{
        fileName = "facebook-preview.jpg"
        channel = "facebook"
        role = "preview"
        position = 1
        altText = "OSTEA-Linkvorschau mit redaktionellem Motiv und dem Titel $title."
        expectedText = $facebookExpectedText
        aiGenerated = $true
        labelRequired = $PhotoLabelRequired
    })
}
finally {
    $baseImage.Dispose()
}

for ($index = 0; $index -lt $slides.Count; $index += 1) {
    $slide = $slides[$index]
    $position = $index + 1
    $fileName = "instagram-$position.jpg"
    $cleanPath = Join-Path $cleanRoot $fileName
    $finalPath = Join-Path $outputRoot $fileName
    $bitmap = New-Canvas -Width 1080 -Height 1080
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            Set-Quality -Graphics $graphics
            $startColor = if (($position % 2) -eq 0) {
                [System.Drawing.Color]::FromArgb(247, 238, 230)
            }
            else {
                [System.Drawing.Color]::FromArgb(232, 246, 253)
            }
            $endColor = if (($position % 2) -eq 0) {
                [System.Drawing.Color]::FromArgb(216, 238, 251)
            }
            else {
                [System.Drawing.Color]::FromArgb(231, 203, 178)
            }
            $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
                [System.Drawing.Rectangle]::new(0, 0, 1080, 1080),
                $startColor,
                $endColor,
                145.0
            )
            $ink = [System.Drawing.SolidBrush]::new(
                [System.Drawing.Color]::FromArgb(22, 52, 70)
            )
            $muted = [System.Drawing.SolidBrush]::new(
                [System.Drawing.Color]::FromArgb(54, 86, 104)
            )
            $accent = [System.Drawing.SolidBrush]::new(
                [System.Drawing.Color]::FromArgb(62, 151, 199)
            )
            $glow = [System.Drawing.SolidBrush]::new(
                [System.Drawing.Color]::FromArgb(68, 255, 255, 255)
            )
            $eyebrowFont = [System.Drawing.Font]::new(
                "Segoe UI",
                25,
                [System.Drawing.FontStyle]::Bold,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            $titleFont = [System.Drawing.Font]::new(
                "Georgia",
                66,
                [System.Drawing.FontStyle]::Regular,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            $bodyFont = [System.Drawing.Font]::new(
                "Segoe UI",
                38,
                [System.Drawing.FontStyle]::Regular,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            $smallFont = [System.Drawing.Font]::new(
                "Segoe UI",
                24,
                [System.Drawing.FontStyle]::Bold,
                [System.Drawing.GraphicsUnit]::Pixel
            )
            try {
                $graphics.FillRectangle($gradient, 0, 0, 1080, 1080)
                $graphics.FillEllipse(
                    $glow,
                    760,
                    -120,
                    440,
                    440
                )
                Draw-TextBlock -Graphics $graphics `
                    -Text ("{0:D2}  ·  OSTEA IMPULS" -f $position) `
                    -Font $eyebrowFont -Brush $ink `
                    -Bounds ([System.Drawing.RectangleF]::new(76, 76, 850, 48))
                Draw-TextBlock -Graphics $graphics -Text ([string]$slide.title) `
                    -Font $titleFont -Brush $ink `
                    -Bounds ([System.Drawing.RectangleF]::new(76, 250, 900, 230))
                $graphics.FillRectangle($accent, 76, 500, 110, 8)
                Draw-TextBlock -Graphics $graphics -Text ([string]$slide.text) `
                    -Font $bodyFont -Brush $muted `
                    -Bounds ([System.Drawing.RectangleF]::new(76, 552, 900, 300))
                Draw-TextBlock -Graphics $graphics -Text "ostea.de" `
                    -Font $smallFont -Brush $ink `
                    -Bounds ([System.Drawing.RectangleF]::new(76, 980, 300, 45))
            }
            finally {
                $gradient.Dispose()
                $ink.Dispose()
                $muted.Dispose()
                $accent.Dispose()
                $glow.Dispose()
                $eyebrowFont.Dispose()
                $titleFont.Dispose()
                $bodyFont.Dispose()
                $smallFont.Dispose()
            }
        }
        finally {
            $graphics.Dispose()
        }
        Save-Jpeg -Bitmap $bitmap -Path $cleanPath -Quality 91
    }
    finally {
        $bitmap.Dispose()
    }

    Copy-Item -LiteralPath $cleanPath -Destination $finalPath -Force
    $assets.Add([pscustomobject]@{
        fileName = $fileName
        channel = "instagram"
        role = "carousel"
        position = $position
        altText = "OSTEA-Carousel-Folie $position`: $($slide.title). $($slide.text)"
        expectedText = @(
            ("{0:D2}  ·  OSTEA IMPULS" -f $position),
            [string]$slide.title,
            [string]$slide.text,
            "ostea.de"
        )
        aiGenerated = $false
        labelRequired = $false
    })
}

$manifest = [pscustomobject]@{
    version = 1
    createdAt = [DateTime]::UtcNow.ToString("o")
    assets = @($assets)
}
$manifestJson = $manifest | ConvertTo-Json -Depth 8
[System.IO.File]::WriteAllText(
    $manifestFile,
    "$manifestJson`n",
    [System.Text.UTF8Encoding]::new($false)
)

Write-Output "Finale Medien erstellt: $($assets.Count)"
Write-Output "Manifest: $manifestFile"
