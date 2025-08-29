const { Actor, log } = require('apify');
const puppeteer = require('puppeteer');

const START_URL = 'https://exitrealty.com/agents/area-Jacksonville__FL__United_States';

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

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  const page = await browser.newPage();

  const seen = new Set();
  let pushed = 0;

  for (let i = 1; i <= totalPages; i++) {
    const url = i === 1 ? START_URL : `${START_URL}?page=${i}`;
    log.info(`Navigating page ${i}/${totalPages}: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 120000 });
    await page.waitForSelector('body', { timeout: 60000 });

    const items = await page.evaluate(() => {
      // Find the agent “cards” by locating the “View Details” button
      const buttons = Array.from(document.querySelectorAll('a,button'))
        .filter(el => (el.textContent || '').trim().toLowerCase() === 'view details');

      const cards = buttons
        .map(btn => btn.closest('div') || btn.parentElement)
        .filter(Boolean);

      return cards.map(card => {
        const nameEl =
          card.querySelector('a[href^="/agent/"] h3') ||
          card.querySelector('h3 a[href^="/agent/"]') ||
          card.querySelector('h3') ||
          card.querySelector('h2') ||
          card.querySelector('a[href^="/agent/"]');

        const mailA = card.querySelector('a[href^="mailto:"]');
        const telA  = card.querySelector('a[href^="tel:"]');

        const text = (card.innerText || '').trim();

        let email = mailA ? mailA.getAttribute('href').split(':').pop().trim() : null;
        if (!email) {
          const m = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
          email = m ? m[0] : null;
        }

        let phone = telA ? (telA.textContent || telA.getAttribute('href').replace('tel:', '')).trim() : null;
        if (!phone) {
          const p = text.match(/(\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
          phone = p ? p[0] : null;
        }

        const name = nameEl ? nameEl.textContent.trim() : null;
        return { name, phone, email };
      }).filter(r => r.name && (r.email || r.phone));
    });

    for (const rec of items) {
      const key = `${(rec.email || '').toLowerCase()}|${(rec.phone || '').replace(/[^\d]/g,'')}|${rec.name}`;
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
    log.info(`Page ${i} -> pushed ${pushed} total so far`);
  }

  await browser.close();
  log.info(`Done. Pushed ${pushed} unique agents.`);
});
