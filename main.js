const Apify = require('apify');

/*
 * This Apify actor scrapes all real estate agents from the
 * Jacksonville, FL listings on Exit Realty's web site.  The site
 * paginates the agent cards over eight pages.  Each card contains
 * the agent's name, mobile phone number and email address.  The
 * actor uses Puppeteer (via the Apify SDK) to iterate through all
 * pages, extract the desired fields and push the results into the
 * default dataset.  Once the actor has run, the dataset can be
 * exported as a CSV (for example to upload into a marketing
 * platform like Brevo).
 */

Apify.main(async () => {
  const { log } = Apify.utils;

  // Open the default dataset; this will store our results.  If you
  // prefer to store to a named dataset, pass a custom name here.
  const dataset = await Apify.openDataset();

  // Launch a headless browser.  When running on the Apify platform
  // you can omit the Puppeteer launch options since the platform
  // provides a pre‑configured browser instance.  We explicitly
  // request headless mode here for clarity.
  const browser = await Apify.launchPuppeteer({ headless: true });
  const page = await browser.newPage();

  // Iterate through all eight pages of the Jacksonville agent list.
  for (let pageNum = 1; pageNum <= 8; pageNum++) {
    const url = `https://exitrealty.com/agents/area-Jacksonville__FL__United_States?page=${pageNum}`;
    log.info(`Opening page ${pageNum}: ${url}`);

    // Navigate to the page and wait for network activity to settle.
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Wait for at least one card to render.  The cards are laid out
    // using Material UI grid classes and include a "MOBILE" label.
    await page.waitForSelector('div.MuiGrid-root');

    // Extract agent data from the page.  Because the site uses
    // client‑side rendering, we evaluate a function within the
    // browser context to select the card elements and read their
    // text.  The selectors below were derived by inspecting the
    // rendered HTML.  If Exit Realty changes their markup this
    // logic may need to be updated.
    const agents = await page.evaluate(() => {
      const records = [];
      // Find all grid containers that contain agent information.
      const cards = Array.from(document.querySelectorAll('div.MuiGrid-root'));
      cards.forEach((card) => {
        const text = card.textContent || '';
        // Only process cards that have a MOBILE label; this filters
        // out unrelated grid elements on the page.
        if (!text.includes('MOBILE')) return;

        // Extract the name: the agent's name is the first anchor
        // linking to the agent details page.  We look for an <a>
        // whose href contains '/agent/'.
        let name = '';
        const nameLink = card.querySelector('a[href*="/agent/"]');
        if (nameLink) name = nameLink.textContent.trim();

        // Extract the mobile number.  The label "MOBILE" is followed
        // by a div containing the number.  We locate the element with
        // the exact text "MOBILE" and then read the next sibling.
        let phone = '';
        const spans = card.querySelectorAll('*');
        for (const el of spans) {
          if (el.textContent && el.textContent.trim().toUpperCase() === 'MOBILE') {
            // The phone number may be within the next sibling or within
            // its parent siblings.  Walk up the DOM tree until we find
            // a sibling with text that looks like a phone number.
            let sibling = el.parentElement.nextElementSibling;
            while (sibling && sibling.childElementCount) {
              sibling = sibling.firstElementChild;
            }
            if (sibling) phone = sibling.textContent.trim();
            break;
          }
        }

        // Extract the email address.  There is a mailto link on each
        // card.  We grab the href and remove the mailto prefix.
        let email = '';
        const emailLink = card.querySelector('a[href^="mailto:"]');
        if (emailLink) {
          // Some mailto links may include additional parameters; split on '?' to keep only the address.
          email = emailLink.getAttribute('href').replace('mailto:', '').split('?')[0];
        }

        // Push a record only if we found a name.  Some grid rows may
        // correspond to other content like marketing copy.
        if (name) {
          records.push({ name, phone, email });
        }
      });
      return records;
    });

    // Write the extracted records to the dataset.  Apify will
    // automatically create the dataset's JSON items.
    for (const agent of agents) {
      await dataset.pushData(agent);
    }

    log.info(`Collected ${agents.length} agents from page ${pageNum}`);
  }

  log.info('Finished scraping all pages');
  await browser.close();
});