// Adacık background helper (compiled replacement for media.ps1: same JSON lines, ~1/3 of the memory).
// Prints one JSON line per poll (~300 ms) with the media session (title, artist, cover, position),
// system volume, screen brightness, clipboard sequence number, whether the foreground window is
// fullscreen, and new Windows notifications (as separate {"notif":{...}} lines).
// Also (see Activity): which apps use the camera / microphone, running downloads and Explorer file
// copies ("prog"), finished ones ({"done":…} lines) and Bluetooth headphones ({"bt":…} lines).
// Commands arrive on stdin, one per line: play | pause | toggle | next | prev | seek <s> | vol <0-1> | mute <0|1>
// Build: helper\build.ps1 (C# 5 / .NET Framework 4, compiler that ships with Windows).
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Management;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using Microsoft.Win32;
using Windows.Devices.Enumeration;
using Windows.Media.Control;
using Windows.Storage.Streams;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr p); int UnregisterControlChangeNotify(IntPtr p); int GetChannelCount(out int c);
  int SetMasterVolumeLevel(float db, ref Guid ctx); int SetMasterVolumeLevelScalar(float v, ref Guid ctx);
  int GetMasterVolumeLevel(out float db); int GetMasterVolumeLevelScalar(out float v);
  int SetChannelVolumeLevel(uint ch, float db, ref Guid ctx); int SetChannelVolumeLevelScalar(uint ch, float v, ref Guid ctx);
  int GetChannelVolumeLevel(uint ch, out float db); int GetChannelVolumeLevelScalar(uint ch, out float v);
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool m, ref Guid ctx); int GetMute([MarshalAs(UnmanagedType.Bool)] out bool m);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int EnumAudioEndpoints(int f, int s, out IntPtr d); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice dev); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorCo { }

static class Audio {
  static IAudioEndpointVolume Ep() {
    var en = (IMMDeviceEnumerator)new MMDeviceEnumeratorCo(); IMMDevice dev;
    Marshal.ThrowExceptionForHR(en.GetDefaultAudioEndpoint(0, 1, out dev));
    Guid iid = typeof(IAudioEndpointVolume).GUID; object o;
    Marshal.ThrowExceptionForHR(dev.Activate(ref iid, 23, IntPtr.Zero, out o));
    return (IAudioEndpointVolume)o;
  }
  public static float Get() { float v; Marshal.ThrowExceptionForHR(Ep().GetMasterVolumeLevelScalar(out v)); return v; }
  public static void Set(float v) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Ep().SetMasterVolumeLevelScalar(Math.Max(0f, Math.Min(1f, v)), ref g)); }
  public static bool Muted() { bool m; Marshal.ThrowExceptionForHR(Ep().GetMute(out m)); return m; }
  public static void Mute(bool m) { Guid g = Guid.Empty; Marshal.ThrowExceptionForHR(Ep().SetMute(m, ref g)); }
}

