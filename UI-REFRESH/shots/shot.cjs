// Best-effort before/after screenshots for the UI refresh.
// Usage: node shot.mjs <baseUrl> <prefix>
// e.g. node shot.mjs http://localhost:3101 before
const { chromium } = require('playwright-core');

const [baseUrl, prefix] = process.argv.slice(2);
if (!baseUrl || !prefix) {
  console.error('usage: node shot.mjs <baseUrl> <prefix>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch({
    executablePath: '/home/hatch/.cache/ms-playwright/chromium-1243/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const shots = [
    { name: `${prefix}-home.png`, width: 1440, height: 900, mobile: false },
    { name: `${prefix}-mobile.png`, width: 390, height: 844, mobile: true },
  ];
  for (const s of shots) {
    const page = await browser.newPage({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      deviceScaleFactor: 1,
    });
    // Landing headline is the readiness signal; fall back to network idle.
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await page.waitForSelector('h1', { timeout: 25000 });
    } catch {
      await page.waitForTimeout(4000);
    }
    // Let staggered entrances finish.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: s.name });
    console.log('saved', s.name);
    await page.close();
  }
  await browser.close();
})().catch((e) => {
  console.error('SHOT_FAIL', e.message);
  process.exit(1);
});
