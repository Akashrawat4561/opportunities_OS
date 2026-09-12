// Probe LeetCode API options for company-filtered problems
const company = 'amazon';

// Test 1: companyTag GraphQL (may be premium-only)
const q1 = await fetch('https://leetcode.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://leetcode.com' },
  body: JSON.stringify({ query: `{ companyTag(slug: "${company}") { name questions { title difficulty titleSlug } } }` })
});
const d1 = await q1.json();
console.log('companyTag result:', JSON.stringify(d1).slice(0, 300));

// Test 2: problemsetQuestionList with companies filter
const q2 = await fetch('https://leetcode.com/graphql', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://leetcode.com' },
  body: JSON.stringify({
    query: `query($limit: Int, $filters: QuestionListFilterInput) { questionList(categorySlug: "", limit: $limit, skip: 0, filters: $filters) { data { title difficulty titleSlug topicTags { name } } } }`,
    variables: { limit: 5, filters: { companies: [company] } }
  })
});
const d2 = await q2.json();
console.log('\ncompanies filter result:', JSON.stringify(d2).slice(0, 500));

// Test 3: REST endpoint
const q3 = await fetch(`https://leetcode.com/api/company-tags/`, {
  headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://leetcode.com' }
});
console.log('\nREST /api/company-tags/ status:', q3.status);
const t3 = await q3.text();
console.log(t3.slice(0, 300));
