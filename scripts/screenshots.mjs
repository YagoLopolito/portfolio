// Real screenshots of the portfolio projects.
//
//   node scripts/screenshots.mjs auth [platinoob|fifa ...]   headed login, saves .auth/<app>.json
//   node scripts/screenshots.mjs explore platinoob           lists game ids from /biblioteca
//   node scripts/screenshots.mjs platinoob <gameId> [planId] captures Platinoob (game page + AI plan of planId)
//   node scripts/screenshots.mjs fifa                        captures FIFA Club Manager
//   node scripts/screenshots.mjs predio                      headed itch.io capture, driven by flag files
//
// Credentials are never typed by this script: login happens by hand in a headed window and only the
// resulting storageState is stored (in .auth/, which is git-ignored).
// Raw PNGs go to screenshots/raw/ (git-ignored); scripts/optimize.mjs turns them into WebP.
import { chromium } from 'playwright';
import { mkdirSync, existsSync, rmSync, readdirSync } from 'node:fs';

const RAW = 'screenshots/raw';
const AUTH = '.auth';
const FLAGS = `${AUTH}/flags`;
mkdirSync(RAW, { recursive: true });
mkdirSync(FLAGS, { recursive: true });

// Installed Google Chrome (still Chromium) with a throwaway profile: the bundled build was blocked from launching here.
const CHANNEL = process.env.PW_CHANNEL || 'chrome';
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, locale: 'es-AR', colorScheme: 'dark' };
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-AR', colorScheme: 'dark' };

const APPS = {
  platinoob: {
    url: 'https://platinoob.vercel.app',
    loginPath: '/login',
    // Logged in once the app leaves /login.
    isLoggedIn: async (page) => !new URL(page.url()).pathname.startsWith('/login'),
  },
  fifa: {
    url: 'https://fifa-manager-eta.vercel.app',
    loginPath: '/',
    // Single-page app: logged in once supabase-js has written its session to localStorage
    // (a hidden password field alone is not enough: the sign-up / reset views hide it too).
    isLoggedIn: async (page) => page.evaluate(() => Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k))),
  },
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Wait for a flag file (created from outside when the user says "now"). Returns true if found.
async function waitFlag(name, timeoutMs = 30 * 60_000) {
  const f = `${FLAGS}/${name}`;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (existsSync(f)) { rmSync(f); return true; }
    await sleep(500);
  }
  return false;
}

// Blur anything that looks private before a capture: emails, long tokens, NPSSO / API key fields.
async function redact(page) {
  return page.evaluate(() => {
    const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;
    const TOKEN = /\b[A-Za-z0-9_-]{32,}\b/;
    const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i; // route ids, not secrets
    const secret = (v) => EMAIL.test(v) || (TOKEN.test(v) && !UUID.test(v.trim()));
    const hits = [];
    const blur = (el, why) => { el.style.filter = 'blur(8px)'; hits.push(why + ': ' + (el.textContent || el.value || '').trim().slice(0, 40)); };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const n = walker.currentNode;
      if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/.test(n.parentElement.tagName)) continue;
      if (secret(n.textContent)) blur(n.parentElement, 'text');
    }
    for (const el of document.querySelectorAll('input, textarea')) {
      const label = (el.name + ' ' + el.id + ' ' + el.placeholder + ' ' + el.type).toLowerCase();
      if (el.type === 'hidden' && !secret(el.value)) continue;
      if (secret(el.value) || /npsso|token|key|password|email/.test(label)) blur(el, 'field');
    }
    return hits;
  });
}

async function shoot(page, name, opts = {}) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {}); // realtime apps never go fully idle
  await page.evaluate(() => document.fonts && document.fonts.ready);
  // Let lazy images decode.
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 8000); })));
  });
  await sleep(opts.settle ?? 1200);
  if (opts.hideText) {
    // Drop a known-wrong line from the capture (reported upstream as a bug) without touching the rest.
    await page.getByText(opts.hideText).first().evaluate((el) => { el.style.display = 'none'; });
  }
  const hits = await redact(page);
  if (hits.length) log(`  redacted in ${name}:`, hits);
  const path = `${RAW}/${name}.png`;
  if (opts.locator) await opts.locator.screenshot({ path });
  else await page.screenshot({ path, fullPage: false });
  log('  saved', path);
}

async function auth(names) {
  const browser = await chromium.launch({ channel: CHANNEL, headless: false });
  await Promise.all(names.map(async (name) => {
    const app = APPS[name];
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    await page.goto(app.url + app.loginPath);
    log(`[${name}] waiting for manual login in the browser window...`);
    await sleep(3000);
    for (;;) {
      if (await app.isLoggedIn(page).catch(() => false)) {
        await sleep(3000); // let the session settle in storage
        if (await app.isLoggedIn(page).catch(() => false)) break;
      }
      await sleep(1000);
    }
    await ctx.storageState({ path: `${AUTH}/${name}.json` });
    log(`[${name}] session saved to ${AUTH}/${name}.json`);
    await ctx.close();
  }));
  await browser.close();
}

async function withSession(name, ctxOpts, fn) {
  const state = `${AUTH}/${name}.json`;
  if (!existsSync(state)) throw new Error(`Missing ${state}. Run: node scripts/screenshots.mjs auth ${name}`);
  const browser = await chromium.launch({ channel: CHANNEL });
  const ctx = await browser.newContext({ ...ctxOpts, storageState: state });
  const page = await ctx.newPage();
  try { await fn(page); } finally { await browser.close(); }
}

