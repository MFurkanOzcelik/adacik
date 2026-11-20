param([string]$Aid, [int]$Size = 64)
# Prints the icon of an app (by its AppUserModelId, as Windows lists it in shell:AppsFolder) as base64 PNG.
# Works for Store apps and classic desktop apps alike, with transparency.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.Runtime.InteropServices;
public static class KlonIcon {
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAPINFOHEADER { public uint biSize; public int biWidth, biHeight; public ushort biPlanes, biBitCount; public uint biCompression, biSizeImage; public int biXPelsPerMeter, biYPelsPerMeter; public uint biClrUsed, biClrImportant; }
  [StructLayout(LayoutKind.Sequential)] struct DIBSECTION { public BITMAP dsBm; public BITMAPINFOHEADER dsBmih; public uint b0, b1, b2; public IntPtr dshSection; public uint dsOffset; }
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);
  [DllImport("gdi32.dll", EntryPoint = "GetObject")] static extern int GetDib(IntPtr h, int c, ref DIBSECTION d);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static string Get(string aid, int size) {
    object o; SHCreateItemFromParsingName("shell:AppsFolder\\" + aid, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out o);
    var f = (IShellItemImageFactory)o; IntPtr hb; SIZE s; s.cx = size; s.cy = size;
    if (f.GetImage(s, 0x1 /* SIIGBF_BIGGERSIZEOK */, out hb) != 0 || hb == IntPtr.Zero) return "";
    try {
      var ds = new DIBSECTION(); int got = GetDib(hb, Marshal.SizeOf(typeof(DIBSECTION)), ref ds); var bm = ds.dsBm;
      // the header says how rows are stored: negative height = top-down, positive = bottom-up
      // (shell icons come both ways; BITMAP.bmHeight alone is always positive)
      bool bottomUp = got >= Marshal.SizeOf(typeof(DIBSECTION)) ? ds.dsBmih.biHeight > 0 : true;
      if (bm.bmBits == IntPtr.Zero || bm.bmBitsPixel != 32) { using (var img = Image.FromHbitmap(hb)) return Png(img); }
      int w = bm.bmWidth, h = Math.Abs(bm.bmHeight);
      using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        var row = new byte[w * 4]; bool any = false;
        for (int y = 0; y < h; y++) {
          int src = bottomUp ? h - 1 - y : y;
          Marshal.Copy(new IntPtr(bm.bmBits.ToInt64() + (long)src * bm.bmWidthBytes), row, 0, w * 4);
          for (int i = 3; i < row.Length; i += 4) if (row[i] != 0) { any = true; break; }
          Marshal.Copy(row, 0, new IntPtr(d.Scan0.ToInt64() + (long)y * d.Stride), w * 4);
        }
        bmp.UnlockBits(d);
        if (!any) { using (var img = Image.FromHbitmap(hb)) return Png(img); }   // no alpha channel: plain copy
        return Png(bmp);
      }
    } finally { DeleteObject(hb); }
  }
  static string Png(Image img) { using (var ms = new MemoryStream()) { img.Save(ms, ImageFormat.Png); return Convert.ToBase64String(ms.ToArray()); } }

  // Bounding box of the visible pixels and how much of it is filled.
  static Rectangle Box(Bitmap b, out double fill) {
    int x0 = b.Width, y0 = b.Height, x1 = -1, y1 = -1; long opaque = 0;
    for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++)
      if (b.GetPixel(x, y).A > 160) { opaque++; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
    if (x1 < 0) { fill = 0; return Rectangle.Empty; }
    var r = new Rectangle(x0, y0, x1 - x0 + 1, y1 - y0 + 1); fill = (double)opaque / (r.Width * r.Height); return r;
  }
  // A logo drawn on a filled square / rounded square (what Windows calls "plated").
  public static bool IsPlate(string b64) {
    using (var b = new Bitmap(new MemoryStream(Convert.FromBase64String(b64)))) {
      double fill; var r = Box(b, out fill);
      return !r.IsEmpty && fill > 0.86 && r.Width > b.Width * 0.7 && Math.Abs(r.Width - r.Height) <= Math.Max(2, r.Width / 12);
    }
  }
  // Cut the empty margin off a tile image and centre the logo in a size×size square.
  public static string Trim(string file, int size) {
    using (var src = new Bitmap(file)) {
      double fill; var r = Box(src, out fill); if (r.IsEmpty) return "";
      using (var dst = new Bitmap(size, size, PixelFormat.Format32bppArgb)) using (var g = Graphics.FromImage(dst)) {
        g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality;
        float k = Math.Min(size / (float)r.Width, size / (float)r.Height), w = r.Width * k, h = r.Height * k;
        g.DrawImage(src, new RectangleF((size - w) / 2, (size - h) / 2, w, h), r, GraphicsUnit.Pixel);
        return Png(dst);
      }
    }
  }
}
'@
# Store apps: the Apps folder hands out their icon on a coloured square ("plated"). Their package also
# ships the bare logo ("altform-unplated", what the taskbar shows), so use that when there is one.
function Get-Unplated([string]$aid, [int]$size) {
  if ($aid -notmatch '^([^_!\\]+)_([a-z0-9]+)!(.+)$') { return '' }
  $pkg = Get-AppxPackage -Name $matches[1] -ErrorAction SilentlyContinue | Where-Object { $_.PackageFamilyName -eq ($aid -split '!')[0] } | Select-Object -First 1
  if (-not $pkg -or -not $pkg.InstallLocation) { return '' }
  $appId = $matches[3]
  [xml]$m = Get-Content -LiteralPath (Join-Path $pkg.InstallLocation 'AppxManifest.xml') -Raw -Encoding UTF8
  $app = @($m.Package.Applications.Application) | Where-Object { $_.Id -eq $appId } | Select-Object -First 1
  if (-not $app) { return '' }
  $ve = $app.ChildNodes | Where-Object { $_.LocalName -eq 'VisualElements' } | Select-Object -First 1
  if (-not $ve) { return '' }
  $b = ''
  $logo = $ve.Square44x44Logo
  if ($logo) {
    $dir = Join-Path $pkg.InstallLocation ([IO.Path]::GetDirectoryName($logo)); $base = [IO.Path]::GetFileNameWithoutExtension($logo)
    # e.g. AppList.targetsize-64_altform-unplated.png — the smallest one at least as big as asked, else the biggest
    $c = Get-ChildItem -LiteralPath $dir -Filter "$base.targetsize-*_altform-unplated.png" -ErrorAction SilentlyContinue |
      ForEach-Object { if ($_.Name -match 'targetsize-(\d+)_altform-unplated\.png$') { [pscustomobject]@{ n = [int]$matches[1]; f = $_.FullName } } } | Sort-Object n
    $pick = ($c | Where-Object { $_.n -ge $size } | Select-Object -First 1); if (-not $pick) { $pick = $c | Select-Object -Last 1 }
    if ($pick) { $b = [Convert]::ToBase64String([IO.File]::ReadAllBytes($pick.f)) }
  }
  # Some apps (WhatsApp…) draw even their "unplated" icon on a square. Their tile image is the bare logo
  # with a wide margin: trim that and use it instead.
  if (-not $b -or [KlonIcon]::IsPlate($b)) {
    $tile = $ve.Square150x150Logo
    if ($tile) {
      $dir = Join-Path $pkg.InstallLocation ([IO.Path]::GetDirectoryName($tile)); $base = [IO.Path]::GetFileNameWithoutExtension($tile)
      $t = Get-ChildItem -LiteralPath $dir -Filter "$base.scale-*.png" -ErrorAction SilentlyContinue |
        ForEach-Object { if ($_.Name -match '\.scale-(\d+)\.png$') { [pscustomobject]@{ n = [int]$matches[1]; f = $_.FullName } } } | Sort-Object n | Select-Object -Last 1
      if ($t) { $tb = [KlonIcon]::Trim($t.f, $size); if ($tb -and -not [KlonIcon]::IsPlate($tb)) { $b = $tb } }
    }
  }
  return $b
}
$b = ''; try { $b = Get-Unplated $Aid $Size } catch {}
if (-not $b) { try { $b = [KlonIcon]::Get($Aid, $Size) } catch {} }
$b
