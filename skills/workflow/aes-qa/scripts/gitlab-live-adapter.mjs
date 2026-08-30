import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

function runGlab(args, { binary = false } = {}) {
  const glab = process.env.GLAB_PATH || 'glab';
  try {
    return execFileSync(glab, args, { encoding: binary ? null : 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const text = `${error.stderr || ''}\n${error.stdout || ''}\n${error.message || ''}`;
    const status = text.match(/\b([45]\d\d)\b/)?.[1];
    if (status) {
      error.code = `HTTP_${status}`;
      if (status.startsWith('5')) error.kind = 'transient';
    }
    throw error;
  }
}

function api(target, args) {
  return runGlab(['api', '--hostname', target.host, ...args]);
}

function authToken(host) {
  if (process.env.GITLAB_TOKEN) return process.env.GITLAB_TOKEN;
  const glab = process.env.GLAB_PATH || 'glab';
  const result = spawnSync(glab, ['auth', 'status', '-t', '--hostname', host], {
    encoding: 'utf8', windowsHide: true, stdio: 'pipe',
  });
  const match = `${result.stdout || ''}\n${result.stderr || ''}`.match(/glpat-[A-Za-z0-9_-]+/);
  if (result.status !== 0 || !match) throw new Error(`cannot obtain GitLab token for authenticated download (exit ${result.status})`);
  return match[0];
}

function projectWebUrl(target) {
  const root = String(target.webUrl || `http://${target.host}`).replace(/\/$/, '');
  const projectPath = String(target.projectPath || '').replace(/^\/+|\/+$/g, '');
  return projectPath && !root.endsWith(`/${projectPath}`) ? `${root}/${projectPath}` : root;
}

function attachmentWebUrl(target, url) {
  if (/^https?:\/\//i.test(String(url))) return String(url);
  return `${projectWebUrl(target)}${String(url).startsWith('/') ? '' : '/'}${url}`;
}

export function createGitLabAdapter() {
  return {
    async uploadAttachment({ target, filePath }) {
      let body;
      try { body = api(target, ['--method', 'POST', `projects/${target.projectId}/uploads`, '--form', `file=@${filePath}`]); }
      catch (error) {
        if (error.kind !== 'transient' && !String(error.code || '').startsWith('HTTP_4')) {
          error.kind = 'ambiguous'; error.code = 'AMBIGUOUS_UPLOAD';
        }
        throw error;
      }
      const parsed = JSON.parse(body);
      if (!parsed.url || !parsed.markdown) throw new Error('GitLab upload response lacks url/markdown');
      return { url: parsed.url, markdown: parsed.markdown };
    },
    async createNote({ target, body }) {
      let raw;
      try { raw = api(target, ['--method', 'POST', `projects/${target.projectId}/issues/${target.issueIid}/notes`, '--raw-field', `body=${body}`]); }
      catch (error) {
        if (error.kind !== 'transient' && !String(error.code || '').startsWith('HTTP_4')) {
          error.kind = 'ambiguous'; error.code = 'AMBIGUOUS_NOTE';
        }
        throw error;
      }
      const parsed = JSON.parse(raw);
      return { id: parsed.id, url: `${projectWebUrl(target)}/-/issues/${target.issueIid}#note_${parsed.id}`, body: parsed.body };
    },
    async getNote({ target, noteId }) {
      const parsed = JSON.parse(api(target, [`projects/${target.projectId}/issues/${target.issueIid}/notes/${noteId}`]));
      return { id: parsed.id, body: parsed.body };
    },
    async downloadAttachment({ target, url }) {
      const token = authToken(target.host);
      const base = projectWebUrl(target);
      const response = await fetch(attachmentWebUrl(target, url), { headers: { 'PRIVATE-TOKEN': token } });
      if (response.status !== 200) throw Object.assign(new Error(`attachment GET returned HTTP ${response.status}`), { status: response.status });
      return Buffer.from(await response.arrayBuffer());
    },
    async findNotesByMarker({ target, marker }) {
      const notes = JSON.parse(api(target, [`projects/${target.projectId}/issues/${target.issueIid}/notes?per_page=100&sort=desc&order_by=created_at`]));
      return {
        notes: notes.filter((entry) => String(entry.body || '').includes(marker)).map((entry) => ({
          id: entry.id, body: entry.body, url: `${projectWebUrl(target)}/-/issues/${target.issueIid}#note_${entry.id}`,
        })),
        conclusive: true,
      };
    },
  };
}
