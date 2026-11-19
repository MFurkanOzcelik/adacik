param([int]$PastDays = 31, [int]$FutureDays = 120)
# Prints the appointments in the Windows calendar store (Outlook, Microsoft and other accounts added to Windows)
# as a JSON array. Read-only.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); [void]$t.Wait(15000); $t.Result }
[void][Windows.ApplicationModel.Appointments.AppointmentManager, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
[void][Windows.ApplicationModel.Appointments.AppointmentStore, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
[void][Windows.ApplicationModel.Appointments.Appointment, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
[void][Windows.ApplicationModel.Appointments.AppointmentCalendar, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
[void][Windows.ApplicationModel.Appointments.FindAppointmentsOptions, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
[void][Windows.ApplicationModel.Appointments.AppointmentProperties, Windows.ApplicationModel.Appointments, ContentType=WindowsRuntime]
$store = Await ([Windows.ApplicationModel.Appointments.AppointmentManager]::RequestStoreAsync([Windows.ApplicationModel.Appointments.AppointmentStoreAccessType]::AllCalendarsReadOnly)) ([Windows.ApplicationModel.Appointments.AppointmentStore])
$cals = Await ($store.FindAppointmentCalendarsAsync()) ([System.Collections.Generic.IReadOnlyList[Windows.ApplicationModel.Appointments.AppointmentCalendar]])
$names = @{}; foreach ($c in $cals) { $names[$c.LocalId] = $c.DisplayName }
$o = New-Object Windows.ApplicationModel.Appointments.FindAppointmentsOptions
$add = [System.Collections.Generic.ICollection[string]].GetMethod('Add')   # FetchProperties is a bare COM list
foreach ($p in 'Subject', 'StartTime', 'Duration', 'Location', 'AllDay', 'IsCanceledMeeting') { [void]$add.Invoke($o.FetchProperties, @([Windows.ApplicationModel.Appointments.AppointmentProperties]::$p)) }
$from = [DateTimeOffset]::Now.Date.AddDays(-$PastDays)
$list = Await ($store.FindAppointmentsAsync([DateTimeOffset]$from, [TimeSpan]::FromDays($PastDays + $FutureDays), $o)) ([System.Collections.Generic.IReadOnlyList[Windows.ApplicationModel.Appointments.Appointment]])
$out = @()
foreach ($a in $list) {
  $cal = $names[$a.CalendarId]
  if ($cal -match '^(weather|gleam)-' -or $a.IsCanceledMeeting) { continue }   # Windows' built-in weather/suggestion feeds
  $out += [ordered]@{ title = $a.Subject; start = $a.StartTime.UtcDateTime.ToString('o'); min = [int]$a.Duration.TotalMinutes; allDay = [bool]$a.AllDay; loc = $a.Location; cal = $cal }
}
ConvertTo-Json -InputObject @($out) -Compress -Depth 3
