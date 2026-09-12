import { cli, Strategy } from "@agentrhq/webcmd/registry";

cli({
  site: "oppurtunityos",
  name: "search",
  tags: ["jobs", "prep", "leetcode", "gfg"],
  access: "read",
  description:
    "One command to fetch open roles, LeetCode prep, and GFG interview experiences for any target company",
  domain: "linkedin.com",
  strategy: Strategy.COOKIE,
  navigateBefore: false,
  args: [
    {
      name: "company",
      required: true,
      positional: true,
      help: 'Company slug, for example "amazon", "google", or "atlassian"',
    },
  ],
  columns: ["company", "open_roles", "top_leetcode_tags", "gfg_experiences", "leetcode_link"],
  func: async (page, kwargs) => {
    const company = String(kwargs.company ?? "");
    const { execSync } = await import("child_process");

    let roles = [];
    try {
      const raw = execSync(`webcmd naukri roles ${company} -f json`, {
        encoding: "utf-8",
      });
      roles = JSON.parse(raw);
    } catch (e) {
      try {
        const scriptPath = new URL(
          "./govind-naukri-adapter/naukri-roles.sh",
          import.meta.url,
        ).pathname;
        const raw = execSync(`bash ${scriptPath} ${company}`, {
          encoding: "utf-8",
        });
        roles = JSON.parse(raw);
      } catch (err) {
        roles = [];
      }
    }

    let top_tags = [],
      problems = [];
    try {
      const raw = execSync(
        `webcmd leetcode company --slug ${company} -f json`,
        { encoding: "utf-8" },
      );
      const lc = JSON.parse(raw);
      top_tags = lc.top_tags ?? [];
      problems = lc.problems ?? [];
    } catch (e) {
      top_tags = [];
      problems = [];
    }

    let experiences = [];
    try {
      const raw = execSync(
        `webcmd gfg-interviews search --company ${company} -f json`,
        { encoding: "utf-8" },
      );
      const gfg = JSON.parse(raw);
      experiences = gfg.experiences ?? [];
    } catch (e) {
      experiences = [];
    }

    // Flat summary fields for table display
    const open_roles = roles.length > 0
      ? roles.map(r => `${r.title} (${r.location})`).join('\n')
      : 'No roles found';

    const top_leetcode_tags = top_tags.length > 0
      ? top_tags.map(t => `${t.tag} (${t.frequency})`).join(', ')
      : 'N/A';

    const gfg_experiences = experiences.length > 0
      ? experiences.map(e => `[${e.role} ${e.year}] ${e.title}`).join('\n')
      : 'No experiences found';

    const leetcode_link = problems.length > 0
      ? problems[0].url
      : `https://leetcode.com/company/${company}/`;

    return {
      company,
      open_roles,
      top_leetcode_tags,
      gfg_experiences,
      leetcode_link,
      // Full data available with -f json
      roles,
      top_tags,
      problems,
      experiences,
    };
  },
});