static class Win {
  // Windows' Do Not Disturb (Focus assist on Windows 10): the shell publishes the active quiet-hours
  // profile as a WNF state. 0 = off, 1 = priority only, 2 = alarms only; -1 = can't tell.
  [DllImport("ntdll.dll")] static extern int NtQueryWnfStateData(ref ulong name, IntPtr type, IntPtr scope, out uint stamp, byte[] buf, ref uint size);
  public static int Dnd() {
    ulong name = 0x0D83063EA3BF1C75; uint stamp, size = 4; var b = new byte[4];
    return NtQueryWnfStateData(ref name, IntPtr.Zero, IntPtr.Zero, out stamp, b, ref size) == 0 && size >= 4 ? BitConverter.ToInt32(b, 0) : -1;
  }
  // The shell also bumps two WNF states whenever a toast is shown (toast published / Action Center count
  // changed). Reading their change stamps is one cheap system call, so the Action Center (≈40 ms of work for
  // Windows each time) is only asked when a notification really came. Returns false when they can't be read.
  static readonly byte[] wnfBuf = new byte[4096];
  public static bool ToastStamp(out ulong stamp) {
    stamp = 0; ulong a = 0x0D83063EA3BD0035, c = 0x0D83063EA3BC1035; uint s1, s2, n1 = 4096, n2 = 4096;
    if (NtQueryWnfStateData(ref a, IntPtr.Zero, IntPtr.Zero, out s1, wnfBuf, ref n1) != 0) return false;
    if (NtQueryWnfStateData(ref c, IntPtr.Zero, IntPtr.Zero, out s2, wnfBuf, ref n2) != 0) return false;
    stamp = ((ulong)s1 << 32) | s2; return true;
  }
  // Which program last wrote the clipboard (process name, "" if none): tells a screenshot (SnippingTool)
  // from an image copied in a browser. Asked only when the clipboard sequence number changes.
  [DllImport("user32.dll")] static extern IntPtr GetClipboardOwner();
  // The Snipping Tool gives up the clipboard's ownership within a few hundred ms (and writes the image
  // once more without an owner), so the main loop would often miss it. A light thread looks at every
  // change as it happens and remembers the last named owner for 3 s.
  static volatile string recentOwner = ""; static long recentAt = 0;
  static void NoteOwner() {
    try {
      IntPtr h = GetClipboardOwner(); uint pid;
      if (h != IntPtr.Zero && GetWindowThreadProcessId(h, out pid) != 0) { recentOwner = System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; Interlocked.Exchange(ref recentAt, DateTime.UtcNow.Ticks); }
    } catch { }
  }
  // Windows tells a clipboard listener about every change (WM_CLIPBOARDUPDATE), so the thread sleeps until
  // something is copied instead of looking 25 times a second. A hidden message-only window receives it.
  delegate IntPtr WndProc(IntPtr h, uint m, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] struct WNDCLASS { public uint style; public WndProc proc; public int cls, wnd; public IntPtr inst, icon, cursor, bg; public string menu, name; }
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr h; public uint m; public IntPtr w, l; public uint t; public int x, y; }
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern ushort RegisterClass(ref WNDCLASS c);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr p);
  [DllImport("user32.dll")] static extern IntPtr DefWindowProc(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll")] static extern bool AddClipboardFormatListener(IntPtr h);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint a, uint b);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG m);
  static WndProc clipProc;   // kept alive: Windows calls it
  public static void WatchClipOwner() {
    new Thread(() => {
      try {
        clipProc = (h, m, w, l) => { if (m == 0x031D) NoteOwner(); return DefWindowProc(h, m, w, l); };   // WM_CLIPBOARDUPDATE
        var c = new WNDCLASS { proc = clipProc, name = "AdacikClipWatch", inst = Marshal.GetHINSTANCE(typeof(Win).Module) };
        RegisterClass(ref c);
        IntPtr hw = CreateWindowEx(0, "AdacikClipWatch", "", 0, 0, 0, 0, 0, new IntPtr(-3) /* HWND_MESSAGE */, IntPtr.Zero, c.inst, IntPtr.Zero);
        if (hw != IntPtr.Zero && AddClipboardFormatListener(hw)) { MSG msg; while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) DispatchMessage(ref msg); return; }
      } catch { }
      // no listener (shouldn't happen): look at the sequence number instead
      uint seen = GetClipboardSequenceNumber();
      while (true) { Thread.Sleep(40); uint s = GetClipboardSequenceNumber(); if (s != seen) { seen = s; NoteOwner(); } }
    }) { IsBackground = true, Priority = ThreadPriority.BelowNormal }.Start();
  }
  public static string ClipOwner() { return DateTime.UtcNow.Ticks - Interlocked.Read(ref recentAt) < 3 * TimeSpan.TicksPerSecond ? recentOwner : ""; }
  [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
  [StructLayout(LayoutKind.Sequential)] struct MONITORINFO { public int cbSize; public RECT rcMonitor; public RECT rcWork; public uint dwFlags; }
  [DllImport("user32.dll")] public static extern uint GetClipboardSequenceNumber();
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr h, uint f);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr m, ref MONITORINFO mi);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  // True when the foreground window (not the desktop, the taskbar or our own app) covers its whole monitor.
  public static bool Fullscreen(uint ownPid) {
    IntPtr h = GetForegroundWindow(); if (h == IntPtr.Zero) return false;
    var sb = new StringBuilder(64); GetClassName(h, sb, 64); string c = sb.ToString();
    if (c == "Progman" || c == "WorkerW" || c == "Shell_TrayWnd" || c == "Windows.UI.Core.CoreWindow") return false;
    uint pid; GetWindowThreadProcessId(h, out pid); if (ownPid != 0 && pid == ownPid) return false;
    RECT r; if (!GetWindowRect(h, out r)) return false;
    var mi = new MONITORINFO(); mi.cbSize = Marshal.SizeOf(typeof(MONITORINFO));
    if (!GetMonitorInfo(MonitorFromWindow(h, 2), ref mi)) return false;
    return r.L <= mi.rcMonitor.L && r.T <= mi.rcMonitor.T && r.R >= mi.rcMonitor.R && r.B >= mi.rcMonitor.B;
  }
}

