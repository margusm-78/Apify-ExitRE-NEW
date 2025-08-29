const { Actor, log } = require('apify');
const puppeteer = require('puppeteer');

// Defaults (can be overridden via INPUT)
const DEFAULT_START_URL = 'https://exitrealty.com/agents/area-Jacksonville__FL__United_States';

function normalizeUsPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+1${digits.slice(1)}`;
  if (digits.length === 10) return `+1${digits}`;
  return raw.trim();
}

Actor.main(async () => {
  const input = (await Actor.getInput()) ?? {};
  const totalPages = Number(input.totalPages || 8);
  const startUrl = input.startUrl || DEFAULT_START_URL;

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_EXECUTABLE_PATH,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(120_000);
  page.setDefaultTimeout(60_000);

  const seen = new Set();
  let pushed = 0;

  for (let i = 1; i <= totalPages; i++) {
    const url = i === 1 ? startUrl : `${startUrl}?page=${i}`;
    try {
      log.info(`Navigating page ${i}/${totalPages}: ${url}`);
      await page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle0'] });

      // Wait (best-effort) until "View Details" appears somewhere on the page
      await page.waitForFunction(
        () => /view\s*details/i.test(document.body?.innerText || ''),
        { timeout: 40_000 }
      ).catch(() => {});

      const items = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('a,button'))
          .filter(el => (el.textContent || '').trim().toLowerCase() === 'view details');
        const cards = Array.from(new Set(buttons.map(btn => btn.closest('div')))).filter(Boolean);

        function pickName(card) {
          const el = card.querySelector('a[href^="/agent/"] h3, h3 a[href^="/agent/"], h3, h2, a[href^="/agent/"]');
          if (el && el.textContent.trim()) return el.textContent.trim();
          const lines = (card.innerText || '').split('\n').map(s => s.trim()).filter(Boolean);
          return lines[0] || null;
        }
        function pickEmail(card) {
          const a = card.querySelector('a[href^="mailto:"]');
          if (a) {
            const href = a.getAttribute('href') || '';
            const em = href.split(':').pop().trim();
            if (em) return em;
          }
          const text = card.innerText || '';
          const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          return m ? m[0] : null;
        }
        function pickPhone(card) {
          const a = card.querySelector('a[href^="tel:"]');
          if (a) return (a.textContent || a.getAttribute('href')?.replace('tel:', '') || '').trim();
          const text = card.innerText || '';
          const m = text.match(/(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
          return m ? m[0] : null;
        }

        return cards.map(card => ({
          name: pickName(card),
          email: pickEmail(card),
          phone: pickPhone(card),
        })).filter(r => r.name && (r.email || r.phone));
      });

      for (const rec of items) {
        const key = `${(rec.email || '').toLowerCase()}|${(rec.phone || '').replace(/[^\d]/g, '')}|${rec.name}`;
        if (seen.has(key)) continue;
        seen.add(key);

        await Actor.pushData({
          Name: rec.name,
          Phone: normalizeUsPhone(rec.phone),
          Email: rec.email || null,
          SourcePage: url,
        });
        pushed++;
      }
      log.info(`Page ${i} -> total pushed ${pushed}`);
    } catch (err) {
      log.warning(`Page ${i} failed: ${err?.message || err}`);
    }
  }

  await browser.close();
  log.info(`Done. Pushed ${pushed} unique agents.`);

  // Optional: Emit a Brevo-ready CSV into key-value store
  if (input.emitBrevoCsv) {
    const dataset = await Actor.openDataset();
    const { items } = await dataset.getData({ limit: 10000 });
    const rows = [['EMAIL', 'FIRSTNAME', 'LASTNAME', 'SMS']];

    const splitName = (n) => {
      if (!n) return ['', ''];
      const parts = n.trim().split(/\s+/);
      const last = parts.pop() || '';
      const first = parts.join(' ');
      return [first, last];
    };

    for (const it of items) {
      const [first, last] = splitName(it.Name);
      rows.push([it.Email || '', first, last, it.Phone || '']);
    }

    const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    await Actor.setValue('brevo.csv', csv, { contentType: 'text/csv; charset=utf-8' });
    log.info('Saved Brevo CSV to key-value store as brevo.csv');
  }
});
