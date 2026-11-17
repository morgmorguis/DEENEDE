# Despliega el servidor de partida de «Di en Di» en Google Cloud Run, dentro del proyecto de Firebase.
# La partida, las imágenes y las fichas sincronizadas se guardan en un depósito de Cloud Storage.
#
# Uso (desde la carpeta del proyecto):
#   powershell -ExecutionPolicy Bypass -File server\nube\desplegar.ps1 -Proyecto ID-DEL-PROYECTO
#   powershell -ExecutionPolicy Bypass -File server\nube\desplegar.ps1 -Proyecto ID-DEL-PROYECTO -Enlaces   (solo enseña los enlaces)
# Guía completa: server\NUBE.txt
param(
  [Parameter(Mandatory = $true)][string]$Proyecto,
  [string]$Region = 'europe-southwest1',
  [string]$Servicio = 'di-en-di',
  [switch]$Enlaces
)
$ErrorActionPreference = 'Stop'
function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
# gcloud con comprobación de errores (los programas externos no lanzan excepciones en PowerShell)
function G { & gcloud @args; if ($LASTEXITCODE -ne 0) { throw "Ha fallado: gcloud $($args -join ' ')" } }
# ¿Existe ya? (sin ensuciar la pantalla con el error de «no encontrado»)
# (en PowerShell 5.1, redirigir los errores de un programa con 'Stop' lanzaría una excepción: aquí se relaja)
function Existe { $ErrorActionPreference = 'Continue'; & gcloud @args *> $null; return $LASTEXITCODE -eq 0 }

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'No encuentro gcloud. Instala Google Cloud CLI (https://cloud.google.com/sdk/docs/install), abre una ventana nueva y ejecuta «gcloud auth login».'
}
Set-Location (Resolve-Path "$PSScriptRoot\..\..")
$Bucket = "$Proyecto-di-en-di-partida"
G config set project $Proyecto --quiet

function Url-Servicio {
  $url = (& gcloud run services describe $Servicio --region $Region --format 'value(status.url)').Trim()
  if (-not $url) { throw "No encuentro el servicio $Servicio en $Region. Despliégalo primero (sin -Enlaces)." }
  return $url
}
# La dirección corta https://PROYECTO.web.app, si ya apunta a este servidor
function Url-Corta($url) {
  try { $j = Invoke-RestMethod "https://$Proyecto.web.app/servidor.json" -TimeoutSec 15; if ($j.url -eq $url) { return "https://$Proyecto.web.app" } } catch { }
  return $null
}

function Mostrar-Enlaces {
  $url = Url-Servicio
  $corta = Url-Corta $url
  $ver = if ($corta) { $corta } else { $url }
  # Despierta el servidor: al arrancar crea la partida si no existe
  try { Invoke-WebRequest "$url/api/info" -UseBasicParsing -TimeoutSec 60 | Out-Null } catch { }
  Start-Sleep -Seconds 2
  $room = (& gcloud storage cat "gs://$Bucket/partida.json") -join "`n" | ConvertFrom-Json
  Write-Host "`n================================================================" -ForegroundColor Green
  Write-Host "  Di en Di en la nube: $ver" -ForegroundColor Green
  if ($corta) { Write-Host "  (servidor real: $url — escríbelo así en la app de Android 0.24 o anterior)" }
  Write-Host "================================================================" -ForegroundColor Green
  Write-Host "  Código de la partida (jugadores): $($room.code)"
  Write-Host "  Clave del DM (no la compartas):   $($room.dmKey)"
  Write-Host ''
  Write-Host "  DM, en el navegador:        $ver/dm?dm=$($room.dmKey)"
  Write-Host "  Jugadores, en el navegador: $ver/?join=$($room.code)"
  Write-Host "  En la app: Partida -> dirección $ver y el código (o la clave del DM)."
  Write-Host ''
}

if ($Enlaces) { Mostrar-Enlaces; return }

Paso 'Activando los servicios de Google Cloud (la primera vez tarda un poco)'
G services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com storage.googleapis.com

Paso "Depósito de la partida: gs://$Bucket"
if (-not (Existe storage buckets describe "gs://$Bucket")) {
  G storage buckets create "gs://$Bucket" --location=$Region --uniform-bucket-level-access
}
$numero = (& gcloud projects describe $Proyecto --format 'value(projectNumber)').Trim()
$cuenta = "serviceAccount:$numero-compute@developer.gserviceaccount.com"
# El servidor (y Cloud Build, que usa la misma cuenta) necesitan leer y escribir ahí
G storage buckets add-iam-policy-binding "gs://$Bucket" --member=$cuenta --role=roles/storage.objectAdmin --quiet | Out-Null
G projects add-iam-policy-binding $Proyecto --member=$cuenta --role=roles/cloudbuild.builds.builder --condition=None --quiet | Out-Null

Paso 'Repositorio de imágenes'
if (-not (Existe artifacts repositories describe $Servicio --location=$Region)) {
  G artifacts repositories create $Servicio --repository-format=docker --location=$Region --description='Servidor de Di en Di'
}

$imagen = "$Region-docker.pkg.dev/$Proyecto/$Servicio/servidor:$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Paso "Compilando en Cloud Build (unos minutos): $imagen"
G builds submit --config server/nube/cloudbuild.yaml --substitutions "_IMAGEN=$imagen" .

Paso "Desplegando en Cloud Run: $Servicio ($Region)"
if (Existe run services describe $Servicio --region=$Region) {
  # Ya existe: solo cambia la imagen y conserva el resto (depósito, límites…)
  G run deploy $Servicio --image $imagen --region $Region --quiet
} else {
  # Una sola instancia (la partida vive en memoria), conexiones de hasta 1 hora y la partida en el depósito
  G run deploy $Servicio --image $imagen --region $Region --quiet `
    --allow-unauthenticated --execution-environment gen2 `
    --min-instances 0 --max-instances 1 --concurrency 200 --timeout 3600 --session-affinity `
    --cpu 1 --memory 512Mi `
    --add-volume "name=partida,type=cloud-storage,bucket=$Bucket" `
    --add-volume-mount 'volume=partida,mount-path=/datos'
}

Paso "Dirección corta: https://$Proyecto.web.app (Firebase Hosting)"
G services enable firebasehosting.googleapis.com
$url = Url-Servicio
$env:GCLOUD_TOKEN = (& gcloud auth print-access-token).Trim()
& node server/nube/hosting.mjs $Proyecto $url
if ($LASTEXITCODE -ne 0) {
  Write-Host '  No se ha podido publicar la dirección corta; la larga funciona igual.' -ForegroundColor Yellow
} else {
  # El servidor enseña la dirección corta al DM en «Invitar jugadores» (solo cambia la primera vez)
  $corta = "https://$Proyecto.web.app"
  $actual = (& gcloud run services describe $Servicio --region $Region --format 'value(spec.template.spec.containers[0].env)')
  if ("$actual" -notmatch [regex]::Escape($corta)) {
    G run services update $Servicio --region $Region --update-env-vars "DI_EN_DI_URL=$corta" --quiet
  }
}

Mostrar-Enlaces