// Minimal JSON writer: only what the app reads.
class Json {
  readonly StringBuilder sb = new StringBuilder("{"); bool first = true;
  void Key(string k) { if (!first) sb.Append(','); first = false; Str(sb, k); sb.Append(':'); }
  public Json S(string k, string v) { Key(k); if (v == null) sb.Append("null"); else Str(sb, v); return this; }
  public Json N(string k, double v) { Key(k); sb.Append(double.IsNaN(v) || double.IsInfinity(v) ? "0" : v.ToString("R", CultureInfo.InvariantCulture)); return this; }
  public Json B(string k, bool v) { Key(k); sb.Append(v ? "true" : "false"); return this; }
  public Json O(string k, Json v) { Key(k); sb.Append(v.ToString()); return this; }
  public Json A(string k, IEnumerable<string> raw) { Key(k); sb.Append('[').Append(string.Join(",", raw)).Append(']'); return this; }   // array of ready JSON values
  public static string Q(string s) { var b = new StringBuilder(); Str(b, s); return b.ToString(); }
  public override string ToString() { return sb.ToString() + "}"; }
  static void Str(StringBuilder sb, string s) {
    sb.Append('"');
    foreach (char ch in s) {
      switch (ch) {
        case '"': sb.Append("\\\""); break; case '\\': sb.Append("\\\\"); break;
        case '\n': sb.Append("\\n"); break; case '\r': sb.Append("\\r"); break; case '\t': sb.Append("\\t"); break;
        default: if (ch < 0x20 || ch == (char)0x2028 || ch == (char)0x2029) sb.Append("\\u").Append(((int)ch).ToString("x4")); else sb.Append(ch); break;
      }
    }
    sb.Append('"');
  }
}

// ---- what the island shows besides media: camera/mic use, transfers, Bluetooth headphones ----
static class Activity {
  // Camera / microphone: Windows records per app when it started and stopped using them;
  // "started, not stopped" means in use right now (this is what the taskbar's privacy icon reads).
  static readonly Dictionary<string, string> names = new Dictionary<string, string>();
  static string AppName(string key, bool packaged) {
    string n; if (names.TryGetValue(key, out n)) return n;
    n = "";
    try {
      if (packaged) {
        var pm = new Windows.Management.Deployment.PackageManager();
        foreach (var p in pm.FindPackagesForUser("", key)) { n = p.DisplayName; break; }
      } else {
        var file = key.Replace('#', '\\');
        if (File.Exists(file)) n = FileVersionInfo.GetVersionInfo(file).FileDescription;
        if (string.IsNullOrWhiteSpace(n)) n = Path.GetFileNameWithoutExtension(file);
      }
    } catch { }
    if (string.IsNullOrWhiteSpace(n)) { var m = Regex.Match(key, @"^[^.]*\.([^_]+)_"); n = m.Success ? m.Groups[1].Value : key; }
    return names[key] = n.Trim();
  }
  static bool Active(RegistryKey k) {
    if (k == null) return false;
    object st = k.GetValue("LastUsedTimeStart"), sp = k.GetValue("LastUsedTimeStop");
    return st is long && (long)st != 0 && sp is long && (long)sp == 0;
  }
  // Re-read only when Windows says something under the camera/microphone keys changed (no polling).
  [DllImport("advapi32.dll")] static extern int RegNotifyChangeKeyValue(Microsoft.Win32.SafeHandles.SafeRegistryHandle k, bool subtree, uint filter, Microsoft.Win32.SafeHandles.SafeWaitHandle ev, bool async);
  static volatile bool privDirty = true;
  public static bool PrivacyChanged() { if (!privDirty) return false; privDirty = false; return true; }
  public static void WatchPrivacy() {
    new Thread(() => {
      const string root = @"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\";
      var keys = new[] { Registry.CurrentUser.OpenSubKey(root + "webcam"), Registry.CurrentUser.OpenSubKey(root + "microphone") }.Where(k => k != null).ToArray();
      if (keys.Length == 0) return;
      // one event per key; a notification fires once, so the key that fired is armed again
      var evs = keys.Select(k => new AutoResetEvent(false)).ToArray();
      for (int i = 0; i < keys.Length; i++) RegNotifyChangeKeyValue(keys[i].Handle, true, 0x1 | 0x4 /* name | last set */, evs[i].SafeWaitHandle, true);
      while (true) {
        int hit = WaitHandle.WaitAny(evs, 30000);   // also a safety re-read every 30 s
        Thread.Sleep(150);                            // a start writes two values: read once after both
        for (int i = 0; i < keys.Length; i++)
          if (i == hit || evs[i].WaitOne(0)) RegNotifyChangeKeyValue(keys[i].Handle, true, 0x1 | 0x4, evs[i].SafeWaitHandle, true);
        privDirty = true;
      }
    }) { IsBackground = true }.Start();
  }
  public static List<string> InUse(string cap) {
    var res = new List<string>();
    using (var root = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\" + cap)) {
      if (root == null) return res;
      foreach (var sub in root.GetSubKeyNames()) {
        if (sub == "NonPackaged") {
          using (var np = root.OpenSubKey(sub)) if (np != null) foreach (var s2 in np.GetSubKeyNames()) using (var k = np.OpenSubKey(s2)) { if (Active(k)) res.Add(AppName(s2, false)); }
        } else using (var k = root.OpenSubKey(sub)) { if (Active(k)) res.Add(AppName(sub, true)); }
      }
    }
    return res.Distinct().ToList();
  }

