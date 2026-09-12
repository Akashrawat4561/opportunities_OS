import { cli, Strategy } from '@agentrhq/webcmd/registry';

cli({
  site: 'lever-freelance',
  name: 'opportunities',
  description: 'Fetch freelance/contract opportunities from RWS and Appen on Lever, prioritizing India-friendly remote roles',
  access: 'read',
  example: 'webcmd lever-freelance opportunities -f json',
  domain: 'lever.co',
  strategy: Strategy.PUBLIC,
  browser: false,
  args: [
    {
      name: 'limit',
      type: 'int',
      default: 5,
      help: 'Number of freelance opportunities to return (default: 5)',
    },
  ],
  columns: ['title', 'company', 'type', 'location', 'apply_url'],
  func: async (kwargs) => {
    const limit = kwargs.limit || 5;

    // Sources to query — both have active India/remote freelance postings on Lever
    const SOURCES = [
      { slug: 'rws',   display: 'RWS TrainAI' },
      { slug: 'appen', display: 'Appen' },
    ];

    // Keywords that indicate India-relevance or open remote roles
    const INDIA_SIGNALS = [
      'india', 'remote', 'work from home', 'wfh', 'anywhere',
      'global', 'worldwide', 'freelance', 'flexible',
    ];

    // Commitment types we want to include
    const FREELANCE_TYPES = [
      'temporary/contract', 'contract', 'freelance', 'part-time',
      'contractor', 'temp', 'casual',
    ];

    /**
     * Score a posting for India/remote relevance.
     * Higher score = more relevant.
     */
    function indiaScore(posting) {
      const location = (posting.categories?.location || '').toLowerCase();
      const country  = (posting.country || '').toLowerCase();
      const desc     = (posting.descriptionPlain || '').toLowerCase();
      const text     = (posting.text || '').toLowerCase();
      const allLocs  = (posting.categories?.allLocations || []).join(' ').toLowerCase();

      let score = 0;

      // Strong signals — explicit India location
      if (location.includes('india')) score += 10;
      if (allLocs.includes('india')) score += 10;
      if (country === 'in') score += 10;

      // Medium signals — remote-friendly wording
      if (location.includes('remote')) score += 5;
      if (desc.includes('india')) score += 4;
      if (desc.includes('remote')) score += 3;
      if (desc.includes('work from home')) score += 3;
      if (desc.includes('worldwide') || desc.includes('global')) score += 2;

      // Light signals — general freelance keywords
      INDIA_SIGNALS.forEach(sig => {
        if (text.includes(sig)) score += 1;
      });

      return score;
    }

    const allResults = [];

    await Promise.allSettled(
      SOURCES.map(async ({ slug, display }) => {
        try {
          const resp = await fetch(
            `https://api.lever.co/v0/postings/${slug}?mode=json&limit=100`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
              },
            }
          );

          if (!resp.ok) return;
          const postings = await resp.json();
          if (!Array.isArray(postings)) return;

          postings.forEach(posting => {
            const commitment = (posting.categories?.commitment || '').toLowerCase();
            const isFreelance = FREELANCE_TYPES.some(t => commitment.includes(t));
            if (!isFreelance) return;

            const score = indiaScore(posting);
            // Include if score > 0 (some India/remote signal) OR it's explicitly remote
            const workplaceType = (posting.workplaceType || '').toLowerCase();
            if (score === 0 && workplaceType !== 'remote') return;

            const location = posting.categories?.location || 'Remote';
            const formattedLocation = workplaceType === 'remote'
              ? `Remote (${location})`
              : location;

            allResults.push({
              title:     posting.text || 'Untitled',
              company:   display,
              type:      posting.categories?.commitment || 'Freelance',
              location:  formattedLocation,
              apply_url: posting.hostedUrl || posting.applyUrl || `https://jobs.lever.co/${slug}`,
              _score:    score,
              _createdAt: posting.createdAt || 0,
            });
          });
        } catch (_) {
          // silently skip failed sources
        }
      })
    );

    if (allResults.length === 0) {
      return [{
        title:     'No India/remote freelance opportunities found at this time',
        company:   'RWS / Appen',
        type:      'Freelance',
        location:  'Check back later',
        apply_url: 'https://jobs.lever.co/rws',
      }];
    }

    // Sort by: India score DESC, then by most recent first
    allResults.sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      return b._createdAt - a._createdAt;
    });

    // Return top N, stripping internal scoring fields
    return allResults.slice(0, limit).map(({ _score, _createdAt, ...rest }) => rest);
  },
});
