import { createHash } from 'node:crypto';

export const NICHE_TAGS = Object.freeze(['agent-skills', 'diagram-generation', 'plugin-marketplace', 'mcp', 'agent-memory', 'ai-image-generation', 'prompt-library', 'education', 'local-first', 'observability', 'job-search', 'llm-api', 'agent-workbench', 'testing', 'developer-tools', 'linux-desktop', 'scientific-computing', 'automation', 'security', 'data-platform', 'seo', 'model-tuning', 'video-editing', 'ui-generation', 'peripheral-control']);
export const analysisHash = text => createHash('sha256').update(text).digest('hex');
export const classification = repos => Object.fromEntries([...repos].sort((a,b) => a.full_name.localeCompare(b.full_name)).map(r => [r.full_name, r.entry_status ?? null]));
export function basisMatches(text, repos) {
  try {
    const basis = JSON.parse(/<!-- entry-status: (.+?) -->/.exec(text)?.[1] ?? 'null');
    const actual = classification(repos);
    return basis && Object.keys(basis).length === Object.keys(actual).length && Object.entries(actual).every(([k,v]) => basis[k] === v);
  } catch { return false; }
}
export function analysisIsStale(doc, text) {
  return !!doc.staleAt && !(text && doc.staleAnalysisHash && analysisHash(text) !== doc.staleAnalysisHash && basisMatches(text, doc.repos));
}
export function extractNotes(text = '') {
  const notes = new Map();
  for (const section of text.split(/^### /m).slice(1)) {
    const name = /^([\w.-]+\/[\w.-]+)(?:\s|$)/.exec(section)?.[1];
    if (!name) continue;
    const fields = {};
    for (const [label, key] of Object.entries({定位:'positioning', 为什么爆:'whyNow', 可信度:'trust', 生态位:'niche', nicheTags:'nicheTags'})) {
      const line = section.split(/\r?\n/).find(l => l.startsWith(`- **${label}**：`));
      if (line) fields[key] = line.slice(line.indexOf('：') + 1).trim();
    }
    try { fields.nicheTags = JSON.parse(fields.nicheTags); } catch { continue; }
    if (['positioning','whyNow','trust','niche'].every(k => fields[k]) && Array.isArray(fields.nicheTags) && fields.nicheTags.length && fields.nicheTags.every(t => NICHE_TAGS.includes(t))) notes.set(name, fields);
  }
  return notes;
}
