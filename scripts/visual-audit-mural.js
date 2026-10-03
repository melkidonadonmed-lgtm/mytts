/**
 * scripts/visual-audit-mural.js
 * Utilitário de automação para captura sequencial de telas e montagem de mural comparativo.
 * Adaptado para o MyTTS Studio (SPA de abas): navega clicando na sidebar real.
 * Como executar: node scripts/visual-audit-mural.js
 */

import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  outputDir: path.join(__dirname, '../audit-artifacts/screenshots'),
  settleMs: 900,
  viewports: [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'mobile', width: 375, height: 812 }
  ],
  // Abas reais do App.tsx, na ordem da sidebar (src/components/Sidebar.tsx)
  tabs: [
    { name: '01_estudio_criacao', label: 'Estúdio de Criação' },
    { name: '02_chat_poliglota', label: 'Chat Poliglota' },
    { name: '03_microfone_ditado', label: 'Microfone & Ditado' },
    { name: '04_estudio_debate', label: 'Estúdio de Debate' },
    { name: '05_fastchunks', label: 'FastChunks' },
    { name: '06_biblioteca_vozes', label: 'Biblioteca de Vozes' }
  ]
};

async function openMobileDrawerIfNeeded(page, viewport) {
  if (viewport.name !== 'mobile') return;
  const opener = page.locator('button[aria-label="Abrir menu de navegação"]');
  if (await opener.isVisible()) {
    await opener.click();
    await page.waitForTimeout(500);
  }
}

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
    console.log(`\n[Viewport] ${viewport.name} (${viewport.width}x${viewport.height})`);

    // Carga inicial (aba padrão: Estúdio de Criação)
    try {
      const response = await page.goto(CONFIG.baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
      await page.waitForTimeout(CONFIG.settleMs);
      const fileName = `00_initial_${viewport.name}.png`;
      await page.screenshot({ path: path.join(CONFIG.outputDir, fileName), fullPage: true });
      manifest.push({ route: '/', viewport: viewport.name, status: response ? response.status() : 'ERRO', file: fileName });
      console.log(`     [OK] 00_initial (${manifest[manifest.length - 1].status})`);
    } catch (err) {
      console.error(`     [FALHA] carga inicial: ${err.message}`);
      continue;
    }

    // Percorre as abas clicando nos botões reais da sidebar
    for (const tab of CONFIG.tabs) {
      const fileName = `${tab.name}_${viewport.name}.png`;
      try {
        await openMobileDrawerIfNeeded(page, viewport);
        await page.getByRole('button', { name: new RegExp(tab.label, 'i') }).first().click();
        await page.waitForTimeout(CONFIG.settleMs);
        await page.screenshot({ path: path.join(CONFIG.outputDir, fileName), fullPage: true });
        manifest.push({ route: `tab:${tab.label}`, viewport: viewport.name, status: 200, file: fileName });
        console.log(`     [OK] ${tab.name}`);
      } catch (err) {
        console.error(`     [FALHA] ${tab.name}: ${err.message}`);
        manifest.push({ route: `tab:${tab.label}`, viewport: viewport.name, status: 'ERRO', file: fileName });
      }
    }

    // Modal de Arquitetura & Governança
    const archFile = `07_arquitetura_${viewport.name}.png`;
    try {
      await openMobileDrawerIfNeeded(page, viewport);
      await page.getByRole('button', { name: /Arquitetura/i }).first().click();
      await page.waitForTimeout(CONFIG.settleMs);
      await page.screenshot({ path: path.join(CONFIG.outputDir, archFile), fullPage: true });
      manifest.push({ route: 'modal:Arquitetura', viewport: viewport.name, status: 200, file: archFile });
      console.log(`     [OK] 07_arquitetura`);
      await page.getByRole('button', { name: /^Fechar$/i }).first().click();
      await page.waitForTimeout(400);
    } catch (err) {
      console.error(`     [FALHA] 07_arquitetura: ${err.message}`);
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
    <h1>Mural Visual de Auditoria de Telas e Transições — MyTTS Studio</h1>
    <p>Total de capturas realizadas: ${manifest.length}</p>
    <div class="grid">
      ${manifest.map(item => `
        <div class="card">
          <div class="card-header">${item.file} — rota: ${item.route} — HTTP: ${item.status} — viewport: ${item.viewport}</div>
          <img src="./${item.file}" alt="${item.file}" loading="lazy" />
        </div>
      `).join('')}
    </div>
  </body>
  </html>
  `;
  fs.writeFileSync(muralHtmlPath, muralHtml, 'utf-8');
  console.log(`\n[Mural] Gerado em: ${muralHtmlPath}`);
  console.log(`[Auditoria Visual] Concluída: ${manifest.length} capturas.`);
}

runVisualAudit().catch((err) => {
  console.error('[Auditoria Visual] Falha fatal:', err);
  process.exit(1);
});