  // Downloads: browsers write into a temporary file (.crdownload, .part…) and rename it at the end.
  // Its size grows as it downloads (the total isn't known from outside the browser).
  class Dl { public long size, prev; public double rate; public DateTime at = DateTime.UtcNow; public bool seen; }
  static readonly string[] tmpExt = { ".crdownload", ".part", ".partial", ".download", ".opdownload" };
  static bool IsTmp(string f) { var e = Path.GetExtension(f).ToLowerInvariant(); return tmpExt.Contains(e); }
  static readonly Dictionary<string, Dl> dls = new Dictionary<string, Dl>(StringComparer.OrdinalIgnoreCase);
  static readonly ConcurrentQueue<string> doneLines = new ConcurrentQueue<string>();
  static FileSystemWatcher fsw;
  public static void WatchDownloads(string dir) {
    if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir)) return;
    try { foreach (var f in Directory.GetFiles(dir)) if (IsTmp(f)) lock (dls) dls[f] = new Dl(); } catch { }
    fsw = new FileSystemWatcher(dir) { IncludeSubdirectories = false, NotifyFilter = NotifyFilters.FileName };
    fsw.Created += (s, e) => { if (IsTmp(e.FullPath)) lock (dls) dls[e.FullPath] = new Dl(); };
    fsw.Renamed += (s, e) => {
      bool was; lock (dls) { was = dls.Remove(e.OldFullPath); if (IsTmp(e.FullPath)) dls[e.FullPath] = new Dl(); }
      if (was && !IsTmp(e.FullPath)) {   // temp file → final name: finished
        long sz = 0; try { sz = new FileInfo(e.FullPath).Length; } catch { }
        doneLines.Enqueue(new Json().O("done", new Json().S("k", "dl").S("name", e.Name).S("path", e.FullPath).N("size", sz)).ToString());
      }
    };
    fsw.Deleted += (s, e) => { lock (dls) dls.Remove(e.FullPath); };   // cancelled
    fsw.EnableRaisingEvents = true;
  }
  public static string NextDone() { string l; return doneLines.TryDequeue(out l) ? l : null; }

  // Explorer copy/move: its progress window's title is "45% complete" (localised).
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int InternalGetWindowText(IntPtr h, StringBuilder s, int n);   // reads the title without asking the window
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  static int lastCopy = -1;
  static int CopyPercent() {
    int pct = -1;
    EnumWindows((h, p) => {
      var c = new StringBuilder(64); GetClassName(h, c, 64);
      if (c.ToString() != "OperationStatusWindow" || !IsWindowVisible(h)) return true;
      var t = new StringBuilder(256); InternalGetWindowText(h, t, 256);
      var m = Regex.Match(t.ToString(), @"%\s*(\d{1,3})|(\d{1,3})\s*%");
      pct = m.Success ? int.Parse(m.Groups[1].Success ? m.Groups[1].Value : m.Groups[2].Value) : 0;
      return false;
    }, IntPtr.Zero);
    return pct;
  }

  // Progress list for this poll (JSON values); called about once a second.
  public static List<string> Progress() {
    var o = new List<string>();
    var now = DateTime.UtcNow;
    lock (dls) {
      foreach (var kv in dls.ToList()) {
        long sz; try { sz = new FileInfo(kv.Key).Length; } catch { dls.Remove(kv.Key); continue; }
        var d = kv.Value; double dt = (now - d.at).TotalSeconds;
        if (d.seen && dt > 0.2) { double r = Math.Max(0, (sz - d.prev) / dt); d.rate = d.rate == 0 ? r : d.rate * 0.6 + r * 0.4; }
        d.prev = sz; d.size = sz; d.at = now; d.seen = true;
        var name = Path.GetFileName(kv.Key); var ext = Path.GetExtension(name);
        name = name.Substring(0, name.Length - ext.Length);
        if (name.StartsWith("Unconfirmed ")) name = "";   // Chrome's placeholder until it knows the name
        o.Add(new Json().S("k", "dl").S("name", name).N("bytes", sz).N("rate", Math.Round(d.rate)).ToString());
      }
    }
    int cp = CopyPercent();
    if (cp >= 0) o.Add(new Json().S("k", "copy").N("pct", cp).ToString());
    else if (lastCopy >= 0) doneLines.Enqueue(new Json().O("done", new Json().S("k", "copy")).ToString());
    lastCopy = cp;
    return o;
  }

  // Bluetooth headphones: a watcher on paired classic Bluetooth devices tells when one connects;
  // the battery level is a device property Windows fills in for hands-free headsets.
  class Bt { public string name, container; public int major = -1; public bool on, told; public int bat = -1; public DateTime batAt; }
  static readonly Dictionary<string, Bt> bts = new Dictionary<string, Bt>();
  static bool btReady;
  const string BAT = "{104EA319-6EE2-4701-BD47-8DDBF425BBE5} 2";
  static void BtProps(Bt b, IReadOnlyDictionary<string, object> p) {
    object v;
    if (p.TryGetValue("System.Devices.Aep.IsConnected", out v) && v != null) b.on = (bool)v;
    if (p.TryGetValue("System.Devices.Aep.Bluetooth.Cod.Major", out v) && v != null) b.major = Convert.ToInt32(v);
    if (p.TryGetValue("System.Devices.Aep.ContainerId", out v) && v != null) b.container = v.ToString();
  }
  public static void WatchBluetooth() {
    try {
      var w = DeviceInformation.CreateWatcher("System.Devices.Aep.ProtocolId:=\"{e0cbf06c-cd8b-4647-bb8a-263b43f0f974}\" AND System.Devices.Aep.IsPaired:=System.StructuredQueryType.Boolean#True",
        new[] { "System.Devices.Aep.IsConnected", "System.Devices.Aep.Bluetooth.Cod.Major", "System.Devices.Aep.ContainerId" }, DeviceInformationKind.AssociationEndpoint);
      w.Added += (s, d) => { lock (bts) { var b = new Bt { name = d.Name }; BtProps(b, d.Properties); bts[d.Id] = b; } };
      w.Updated += (s, u) => { lock (bts) { Bt b; if (bts.TryGetValue(u.Id, out b)) BtProps(b, u.Properties); } };
      w.Removed += (s, u) => { lock (bts) bts.Remove(u.Id); };
      w.EnumerationCompleted += (s, o) => { btReady = true; };
      w.Start();
    } catch { }
  }
  static int Battery(string container) {
    if (string.IsNullOrEmpty(container)) return -1;
    int best = -1;
    try {
      var list = Program.Await(DeviceInformation.FindAllAsync("System.Devices.ContainerId:=\"{" + container.Trim('{', '}') + "}\"", new[] { BAT }, DeviceInformationKind.Device));
      if (list != null) foreach (var d in list) { object v; if (d.Properties.TryGetValue(BAT, out v) && v != null) best = Math.Max(best, Convert.ToInt32(v)); }
    } catch { }
    return best;
  }
  static readonly Dictionary<string, string> btSent = new Dictionary<string, string>();
  // {"bt":{name,on,bat,first}} whenever a headset connects, disconnects or its battery changes
  public static IEnumerable<string> BluetoothChanges() {
    var o = new List<string>(); if (!btReady) return o;
    List<KeyValuePair<string, Bt>> all; lock (bts) all = bts.ToList();
    foreach (var kv in all) {
      var b = kv.Value; if (b.major != 4) continue;   // Class of Device "Audio/Video": headphones, earbuds, speakers
      if (b.on && (b.bat < 0 && (DateTime.UtcNow - b.batAt).TotalSeconds > 10 || (DateTime.UtcNow - b.batAt).TotalSeconds > 60)) { b.bat = Battery(b.container); b.batAt = DateTime.UtcNow; }
      if (!b.on) { b.bat = -1; b.batAt = DateTime.MinValue; }
      string state = (b.on ? "1" : "0") + ":" + b.bat, prev;
      bool first = !btSent.TryGetValue(kv.Key, out prev);
      if (first && !b.on) { btSent[kv.Key] = state; continue; }
      if (prev == state) continue;
      btSent[kv.Key] = state;
      o.Add(new Json().O("bt", new Json().S("id", kv.Key).S("name", b.name).B("on", b.on).N("bat", b.bat).B("first", first)).ToString());
    }
    return o;
  }
}

