$url = 'https://stokaowohpgnyaijsxzq.supabase.co'
$key = 'sb_publishable_JE1PrtNqxLeVb-ONdVenxw_D7S1ohTm'
$headers = @{ apikey = $key; Authorization = "Bearer $key" }

foreach ($t in 'hmc_records', 'hmc_user_roles', 'patient_token_slips') {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Uri "$url/rest/v1/$t`?select=*&limit=1" -Headers $headers
    Write-Output "TABLE $t -> HTTP $($r.StatusCode) $($r.Content)"
  } catch {
    $body = ''
    if ($_.Exception.Response) {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $sr.ReadToEnd()
    }
    Write-Output "TABLE $t -> ERROR $($_.Exception.Message) $body"
  }
}

$rpcs = @{
  'next_hmc_id' = '{"p_collection":"x"}'
  'apply_hmc_record_changes' = '{"p_collection":"x","p_inserts":[],"p_updates":[],"p_delete_ids":[]}'
  'create_patient_token' = '{"p_customer_name":"x"}'
}
foreach ($fn in $rpcs.Keys) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri "$url/rest/v1/rpc/$fn" -Headers $headers -ContentType 'application/json' -Body $rpcs[$fn]
    Write-Output "RPC $fn -> HTTP $($r.StatusCode) $($r.Content)"
  } catch {
    $body = ''
    if ($_.Exception.Response) {
      $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $body = $sr.ReadToEnd()
    }
    Write-Output "RPC $fn -> ERROR $body"
  }
}
