#!/bin/bash
COMPANY=$1
SESSION=$(webcmd session create -f json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
RESULT=$(webcmd --session $SESSION browser run --stdin <<JS
await page.goto('https://www.naukri.com/${COMPANY}-jobs', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(3000);
const jobs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.srp-jobtuple-wrapper')).slice(0,10).map(card => {
    const t = card.querySelector('a.title');
    const l = card.querySelector('.locWdth');
    const p = card.querySelector('.job-post-day');
    return { title: t ? t.innerText.trim() : '', location: l ? l.innerText.trim() : 'India', posted_at: p ? p.innerText.trim() : 'N/A', url: t ? t.href : '' };
  }).filter(j => j.title);
});
return jobs;
JS
)
webcmd session close $SESSION > /dev/null 2>&1
echo $RESULT | python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data['result'], indent=2))"