async function explorePlatinoob() {
  await withSession('platinoob', DESKTOP, async (page) => {
    await page.goto(APPS.platinoob.url + '/biblioteca');
    await sleep(2000);
    const games = await page.$$eval('a[href*="/juegos/"]', (as) => as.map((a) => ({ href: a.getAttribute('href'), text: (a.innerText || a.getAttribute('aria-label') || a.querySelector('img')?.alt || '').trim().replace(/\s+/g, ' ').slice(0, 80) })));
    const uniq = [...new Map(games.map((g) => [g.href, g])).values()];
    console.log(JSON.stringify(uniq, null, 1));
  });
}

async function capturePlatinoob(gameId, planGameId = gameId) {
  if (!gameId) throw new Error('Pass a game id: node scripts/screenshots.mjs platinoob <gameId> [planGameId]');
  const base = APPS.platinoob.url;
  await withSession('platinoob', DESKTOP, async (page) => {
    await page.goto(base + '/biblioteca'); await shoot(page, 'platinoob-library', { settle: 2500 });
    await page.goto(base + '/juegos/' + gameId); await shoot(page, 'platinoob-game', { settle: 2500 });
    // The plan only says something useful for a game that is not finished yet, hence a separate id.
    await page.goto(base + '/juegos/' + planGameId);
    await sleep(3000);
    await page.getByText(/gu[ií]as e ia/i).first().click();
    await page.getByRole('button', { name: /regenerar plan/i }).waitFor({ timeout: 30_000 });
    // The page scrolls inside a container, so scroll with the wheel instead of window.scrollTo.
    await page.mouse.move(720, 500); await page.mouse.wheel(0, 760);
    await shoot(page, 'platinoob-ai-plan', { settle: 1500, hideText: /^Ya tienes todos los trofeos desbloqueados$/ });
    await page.goto(base + '/perfil'); await shoot(page, 'platinoob-profile', { settle: 2500 });
  });
  await withSession('platinoob', MOBILE, async (page) => {
    await page.goto(base + '/biblioteca'); await shoot(page, 'platinoob-library-mobile', { settle: 2500 });
  });
}

async function captureFifa() {
  await withSession('fifa', DESKTOP, async (page) => {
    await page.goto(APPS.fifa.url + '/');
    await shoot(page, 'fifa-home', { settle: 3000 });
    // The home screen already is the "Plantel" tab; the squad shot is its full roster table further down.
    await page.getByText(/^Plantilla completa/).first().evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 24));
    await shoot(page, 'fifa-squad', { settle: 1500 });
  });
}

// El Predio: Unity WebGL inside itch.io's iframe. The canvas has no DOM to drive, so captures are
// triggered by flag files: touch .auth/flags/predio-shot-<label> to save screenshots/raw/predio-<label>.png,
// and .auth/flags/predio-done to finish.
async function capturePredio() {
  const browser = await chromium.launch({ channel: CHANNEL, headless: false, args: ['--use-angle=d3d11', '--enable-gpu'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('https://yago-lopolito.itch.io/futsbol');
  // itch.io draws its own buttons over the game iframe; hide them so they don't end up in the shots.
  await page.addStyleTag({ content: '.header_buttons, .follow_user_btn, .add_to_collection_btn, .fullscreen_btn { display: none !important; }' });
  const run = page.locator('.load_iframe_btn');
  if (await run.count()) await run.first().click();
  const frameEl = page.locator('#game_drop, .game_frame iframe, iframe#game_drop').first();
  await frameEl.waitFor({ timeout: 60_000 });
  await frameEl.scrollIntoViewIfNeeded();
  const frame = await (await frameEl.elementHandle()).contentFrame();
  const canvas = frame.locator('canvas').first();
  await canvas.waitFor({ timeout: 120_000 });
  log('[predio] canvas present, waiting for Unity to finish loading...');
  await frame.waitForFunction(() => {
    const bar = document.querySelector('#unity-loading-bar, #loadingBar, .loading');
    return !bar || getComputedStyle(bar).display === 'none' || bar.offsetParent === null;
  }, null, { timeout: 180_000 }).catch(() => log('[predio] loading bar check timed out, continuing'));
  log('[predio] ready. Touch .auth/flags/predio-shot-<label> to capture, predio-done to finish.');
  for (;;) {
    const flags = readdirSync(FLAGS).filter((f) => f.startsWith('predio-'));
    if (flags.includes('predio-done')) { rmSync(`${FLAGS}/predio-done`); break; }
    for (const f of flags.filter((f) => f.startsWith('predio-shot-'))) {
      rmSync(`${FLAGS}/${f}`);
      const label = f.slice('predio-shot-'.length);
      await canvas.screenshot({ path: `${RAW}/predio-${label}.png` });
      log('  saved', `${RAW}/predio-${label}.png`);
    }
    await sleep(300);
  }
  await browser.close();
}

const [cmd, ...args] = process.argv.slice(2);
const run = {
  auth: () => auth(args.length ? args : Object.keys(APPS)),
  explore: () => explorePlatinoob(),
  platinoob: () => capturePlatinoob(args[0], args[1]),
  fifa: () => captureFifa(),
  predio: () => capturePredio(),
}[cmd];
if (!run) { console.error('Usage: node scripts/screenshots.mjs auth|explore|platinoob <id>|fifa|predio'); process.exit(1); }
await run();
