# Deploy automatizado do MyTTS Studio para São Paulo (southamerica-east1)
# Inclui Cloud Run em southamerica-east1 + Firebase Hosting com URL curta (.web.app)

$ErrorActionPreference = "Stop"
$ProjectId = "agent-md-506215"
$Region = "southamerica-east1"
$ServiceName = "mytts"

Write-Host "[1/3] Gerando bundle de producao (npm run build)..." -ForegroundColor Cyan
npm run build

Write-Host "[2/3] Publicando servico Cloud Run '$ServiceName' na regiao Sao Paulo ($Region)..." -ForegroundColor Cyan
# Nota WebSocket (/ws/live): O Firebase Hosting faz rewrite apenas de HTTP (/api/**) e nao faz proxy de WebSocket.
# Configure $CloudRunWsOrigin (ex: "wss://mytts-<hash>-rj.a.run.app") quando quiser conectar /ws/live direto de https://mytts.web.app.
$EnvVars = "GCP_PROJECT_ID=$ProjectId,FIRESTORE_DATABASE_ID=(default),GOOGLE_CLOUD_LOCATION=global,VERTEX_LIVE_AGENT_LOCATION=us-central1"
if ($env:CLOUD_RUN_WS_ORIGIN) {
  $EnvVars = "$EnvVars,CLOUD_RUN_WS_ORIGIN=$($env:CLOUD_RUN_WS_ORIGIN)"
}
if ($env:GOOGLE_CLIENT_ID) {
  $EnvVars = "$EnvVars,GOOGLE_CLIENT_ID=$($env:GOOGLE_CLIENT_ID)"
}
if ($env:AUTH_SESSION_SECRET) {
  $EnvVars = "$EnvVars,AUTH_SESSION_SECRET=$($env:AUTH_SESSION_SECRET)"
}

gcloud run deploy $ServiceName `
  --source . `
  --project $ProjectId `
  --region $Region `
  --timeout=900 `
  --allow-unauthenticated `
  --quiet `
  --update-env-vars="$EnvVars"

Write-Host "[3/3] Publicando URL curta no Firebase Hosting (https://mytts.web.app -> $Region)..." -ForegroundColor Cyan
npx firebase-tools deploy --only hosting:mytts --project $ProjectId

Write-Host "Deploy concluido! URL curta disponivel em: https://mytts.web.app" -ForegroundColor Green