static class Program {
  static readonly TextWriter Out = new StreamWriter(Console.OpenStandardOutput(), new UTF8Encoding(false)) { AutoFlush = false, NewLine = "\n" };
  static readonly BlockingCollection<string> Commands = new BlockingCollection<string>();
  static volatile bool stdinClosed;

  // Wait for a WinRT async call (up to 3 s) through its Completed callback; no SDK-only facades needed.
  internal static T Await<T>(Windows.Foundation.IAsyncOperation<T> op) {
    if (op == null) return default(T);
    // spinCount 0: block right away instead of spinning first (it ran several times a second and the spinning
    // was most of the helper's idle CPU). Not disposed: a late callback may still set it.
    var done = new ManualResetEventSlim(false, 0);
    op.Completed = (a, st) => { try { done.Set(); } catch { } };   // runs at once if it has already finished
    if (!done.Wait(3000)) { try { op.Cancel(); } catch { } return default(T); }
    return op.Status == Windows.Foundation.AsyncStatus.Completed ? op.GetResults() : default(T);
  }
  static byte[] ReadAll(IRandomAccessStreamReference r) {
    if (r == null) return null;
    using (var st = Await(r.OpenReadAsync())) {
      if (st == null || st.Size == 0) return null;
      using (var dr = new DataReader(st.GetInputStreamAt(0))) {
        uint n = Await(dr.LoadAsync((uint)st.Size));
        var b = new byte[n]; dr.ReadBytes(b); return b;
      }
    }
  }

