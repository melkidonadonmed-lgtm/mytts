# Deploy automatizado do MyTTS Studio para São Paulo (southamerica-east1)
# Inclui Cloud Run em southamerica-east1 + Firebase Hosting com URL curta (.web.app)

$ErrorActionPreference = "Stop"
$ProjectId = "agent-md-506215"
$Region = "southamerica-east1"
$ServiceName = "mytts"

Write-Host "[1/3] Gerando bundle de producao (npm run build)..." -ForegroundColor Cyan
npm run build

Write-Host "[2/3] Publicando servico Cloud Run '$ServiceName' na regiao Sao Paulo ($Region)..." -ForegroundColor Cyan
gcloud run deploy $ServiceName `
  --source . `
  --project $ProjectId `
  --region $Region `
  --allow-unauthenticated `
  --quiet `
  --set-env-vars="GCP_PROJECT_ID=$ProjectId,FIRESTORE_DATABASE_ID=(default),GOOGLE_CLOUD_LOCATION=global"

Write-Host "[3/3] Publicando URL curta no Firebase Hosting (https://mytts.web.app -> $Region)..." -ForegroundColor Cyan
npx firebase-tools deploy --only hosting:mytts --project $ProjectId

Write-Host "Deploy concluido! URL curta disponivel em: https://mytts.web.app" -ForegroundColor Green
