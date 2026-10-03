/**
 * scripts/visual-audit-mural.js
 * Utilitário de automação para captura sequencial de rotas e montagem de mural comparativo.
 * Dependências necessárias: npm install -D playwright
 * Como executar: node scripts/visual-audit-mural.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuração das rotas a serem auditadas no projeto
const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  outputDir: path.join(__dirname, '../audit-artifacts/screenshots'),
  viewports: [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile', width: 375, height: 812 }
  ],
  routes: [
    { path: '/', name: '01_home' },
    { path: '/dashboard', name: '02_dashboard' },
    { path: '/settings', name: '03_settings' }
  ]
};

async function runVisualAudit() {
  console.log('[Auditoria Visual] Iniciando esteira de captura de telas...');
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const manifest = [];

  for (const viewport of CONFIG.viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    console.log(`\n[Viewport] Configurado para ${viewport.name} (${viewport.width}x${viewport.height})`);

    for (const route of CONFIG.routes) {
      const targetUrl = `${CONFIG.baseUrl}${route.path}`;
      const fileName = `${route.name}_${viewport.name}.png`;
      const filePath = path.join(CONFIG.outputDir, fileName);

      try {
        console.log(`  -> Navegando para: ${targetUrl}`);
        const response = await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });
        const statusCode = response ? response.status() : 'ERRO';

        // Captura a tela inteira (full page) para avaliar estabilidade
        await page.screenshot({ path: filePath, fullPage: true });

        manifest.push({
          route: route.path,
          viewport: viewport.name,
          status: statusCode,
          file: fileName
        });
        console.log(`     [OK] Captura salva: ${fileName}`);
      } catch (err) {
        console.error(`     [FALHA] Não foi possível capturar ${targetUrl}: ${err.message}`);
      }
    }
  }

  await browser.close();

  // Gera o arquivo HTML do Mural Visual Unificado
  const muralHtmlPath = path.join(CONFIG.outputDir, 'mural_visual.html');
  const muralHtml = `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>Mural Visual de Auditoria</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
      h1 { font-size: 20px; border-bottom: 1px solid #334155; padding-bottom: 12px; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 20px; margin-top: 20px; }
      .card { background: #1e293b; border-radius: 8px; border: 1px solid #334155; overflow: hidden; }
      .card-header { padding: 12px; font-size: 13px; font-weight: bold; background: #273549; }
      .card img { width: 100%; height: auto; display: block; }
    </style>
  </head>
  <body>
    <h1>Mural Visual de Auditoria de Telas e Transições</h1>
    <p>Total de capturas realizadas: ${manifest.length}</p>
    <div class="grid">
      ${manifest.map(item => `
        <div class="card">
          <div class="card-header">${item.route} - [${item.viewport.toUpperCase()}] (Status:${item.status})</div>
          <img src="./${item.file}" alt="${item.route}" loading="lazy" />
        </div>
      `).join('')}
    </div>
  </body>
  </html>
  `;

  fs.writeFileSync(muralHtmlPath, muralHtml, 'utf-8');
  console.log(`\n[Auditoria Concluída] Mural unificado gerado em: ${muralHtmlPath}`);
}

// Para executar o script diretamente
if (require.main === module) {
  runVisualAudit().catch(err => {
    console.error('[Erro Fatal]', err);
    process.exit(1);
  });
}

module.exports = { runVisualAudit };