  // ---- screen brightness (laptops; fails quietly on desktops) ----
  static bool brOk = true;
  static int Brightness() {
    if (!brOk) return -1;
    try {
      using (var s = new ManagementObjectSearcher(@"root\wmi", "SELECT CurrentBrightness FROM WmiMonitorBrightness"))
        foreach (ManagementObject m in s.Get()) using (m) return Convert.ToInt32(m["CurrentBrightness"]);
    } catch { }
    brOk = false; return -1;
  }

  // ---- notifications (read-only listener; Windows asks the user once if needed) ----
  static UserNotificationListener notif;
  static readonly HashSet<uint> seen = new HashSet<uint>();
  static readonly Dictionary<string, string> iconCache = new Dictionary<string, string>();
  static void NewNotifications(bool prime) {
    var list = Await(notif.GetNotificationsAsync(NotificationKinds.Toast));
    if (list == null) return;
    foreach (var n in list) {
      if (!seen.Add(n.Id) || prime) continue;
      string app = "", aid = "", icon = ""; var texts = new List<string>();
      try { app = n.AppInfo.DisplayInfo.DisplayName; } catch { }
      try { var b = n.Notification.Visual.GetBinding(KnownNotificationBindings.ToastGeneric); if (b != null) foreach (var t in b.GetTextElements()) texts.Add(t.Text); } catch { }
      try { aid = n.AppInfo.AppUserModelId; } catch { }
      if (aid != "" && !iconCache.TryGetValue(aid, out icon)) {
        icon = "";
        try { var bytes = ReadAll(n.AppInfo.DisplayInfo.GetLogo(new Windows.Foundation.Size(32, 32))); if (bytes != null) icon = Convert.ToBase64String(bytes); } catch { }
        iconCache[aid] = icon;
      }
      var o = new Json().N("id", n.Id).S("app", app).S("aid", aid)
        .S("title", texts.Count > 0 ? texts[0] : null).S("body", string.Join(" ", texts.GetRange(Math.Min(1, texts.Count), Math.Max(0, texts.Count - 1)))).S("icon", icon ?? "");
      Out.WriteLine(new Json().O("notif", o).ToString());
    }
  }

