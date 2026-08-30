import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { atomicWriteJson } from '../screenshot-evidence-core.mjs';

function initialState() {
  return { schema: 'aes.fake-gitlab/v1', nextNoteId: 1, attachments: {}, notes: [], calls: {} };
}

function load(path) {
  return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : initialState();
}

export function createGitLabAdapter({ options = {} } = {}) {
  if (!options.statePath) throw new Error('fake GitLab adapter requires options.statePath');
  const statePath = options.statePath;
  const save = (state) => atomicWriteJson(statePath, state);
  const faultFor = (state, operation) => {
    state.calls[operation] = (state.calls[operation] || 0) + 1;
    const call = state.calls[operation];
    const rule = (options.faultPlan?.rules || []).find((entry) => entry.operation === operation && entry.calls?.includes(call));
    save(state);
    return rule || null;
  };
  const throwFault = (rule) => {
    if (!rule) return;
    const error = new Error(rule.code || rule.kind || 'FAKE_GITLAB_FAULT');
    error.code = rule.code || 'FAKE_GITLAB_FAULT';
    error.kind = rule.kind;
    error.afterPersist = Boolean(rule.afterPersist);
    throw error;
  };
  return {
    async uploadAttachment({ target, filePath, fileName }) {
      const state = load(statePath);
      const fault = faultFor(state, 'uploadAttachment');
      if (fault && !fault.afterPersist) throwFault(fault);
      const bytes = readFileSync(filePath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const url = `/uploads/${digest.slice(0, 32)}/${encodeURIComponent(fileName || basename(filePath))}`;
      state.attachments[url] = { base64: bytes.toString('base64'), fileName: fileName || basename(filePath), projectId: target.projectId };
      save(state);
      if (fault) throwFault(fault);
      return { url, markdown: `![${fileName || basename(filePath)}](${url})` };
    },
    async createNote({ target, body }) {
      const state = load(statePath);
      const fault = faultFor(state, 'createNote');
      if (fault && !fault.afterPersist) throwFault(fault);
      const id = state.nextNoteId++;
      const projectPath = target.projectPath || `projects/${target.projectId}`;
      const url = `http://${target.host}/${projectPath}/-/issues/${target.issueIid}#note_${id}`;
      const note = { id, url, body, projectId: target.projectId, issueIid: target.issueIid };
      state.notes.push(note);
      save(state);
      if (fault) throwFault(fault);
      return note;
    },
    async getNote({ noteId }) {
      const state = load(statePath);
      const fault = faultFor(state, 'getNote');
      if (fault) throwFault(fault);
      const note = state.notes.find((entry) => entry.id === noteId);
      if (!note) throw Object.assign(new Error(`note ${noteId} not found`), { status: 404 });
      return note;
    },
    async downloadAttachment({ url }) {
      const state = load(statePath);
      const fault = faultFor(state, 'downloadAttachment');
      if (fault) throwFault(fault);
      const attachment = state.attachments[url];
      if (!attachment) throw Object.assign(new Error(`attachment ${url} not found`), { status: 404 });
      return Buffer.from(attachment.base64, 'base64');
    },
    async findNotesByMarker({ marker }) {
      const state = load(statePath);
      const fault = faultFor(state, 'findNotesByMarker');
      if (fault) throwFault(fault);
      return { notes: state.notes.filter((entry) => entry.body.includes(marker)), conclusive: true };
    },
  };
}
