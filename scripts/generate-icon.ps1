Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class NativeMethods
{
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern bool DestroyIcon(IntPtr handle);
}
'@

function New-RoundedRectanglePath {
    param(
        [System.Drawing.RectangleF]$Rect,
        [float]$Radius
    )

    $diameter = $Radius * 2
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc($Rect.X, $Rect.Y, $diameter, $diameter, 180, 90)
    $path.AddArc($Rect.Right - $diameter, $Rect.Y, $diameter, $diameter, 270, 90)
    $path.AddArc($Rect.Right - $diameter, $Rect.Bottom - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($Rect.X, $Rect.Bottom - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

function New-TapGitBitmap {
    param(
        [int]$Size
    )

    $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)

    $scale = $Size / 256.0
    $outerRect = New-Object System.Drawing.RectangleF (10 * $scale), (10 * $scale), (236 * $scale), (236 * $scale)
    $cardPath = New-RoundedRectanglePath -Rect $outerRect -Radius (52 * $scale)

    $gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $outerRect,
        [System.Drawing.Color]::FromArgb(255, 15, 114, 124),
        [System.Drawing.Color]::FromArgb(255, 8, 63, 91),
        135
    )

    $glowBrush = New-Object System.Drawing.Drawing2D.PathGradientBrush($cardPath)
    $glowBrush.CenterColor = [System.Drawing.Color]::FromArgb(90, 255, 255, 255)
    $glowBrush.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
    $outline = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(80, 255, 255, 255), (4 * $scale))
    $linePen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, (18 * $scale))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

    $shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(80, 5, 31, 45))
    $nodeBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 255, 143, 61))

    try {
        $graphics.FillPath($gradient, $cardPath)
        $graphics.FillPath($glowBrush, $cardPath)
        $graphics.DrawPath($outline, $cardPath)

        $graphics.DrawLine($linePen, (78 * $scale), (176 * $scale), (128 * $scale), (122 * $scale))
        $graphics.DrawLine($linePen, (128 * $scale), (122 * $scale), (186 * $scale), (122 * $scale))
        $graphics.DrawLine($linePen, (128 * $scale), (122 * $scale), (128 * $scale), (72 * $scale))

        foreach ($node in @(
            @{ X = 58; Y = 156; Size = 38; Brush = $nodeBrush },
            @{ X = 109; Y = 103; Size = 38; Brush = $nodeBrush },
            @{ X = 167; Y = 103; Size = 38; Brush = $accentBrush },
            @{ X = 109; Y = 53; Size = 38; Brush = $nodeBrush }
        )) {
            $shadowRect = New-Object System.Drawing.RectangleF (($node.X + 4) * $scale), (($node.Y + 6) * $scale), ($node.Size * $scale), ($node.Size * $scale)
            $ellipse = New-Object System.Drawing.RectangleF ($node.X * $scale), ($node.Y * $scale), ($node.Size * $scale), ($node.Size * $scale)
            $graphics.FillEllipse($shadowBrush, $shadowRect)
            $graphics.FillEllipse($node.Brush, $ellipse)
        }

        return $bitmap
    } finally {
        $gradient.Dispose()
        $glowBrush.Dispose()
        $outline.Dispose()
        $linePen.Dispose()
        $shadowBrush.Dispose()
        $nodeBrush.Dispose()
        $accentBrush.Dispose()
        $cardPath.Dispose()
        $graphics.Dispose()
    }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = Split-Path -Parent $scriptDir
$buildDir = Join-Path $rootDir 'build'
New-Item -ItemType Directory -Force -Path $buildDir | Out-Null

$pngBitmap = New-TapGitBitmap -Size 1024
$icoBitmap = New-TapGitBitmap -Size 256
$pngPath = Join-Path $buildDir 'icon.png'
$icoPath = Join-Path $buildDir 'icon.ico'

try {
    $pngBitmap.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $iconHandle = $icoBitmap.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($iconHandle)
    $stream = [System.IO.File]::Open($icoPath, [System.IO.FileMode]::Create)

    try {
        $icon.Save($stream)
    } finally {
        $stream.Dispose()
        $icon.Dispose()
        [NativeMethods]::DestroyIcon($iconHandle) | Out-Null
    }
} finally {
    $pngBitmap.Dispose()
    $icoBitmap.Dispose()
}
