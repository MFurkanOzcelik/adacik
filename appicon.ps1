param([string]$Aid, [int]$Size = 64)
# Prints the icon of an app (by its AppUserModelId, as Windows lists it in shell:AppsFolder) as base64 PNG.
# Works for Store apps and classic desktop apps alike, with transparency.
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System; using System.Drawing; using System.Drawing.Imaging; using System.IO; using System.Runtime.InteropServices;
public static class KlonIcon {
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
  static extern void SHCreateItemFromParsingName(string path, IntPtr pbc, [MarshalAs(UnmanagedType.LPStruct)] Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr h, int c, ref BITMAP b);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  public static string Get(string aid, int size) {
    object o; SHCreateItemFromParsingName("shell:AppsFolder\\" + aid, IntPtr.Zero, typeof(IShellItemImageFactory).GUID, out o);
    var f = (IShellItemImageFactory)o; IntPtr hb; SIZE s; s.cx = size; s.cy = size;
    if (f.GetImage(s, 0x1 /* SIIGBF_BIGGERSIZEOK */, out hb) != 0 || hb == IntPtr.Zero) return "";
    try {
      var bm = new BITMAP(); GetObject(hb, Marshal.SizeOf(typeof(BITMAP)), ref bm);
      if (bm.bmBits == IntPtr.Zero || bm.bmBitsPixel != 32) { using (var img = Image.FromHbitmap(hb)) return Png(img); }
      int w = bm.bmWidth, h = Math.Abs(bm.bmHeight);
      using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
        var row = new byte[w * 4]; bool any = false;
        for (int y = 0; y < h; y++) {
          int src = bm.bmHeight > 0 ? h - 1 - y : y;   // DIB sections are usually stored bottom-up
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
}
'@
try { [KlonIcon]::Get($Aid, $Size) } catch { '' }
