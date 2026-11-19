param([int]$OwnPid = 0)
# Background helper for Klon Notch. Prints one JSON line per poll (~300 ms) with:
#   media session (title, artist, cover, position), system volume, screen brightness,
#   clipboard sequence number (so the app only reads the clipboard when it changed),
#   whether the foreground window is fullscreen, and new Windows notifications.
# Commands arrive on stdin, one per line: play | pause | toggle | next | prev | seek <s> | vol <0-1> | mute <0|1>
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
# System (default output device) volume through Core Audio.
Add-Type -TypeDefinition @'
using System; using System.Runtime.InteropServices;
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
public static class KlonAudio {
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
'@
Add-Type -TypeDefinition @'
using System; using System.Text; using System.Runtime.InteropServices;
public static class KlonWin {
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
'@
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(3000); $t.Result }
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.IRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType=WindowsRuntime]

# The stream comes back as a bare COM object, so its members are reached through the interface type.
function Read-Thumb($ref) {
  if (-not $ref) { return $null }
  $st = Await ($ref.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
  if (-not $st) { return $null }
  $ras = [Windows.Storage.Streams.IRandomAccessStream]
  $size = [uint32]$ras.GetProperty('Size').GetValue($st)
  if ($size -eq 0) { return $null }
  $inp = $ras.GetMethod('GetInputStreamAt').Invoke($st, @([uint64]0))
  $dr = [Windows.Storage.Streams.DataReader].GetConstructor(@([Windows.Storage.Streams.IInputStream])).Invoke(@($inp))
  $n = Await ($dr.LoadAsync($size)) ([uint32])
  $bytes = New-Object byte[] $n; $dr.ReadBytes($bytes)
  return ,$bytes
}
# ---- notifications (read-only listener; Windows asks the user once if needed) ----
$notif = $null; $seen = New-Object 'System.Collections.Generic.HashSet[uint32]'; $iconCache = @{}
try {
  [void][Windows.UI.Notifications.Management.UserNotificationListener, Windows.UI.Notifications, ContentType=WindowsRuntime]
  [void][Windows.UI.Notifications.UserNotification, Windows.UI.Notifications, ContentType=WindowsRuntime]
  [void][Windows.UI.Notifications.KnownNotificationBindings, Windows.UI.Notifications, ContentType=WindowsRuntime]
  [void][Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus, Windows.UI.Notifications, ContentType=WindowsRuntime]
  $l = [Windows.UI.Notifications.Management.UserNotificationListener]::Current
  $acc = $l.GetAccessStatus()
  if ($acc -ne 'Allowed') { $acc = Await ($l.RequestAccessAsync()) ([Windows.UI.Notifications.Management.UserNotificationListenerAccessStatus]) }
  if ($acc -eq 'Allowed') { $notif = $l }
} catch {}
$listType = [System.Collections.Generic.IReadOnlyList[Windows.UI.Notifications.UserNotification]]
function Get-NewNotifications([bool]$prime) {
  $out = @()
  $list = Await ($notif.GetNotificationsAsync([Windows.UI.Notifications.NotificationKinds]::Toast)) $listType
  foreach ($n in $list) {
    if (-not $seen.Add($n.Id) -or $prime) { continue }
    $app = ''; try { $app = $n.AppInfo.DisplayInfo.DisplayName } catch {}
    $texts = @(); try { $b = $n.Notification.Visual.GetBinding([Windows.UI.Notifications.KnownNotificationBindings]::ToastGeneric); if ($b) { $texts = @($b.GetTextElements() | ForEach-Object { $_.Text }) } } catch {}
    $icon = ''; $aid = ''; try { $aid = $n.AppInfo.AppUserModelId } catch {}
    if ($aid -and $iconCache.ContainsKey($aid)) { $icon = $iconCache[$aid] }
    elseif ($aid) { try { $bytes = Read-Thumb ($n.AppInfo.DisplayInfo.GetLogo((New-Object Windows.Foundation.Size 32, 32))); if ($bytes) { $icon = [Convert]::ToBase64String($bytes) } } catch {}; $iconCache[$aid] = $icon }
    $out += [ordered]@{ id = $n.Id; app = $app; title = ($texts | Select-Object -First 1); body = (($texts | Select-Object -Skip 1) -join ' '); icon = $icon }
  }
  return ,$out
}
if ($notif) { try { [void](Get-NewNotifications $true) } catch {} }   # don't replay what is already in the Action Center

# ---- screen brightness (laptops; fails quietly on desktops) ----
$brOk = $true; $loop = 0
function Get-Brightness { if (-not $script:brOk) { return -1 }; try { return [int](Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1).CurrentBrightness } catch { $script:brOk = $false; return -1 } }
$br = Get-Brightness

$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
$stdin = New-Object System.IO.StreamReader([Console]::OpenStandardInput(), [System.Text.Encoding]::UTF8)
$pending = $stdin.ReadLineAsync()
$lastKey = ''
$sentHash = ''; $prevHash = ''; $trackStart = [DateTime]::UtcNow; $polls = 0
$md5 = [System.Security.Cryptography.MD5]::Create()

function Run-Command($s, $line) {
  $p = $line.Trim().Split(' ')
  switch ($p[0]) {
    'vol'    { [KlonAudio]::Set([float]::Parse($p[1], [Globalization.CultureInfo]::InvariantCulture)) }
    'mute'   { [KlonAudio]::Mute($p[1] -eq '1') }
    'play'   { [void](Await ($s.TryPlayAsync()) ([bool])) }
    'pause'  { [void](Await ($s.TryPauseAsync()) ([bool])) }
    'toggle' { [void](Await ($s.TryTogglePlayPauseAsync()) ([bool])) }
    'next'   { [void](Await ($s.TrySkipNextAsync()) ([bool])) }
    'prev'   { [void](Await ($s.TrySkipPreviousAsync()) ([bool])) }
    'seek'   { [void](Await ($s.TryChangePlaybackPositionAsync([long]([double]$p[1] * 1e7))) ([bool])) }
  }
}

while ($true) {
  $acted = $false
  try {
    $s = $mgr.GetCurrentSession()
    # Drain every command that arrived since the last poll.
    while ($pending.IsCompleted) {
      $line = $pending.Result
      if ($null -eq $line) { exit }   # stdin closed: the app quit
      if ($line.Trim() -and ($s -or $line -match '^(vol|mute) ')) { try { Run-Command $s $line } catch {}; $acted = $true }
      $pending = $stdin.ReadLineAsync()
    }
    if ($acted) { Start-Sleep -Milliseconds 120; $s = $mgr.GetCurrentSession() }
    $vol = -1; $muted = $false; try { $vol = [math]::Round([KlonAudio]::Get(), 3); $muted = [KlonAudio]::Muted() } catch {}
    $loop++
    if ($loop % 3 -eq 0) { $br = Get-Brightness }
    $fs = $false; try { $fs = [KlonWin]::Fullscreen([uint32]$OwnPid) } catch {}
    $cb = 0; try { $cb = [KlonWin]::GetClipboardSequenceNumber() } catch {}
    if ($notif -and $loop % 3 -eq 1) { try { foreach ($x in (Get-NewNotifications $false)) { (@{ notif = $x } | ConvertTo-Json -Compress -Depth 4) } } catch {} }
    if (-not $s) { (@{ none = $true; vol = $vol; muted = $muted; br = $br; fs = $fs; cb = $cb } | ConvertTo-Json -Compress); $lastKey = '' }
    else {
      $pr = Await ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      $tl = $s.GetTimelineProperties()
      $playing = ([int]$s.GetPlaybackInfo().PlaybackStatus -eq 4)
      $pos = $tl.Position.TotalSeconds
      if ($playing) { $pos += ([DateTimeOffset]::UtcNow - $tl.LastUpdatedTime).TotalSeconds }
      $key = $pr.Title + '|' + $pr.Artist
      $o = [ordered]@{ title = $pr.Title; artist = $pr.Artist; dur = ($tl.EndTime.TotalSeconds - $tl.StartTime.TotalSeconds); pos = $pos; playing = $playing; app = $s.SourceAppUserModelId; vol = $vol; muted = $muted; br = $br; fs = $fs; cb = $cb }
      if ($key -ne $lastKey) {
        $lastKey = $key; $o.thumb = ''
        if ($sentHash) { $prevHash = $sentHash }
        $sentHash = ''; $trackStart = [DateTime]::UtcNow; $polls = 0
      }
      # Windows often keeps serving the previous song's cover for a moment after the title changes,
      # and some players update the artwork later. So: re-check the cover during the first 20 s of a
      # song, never accept the previous song's cover in the first 4 s, and resend whenever it changes.
      $age = ([DateTime]::UtcNow - $trackStart).TotalSeconds; $polls++
      if ($age -lt 20 -and (-not $sentHash -or $polls % 6 -eq 0)) {
        try {
          $bytes = Read-Thumb $pr.Thumbnail
          if ($bytes -and $bytes.Length) {
            $h = [BitConverter]::ToString($md5.ComputeHash($bytes))
            if ($h -ne $sentHash -and -not ($h -eq $prevHash -and $age -lt 4)) { $o.thumb = [Convert]::ToBase64String($bytes); $sentHash = $h }
          }
        } catch {}
      }
      $o | ConvertTo-Json -Compress
    }
  } catch {}
  [Console]::Out.Flush()
  # Sleep in short steps so a command is handled within ~50 ms.
  for ($i = 0; $i -lt 6 -and -not $pending.IsCompleted; $i++) { Start-Sleep -Milliseconds 50 }
}
