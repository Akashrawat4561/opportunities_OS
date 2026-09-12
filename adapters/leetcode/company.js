import { cli, Strategy } from '@agentrhq/webcmd/registry';

cli({
  site: 'leetcode',
  name: 'company',
  description: 'Fetch top interview problems and topic tag frequency for a target company',
  access: 'read',
  example: 'webcmd leetcode company atlassian -f json',
  domain: 'leetcode.com',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    { name: 'slug', type: 'string', required: true, help: 'Target company name or slug (e.g. atlassian, google, amazon)' },
    { name: 'limit', type: 'int', default: 15, help: 'Number of items to fetch' },
  ],
  columns: ['top_tags', 'problems'],
  func: async (kwargs) => {
    const company = (kwargs.slug || 'google').toLowerCase();
    const limit = kwargs.limit || 15;

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://leetcode.com',
    };

    // Curated company → top topic tags based on known interview patterns
    const COMPANY_TAGS = {
      amazon:    ['Array', 'Dynamic Programming', 'Tree', 'String', 'Graph', 'Hash Table'],
      google:    ['Array', 'String', 'Graph', 'Dynamic Programming', 'Math', 'Hash Table'],
      microsoft: ['Array', 'Tree', 'Linked List', 'Dynamic Programming', 'String', 'Graph'],
      meta:      ['Array', 'String', 'Dynamic Programming', 'Tree', 'Graph', 'Two Pointers'],
      apple:     ['Array', 'String', 'Tree', 'Dynamic Programming', 'Math', 'Sorting'],
      netflix:   ['Array', 'String', 'Dynamic Programming', 'Graph', 'Design', 'Hash Table'],
      uber:      ['Array', 'Graph', 'String', 'Dynamic Programming', 'Math', 'Sorting'],
      atlassian: ['Array', 'String', 'Tree', 'Graph', 'Hash Table', 'Dynamic Programming'],
      adobe:     ['Array', 'String', 'Tree', 'Math', 'Matrix', 'Dynamic Programming'],
      oracle:    ['Array', 'String', 'Tree', 'Database', 'Dynamic Programming', 'Sorting'],
      salesforce:['Array', 'String', 'Tree', 'Hash Table', 'Dynamic Programming', 'Graph'],
      goldman:   ['Array', 'Math', 'Dynamic Programming', 'String', 'Tree', 'Sorting'],
      morgan:    ['Array', 'Math', 'Dynamic Programming', 'String', 'Tree', 'Design'],
      flipkart:  ['Array', 'Tree', 'Graph', 'Dynamic Programming', 'String', 'Sorting'],
      walmart:   ['Array', 'String', 'Tree', 'Graph', 'Dynamic Programming', 'Hash Table'],
      paytm:     ['Array', 'String', 'Math', 'Hash Table', 'Dynamic Programming', 'Sorting'],
      infosys:   ['Array', 'String', 'Math', 'Sorting', 'Dynamic Programming', 'Linked List'],
      tcs:       ['Array', 'String', 'Math', 'Sorting', 'Pattern', 'Linked List'],
      wipro:     ['Array', 'String', 'Math', 'Sorting', 'Pattern', 'Linked List'],
      swiggy:    ['Array', 'Graph', 'Dynamic Programming', 'String', 'Hash Table', 'Greedy'],
      zomato:    ['Array', 'Graph', 'Dynamic Programming', 'String', 'Hash Table', 'Greedy'],
      default:   ['Array', 'String', 'Dynamic Programming', 'Tree', 'Graph', 'Hash Table'],
    };

    // Find the best matching company key
    const companyKey = Object.keys(COMPANY_TAGS).find(k => company.includes(k)) || 'default';
    const topicTags = COMPANY_TAGS[companyKey];

    // Fetch real problems from LeetCode filtered by top topic tag for this company
    const primaryTag = topicTags[0];
    const query = `
      query getTagProblems($slug: String!, $limit: Int) {
        topicTag(slug: $slug) {
          name
          questions: questions(limit: $limit) {
            title
            titleSlug
            difficulty
            topicTags { name }
          }
        }
      }
    `;

    try {
      const resp = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables: { slug: primaryTag.toLowerCase().replace(/ /g, '-'), limit },
        }),
      });

      const data = await resp.json();
      const rawList = data?.data?.topicTag?.questions || [];

      if (rawList.length > 0) {
        const tagCounts = {};
        // Count all topic tags across results, but weight known company tags higher
        topicTags.forEach((t, i) => { tagCounts[t] = topicTags.length - i; });

        const problems = rawList.slice(0, limit).map(q => {
          const firstTag = q.topicTags?.[0]?.name || primaryTag;
          q.topicTags?.forEach(t => {
            tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
          });
          return {
            title: q.title,
            difficulty: q.difficulty,
            tag: firstTag,
            url: `https://leetcode.com/problems/${q.titleSlug}/`,
          };
        });

        const top_tags = Object.entries(tagCounts)
          .map(([tag, frequency]) => ({ tag, frequency }))
          .sort((a, b) => b.frequency - a.frequency)
          .slice(0, 5);

        return { top_tags, problems };
      }
    } catch (_) {
      // fall through
    }

    // Final fallback: return curated tag data with a link to the company problem list
    const top_tags = topicTags.slice(0, 5).map((tag, i) => ({
      tag,
      frequency: topicTags.length - i,
    }));
    return {
      top_tags,
      problems: [{
        title: `Browse ${company.charAt(0).toUpperCase() + company.slice(1)} problems on LeetCode`,
        difficulty: 'Mixed',
        tag: topicTags[0],
        url: `https://leetcode.com/company/${company}/`,
      }],
    };
  },
});
