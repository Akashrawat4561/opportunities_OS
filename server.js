import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/**
 * Execute a shell command with a promise wrapper.
 */
function runCommand(cmd, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: __dirname, timeout: timeoutMs, maxBuffer: 15 * 1024 * 1024 }, (error, stdout, stderr) => {
      const out = stdout ? stdout.trim() : '';
      const err = stderr ? stderr.trim() : '';
      if (error && !out) {
        return reject(error);
      }
      resolve({ stdout: out, stderr: err });
    });
  });
}

/**
 * Robust JSON extractor in case CLI outputs banners or extra text.
 */
function extractJSON(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');

    if (firstBracket !== -1 && lastBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      try {
        return JSON.parse(text.slice(firstBracket, lastBracket + 1));
      } catch (e) {}
    }

    if (firstBrace !== -1 && lastBrace !== -1) {
      try {
        return JSON.parse(text.slice(firstBrace, lastBrace + 1));
      } catch (e) {}
    }

    throw new Error('Unable to parse JSON from command output: ' + text.slice(0, 150));
  }
}

// ─── Freelance Cache (5 mins TTL) ──────────────────────────────────────────
let freelanceCache = null;
let freelanceCacheTime = 0;

async function getFreelanceGigs() {
  const now = Date.now();
  if (freelanceCache && now - freelanceCacheTime < 300000) {
    return freelanceCache;
  }

  try {
    const { stdout } = await runCommand('webcmd lever-freelance opportunities -f json');
    const gigs = extractJSON(stdout);
    freelanceCache = gigs;
    freelanceCacheTime = now;
    return gigs;
  } catch (err) {
    console.error('[Freelance] Error fetching:', err.message);
    return freelanceCache || [];
  }
}

// ─── API Routes ─────────────────────────────────────────────────────────────

/**
 * GET /api/search?q=<query>
 * Handles both "freelance" and full-time company searches.
 */
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  console.log(`[API] Search requested: "${q}"`);

  if (q.toLowerCase() === 'freelance') {
    try {
      const gigs = await getFreelanceGigs();
      return res.json({ type: 'freelance', query: q, data: gigs });
    } catch (err) {
      console.error('[API] Freelance error:', err.message);
      return res.status(500).json({ error: 'Failed to fetch freelance opportunities', details: err.message });
    }
  }

  // Full-time company search
  const safeCompany = q.replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  try {
    // Run oppurtunityos search and freelance in parallel for a rich package
    const [fulltimeResult, freelanceGigs] = await Promise.all([
      runCommand(`webcmd oppurtunityos search ${safeCompany} -f json`),
      getFreelanceGigs().catch(() => [])
    ]);

    const fulltimeData = extractJSON(fulltimeResult.stdout);
    return res.json({
      type: 'fulltime',
      query: q,
      data: fulltimeData,
      freelance: freelanceGigs
    });
  } catch (err) {
    console.error(`[API] Error searching company "${safeCompany}":`, err.message);

    // Fallback: Try individual fast adapters (leetcode & gfg) if oppurtunityos failed
    try {
      console.log(`[API] Attempting fallback for ${safeCompany}...`);
      const [lcRes, gfgRes, freelanceGigs] = await Promise.all([
        runCommand(`webcmd leetcode company --slug ${safeCompany} -f json`).catch(() => ({ stdout: '{}' })),
        runCommand(`webcmd gfg-interviews search --company ${safeCompany} -f json`).catch(() => ({ stdout: '{}' })),
        getFreelanceGigs().catch(() => [])
      ]);

      const lc = extractJSON(lcRes.stdout) || {};
      const gfg = extractJSON(gfgRes.stdout) || {};

      return res.json({
        type: 'fulltime',
        query: q,
        data: {
          company: safeCompany,
          roles: [],
          top_tags: lc.top_tags || [],
          problems: lc.problems || [],
          experiences: gfg.experiences || []
        },
        freelance: freelanceGigs
      });
    } catch (fallbackErr) {
      return res.status(500).json({
        error: `Failed to search opportunities for "${q}"`,
        details: err.message
      });
    }
  }
});

/**
 * GET /api/freelance
 */
app.get('/api/freelance', async (req, res) => {
  try {
    const gigs = await getFreelanceGigs();
    return res.json({ type: 'freelance', query: 'freelance', data: gigs });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch freelance gigs', details: err.message });
  }
});

// Fallback to index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 WorkScout server running at http://localhost:${PORT}`);
});
