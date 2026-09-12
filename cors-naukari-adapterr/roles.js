import { cli, Strategy } from "@agentrhq/webcmd/registry";

cli({
  site: "naukri",
  name: "roles",
  access: "read",
  description: "Get open jobs for a company from Naukri.com",
  domain: "naukri.com",
  strategy: Strategy.PUBLIC,
  browser: true,
  args: [
    { name: "company", required: true, positional: true, help: "Company name e.g. atlassian" },
  ],
  columns: ["title", "location", "posted_at", "url"],
  func: async (page, kwargs) => {
    const company = kwargs.company || "atlassian";
    await page.goto(`https://www.naukri.com/${company}-jobs`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    try {
      await page.waitForSelector('.srp-jobtuple-wrapper', { timeout: 10000 });
    } catch (_) {
      await new Promise((r) => setTimeout(r, 3000));
    }
    const jobs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.srp-jobtuple-wrapper')).slice(0, 10).map(card => {
        const t = card.querySelector('a.title');
        const l = card.querySelector('.locWdth');
        const p = card.querySelector('.job-post-day');
        return {
          title: t ? t.innerText.trim() : '',
          location: l ? l.innerText.trim() : 'India',
          posted_at: p ? p.innerText.trim() : 'N/A',
          url: t ? t.href : ''
        };
      }).filter(j => j.title);
    });
    return jobs;
  },
});
