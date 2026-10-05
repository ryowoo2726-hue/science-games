const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 832, height: 480 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://localhost:5173'); await page.waitForFunction(() => window.labState?.());
    const cached = await page.evaluate(() => labState().renderStats);
    await page.waitForTimeout(350);
    assert.deepEqual(await page.evaluate(() => labState().renderStats), cached, 'idle floor uploads and text count must stay stable');
    async function stage(index) { await page.click('#help'); await page.click(`[data-stage="${index}"]`); }
    async function paint(x1, y1, x2, y2, rounds = 8) {
      await page.mouse.move(x1, y1); await page.mouse.down();
      for (let i = 0; i < rounds; i++) { await page.mouse.move(x2, y2, { steps: 8 }); await page.mouse.move(x1, y1, { steps: 8 }); }
      await page.mouse.up();
    }
    await paint(120, 240, 180, 240);
    assert.ok(await page.evaluate(() => labState().renderStats.floorUploads) > cached.floorUploads);
    assert.ok(await page.evaluate(() => labState().surface[7][4]) < .2);
    await page.click('#sand'); await paint(630, 240, 710, 240);
    assert.equal(await page.evaluate(() => labState().surface[7][20]), .7);
    await stage(1); await paint(360, 240, 460, 240);
    assert.equal(await page.evaluate(() => labState().surface[7][12]), .001);
    await stage(3); assert.equal(await page.locator('#hand').isDisabled(), true);
    await page.keyboard.press('1'); assert.equal(await page.evaluate(() => labState().mode), 'sand');
    await stage(4); assert.equal(await page.locator('#sand').isDisabled(), true);
    assert.equal(await page.evaluate(() => labState().checkpoints.length), 2);
    await stage(5); assert.equal(await page.evaluate(() => labState().checkpoints[0].kind), 'speed');
    await page.screenshot({ path: 'test-results/speed-sensor.png' });
    for (let i = 0; i < 10; i++) { await stage(i); const s = await page.evaluate(() => labState()); assert.equal(s.stage, i); assert.equal(s.boundaryWalls, 0); assert.equal(s.complete, false); }
    await page.screenshot({ path: 'test-results/final-security.png' });
    await page.click('#reset-object'); assert.equal(await page.evaluate(() => labState().rules.checkpoint), 0);
    for (const viewport of [{ width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(300);
      const canvas = await page.locator('canvas').boundingBox(); assert.equal(canvas.width, viewport.width); assert.equal(canvas.height, viewport.height);
    }
    await page.screenshot({ path: 'test-results/security-portrait.png' });
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, stages: 10, fixedFloors: true, toolRestrictions: true, errors }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
