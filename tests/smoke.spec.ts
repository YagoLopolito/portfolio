import { test, expect, type Page } from '@playwright/test';

// Collect console errors, uncaught exceptions and failed same-origin requests for the whole visit.
function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
  page.on('requestfailed', (r) => problems.push(`failed ${r.url()} (${r.failure()?.errorText})`));
  return problems;
}

test('page loads with the main content', async ({ page }) => {
  await page.goto('./');
  await expect(page).toHaveTitle(/Yago Lopolito/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Yago\s*Lopolito/);
  await expect(page.getByRole('heading', { name: 'Featured projects' })).toBeVisible();
  for (const name of ['Platinoob', 'El Predio', 'FIFA Club Manager']) {
    await expect(page.getByRole('heading', { level: 3, name })).toBeVisible();
  }
  await expect(page.getByText('[add your')).toHaveCount(0);
});

test('every image loads, has alt text and reserved dimensions', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  // Lazy images only load near the viewport: make them eager, then wait for all of them.
  await page.evaluate(() => document.querySelectorAll('img[loading="lazy"]').forEach((i) => ((i as HTMLImageElement).loading = 'eager')));
  const images = page.locator('main img');
  const count = await images.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    const img = images.nth(i);
    const src = await img.getAttribute('src');
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { message: `image did not load: ${src}` }).toBe(true);
    expect(await img.getAttribute('alt'), `alt on ${src}`).toBeTruthy();
    expect(await img.getAttribute('width'), `width on ${src}`).toBeTruthy();
    expect(await img.getAttribute('height'), `height on ${src}`).toBeTruthy();
  }
  expect(problems).toEqual([]);
});

test('project links respond', async ({ page, request }) => {
  await page.goto('./');
  const hrefs = await page.locator('#projects a[href^="http"]').evaluateAll((as) => [...new Set(as.map((a) => (a as HTMLAnchorElement).href))]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    const res = await request.get(href, { maxRedirects: 5, timeout: 30_000 });
    expect(res.status(), href).toBeLessThan(400);
  }
});

test('no console errors on load and scroll', async ({ page }) => {
  const problems = watch(page);
  await page.goto('./');
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
  await page.waitForLoadState('networkidle');
  expect(problems).toEqual([]);
});

test('screenshot lightbox works with the keyboard', async ({ page }) => {
  await page.goto('./');
  const thumb = page.getByRole('button', { name: 'Enlarge screenshot: AI platinum plan' });
  await thumb.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img')).toHaveJSProperty('complete', true);
  await expect(dialog.locator('figcaption')).toContainText('AI advisor');
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(thumb).toBeFocused();
});

for (const width of [390, 768, 1440]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('./');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
  });
}
