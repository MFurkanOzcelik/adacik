# Compiles helper.cs into adacik-helper.exe with the C# compiler that ships with Windows (.NET Framework 4).
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$fw = "$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319"
$md = "$env:WINDIR\System32\WinMetadata"
$refs = @(
  "$fw\System.Runtime.dll", "$fw\System.Runtime.WindowsRuntime.dll", "$fw\System.Runtime.InteropServices.WindowsRuntime.dll",
  "$fw\System.Threading.Tasks.dll", "$fw\System.Management.dll", "$fw\System.Core.dll", "$fw\System.Collections.dll",
  "$md\Windows.Foundation.winmd", "$md\Windows.Media.winmd", "$md\Windows.Storage.winmd", "$md\Windows.UI.winmd", "$md\Windows.ApplicationModel.winmd",
  "$md\Windows.Devices.winmd", "$md\Windows.Management.winmd"
) | ForEach-Object { "/r:$_" }
& "$fw\csc.exe" /nologo /target:winexe /platform:x64 /optimize+ /out:"$here\adacik-helper.exe" $refs "$here\helper.cs"
if ($LASTEXITCODE -ne 0) { throw "helper build failed" }
"built $here\adacik-helper.exe"