  static void Run(GlobalSystemMediaTransportControlsSession s, string line) {
    var p = line.Trim().Split(' ');
    switch (p[0]) {
      case "vol": Audio.Set(float.Parse(p[1], CultureInfo.InvariantCulture)); break;
      case "mute": Audio.Mute(p[1] == "1"); break;
      case "play": Await(s.TryPlayAsync()); break;
      case "pause": Await(s.TryPauseAsync()); break;
      case "toggle": Await(s.TryTogglePlayPauseAsync()); break;
      case "next": Await(s.TrySkipNextAsync()); break;
      case "prev": Await(s.TrySkipPreviousAsync()); break;
      case "seek": Await(s.TryChangePlaybackPositionAsync((long)(double.Parse(p[1], CultureInfo.InvariantCulture) * 1e7))); break;
    }
  }

  [MTAThread]
  static int Main(string[] args) {
    uint ownPid = 0;
    string downloads = null;
    for (int i = 0; i + 1 < args.Length; i++) { if (args[i] == "--pid") uint.TryParse(args[i + 1], out ownPid); if (args[i] == "--downloads") downloads = args[i + 1]; }
    try { Activity.WatchDownloads(downloads); } catch { }
    Activity.WatchBluetooth();
    Activity.WatchPrivacy();
    Win.WatchClipOwner();
    List<string> cam = new List<string>(), mic = new List<string>(), prog = new List<string>();

    // stdin on its own thread; closing it (the app quit) ends the helper
    var reader = new Thread(() => {
      var inp = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
      string l; while ((l = inp.ReadLine()) != null) Commands.Add(l);
      stdinClosed = true; Commands.Add(null);
    }) { IsBackground = true };
    reader.Start();

    try {
      var l = UserNotificationListener.Current;
      var acc = l.GetAccessStatus();
      if (acc != UserNotificationListenerAccessStatus.Allowed) acc = Await(l.RequestAccessAsync());
      if (acc == UserNotificationListenerAccessStatus.Allowed) { notif = l; try { NewNotifications(true); } catch { } }   // don't replay what's already in the Action Center
    } catch { }

    var mgr = Await(GlobalSystemMediaTransportControlsSessionManager.RequestAsync());
    var md5 = MD5.Create();
    int br = Brightness(), loop = 0, polls = 0, dnd = -1;
    try { dnd = Win.Dnd(); } catch { }
    string lastKey = "", sentHash = "", prevHash = "";
    DateTime trackStart = DateTime.UtcNow;
    string early = null; bool hasEarly = false;   // a command that ended the wait below
    ulong toastStamp = 0; int toastReads = 0; DateTime lastToastRead = DateTime.MinValue;
    try { Win.ToastStamp(out toastStamp); } catch { }

    while (true) {
      try {
        var s = mgr != null ? mgr.GetCurrentSession() : null;
        bool acted = false; string cmd;
        while (true) {   // every command that arrived since the last poll
          if (hasEarly) { cmd = early; hasEarly = false; early = null; } else if (!Commands.TryTake(out cmd)) break;
          if (cmd == null) return 0;
          var c = cmd.Trim();
          if (c.Length > 0 && (s != null || c.StartsWith("vol ") || c.StartsWith("mute "))) { try { Run(s, c); } catch { } acted = true; }
        }
        if (stdinClosed) return 0;
        if (acted) { Thread.Sleep(120); s = mgr.GetCurrentSession(); }
        double vol = -1; bool muted = false;
        try { vol = Math.Round(Audio.Get(), 3); muted = Audio.Muted(); } catch { }
        loop++;
        if (loop % 3 == 0) br = Brightness();
        bool fs = false; try { fs = Win.Fullscreen(ownPid); } catch { }
        uint cb = 0; try { cb = Win.GetClipboardSequenceNumber(); } catch { }
        string cbo = ""; try { cbo = Win.ClipOwner(); } catch { }
        if (notif != null) {
          // a toast was shown → read the Action Center now and once more next round (it may not be stored
          // yet); otherwise only every 10 s as a safety net. Without the signal: every second, as before.
          ulong ts; bool sig = false; try { sig = Win.ToastStamp(out ts); } catch { ts = 0; }
          if (sig && ts != toastStamp) { toastStamp = ts; toastReads = 2; }
          bool due = sig ? (toastReads > 0 || (DateTime.UtcNow - lastToastRead).TotalSeconds >= 10) : loop % 3 == 1;
          if (due) { if (toastReads > 0) toastReads--; lastToastRead = DateTime.UtcNow; try { NewNotifications(false); } catch { } }
        }
        if (loop % 3 == 2) {   // about once a second
          if (Activity.PrivacyChanged()) try { cam = Activity.InUse("webcam").Select(Json.Q).ToList(); mic = Activity.InUse("microphone").Select(Json.Q).ToList(); } catch { }
          try { prog = Activity.Progress(); } catch { }
          try { dnd = Win.Dnd(); } catch { }
          try { foreach (var l in Activity.BluetoothChanges()) Out.WriteLine(l); } catch { }
        }
        for (string d; (d = Activity.NextDone()) != null; ) Out.WriteLine(d);
        if (s == null) {
          Out.WriteLine(new Json().B("none", true).N("vol", vol).B("muted", muted).N("br", br).B("fs", fs).N("cb", cb).S("cbo", cbo).N("dnd", dnd).A("cam", cam).A("mic", mic).A("prog", prog).ToString());
          lastKey = "";
        } else {
          var pr = Await(s.TryGetMediaPropertiesAsync());
          var tl = s.GetTimelineProperties();
          bool playing = s.GetPlaybackInfo().PlaybackStatus == GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
          double pos = tl.Position.TotalSeconds;
          if (playing) pos += (DateTimeOffset.UtcNow - tl.LastUpdatedTime).TotalSeconds;
          string title = pr != null ? pr.Title : "", artist = pr != null ? pr.Artist : "";
          string key = title + "|" + artist;
          var o = new Json().S("title", title).S("artist", artist).N("dur", (tl.EndTime - tl.StartTime).TotalSeconds).N("pos", pos)
            .B("playing", playing).S("app", s.SourceAppUserModelId).N("vol", vol).B("muted", muted).N("br", br).B("fs", fs).N("cb", cb).S("cbo", cbo).N("dnd", dnd).A("cam", cam).A("mic", mic).A("prog", prog);
          string thumb = null;
          if (key != lastKey) {
            lastKey = key; thumb = "";
            if (sentHash != "") prevHash = sentHash;
            sentHash = ""; trackStart = DateTime.UtcNow; polls = 0;
          }
          // Windows often keeps serving the previous song's cover for a moment after the title changes,
          // and some players update the artwork later. So: re-check the cover during the first 20 s of a
          // song, never accept the previous song's cover in the first 4 s, and resend whenever it changes.
          double age = (DateTime.UtcNow - trackStart).TotalSeconds; polls++;
          if (age < 20 && (sentHash == "" || polls % 6 == 0) && pr != null) {
            try {
              var bytes = ReadAll(pr.Thumbnail);
              if (bytes != null && bytes.Length > 0) {
                string h = BitConverter.ToString(md5.ComputeHash(bytes));
                if (h != sentHash && !(h == prevHash && age < 4)) { thumb = Convert.ToBase64String(bytes); sentHash = h; }
              }
            } catch { }
          }
          if (thumb != null) o.S("thumb", thumb);
          Out.WriteLine(o.ToString());
        }
      } catch { }
      try { Out.Flush(); } catch { return 0; }   // the app is gone
      // wait for the next poll, but wake at once for a command (play/pause, volume…): one wake-up per poll
      // instead of six 50 ms naps
      hasEarly = Commands.TryTake(out early, 300);
    }
  }
}
