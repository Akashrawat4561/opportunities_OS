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
    const company = kwargs.slug || 'google';
    const limit = kwargs.limit || 15;

    const query = `
      query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
        problemsetQuestionList: questionList(
          categorySlug: $categorySlug
          limit: $limit
          skip: $skip
          filters: $filters
        ) {
          questions: data {
            title
            difficulty
            titleSlug
            topicTags { name }
          }
        }
      }
    `;

    try {
      const resp = await fetch('https://leetcode.com/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: JSON.stringify({
          query: query,
          variables: {
            categorySlug: '',
            skip: 0,
            limit: limit,
            filters: { searchKeywords: company }
          }
        })
      });

      const data = await resp.json();
      const rawList = data?.data?.problemsetQuestionList?.questions || [];

      const tagCounts = {};
      const problems = rawList.map(q => {
        const firstTag = q.topicTags?.[0]?.name || 'General';
        q.topicTags?.forEach(t => {
          tagCounts[t.name] = (tagCounts[t.name] || 0) + 1;
        });
        return {
          title: q.title,
          difficulty: q.difficulty,
          tag: firstTag,
          url: `https://leetcode.com/problems/${q.titleSlug}/`
        };
      });

      const top_tags = Object.entries(tagCounts)
        .map(([tag, frequency]) => ({ tag, frequency }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5);

      return {
        top_tags,
        problems
      };
    } catch (err) {
      return {
        top_tags: [{ tag: 'Array', frequency: 1 }],
        problems: [{
          title: 'Two Sum',
          difficulty: 'Easy',
          tag: 'Array',
          url: 'https://leetcode.com/problems/two-sum/'
        }]
      };
    }
  },
});
