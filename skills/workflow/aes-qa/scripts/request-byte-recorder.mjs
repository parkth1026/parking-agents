import { appendFileSync, existsSync, readFileSync } from 'node:fs';

function append(path, event) {
  if (!path) return;
  appendFileSync(path, `${JSON.stringify({ ...event, at: new Date().toISOString() })}\n`, 'utf8');
}

export function createRecordedAdapter(adapter, { recorderPath, batchId }) {
  const call = async (operation, input, requestBytes = 0) => {
    append(recorderPath, { type: 'request', batchId, operation, requestBytes });
    const result = await adapter[operation](input);
    const responseBytes = operation === 'downloadAttachment'
      ? Buffer.byteLength(Buffer.isBuffer(result) ? result : result?.bytes ?? Buffer.alloc(0))
      : 0;
    append(recorderPath, { type: 'response', batchId, operation, responseBytes });
    return result;
  };
  return {
    uploadAttachment(input) { return call('uploadAttachment', input, input.bytes); },
    createNote(input) { return call('createNote', input); },
    getNote(input) { return call('getNote', input); },
    downloadAttachment(input) { return call('downloadAttachment', input); },
    findNotesByMarker(input) { return call('findNotesByMarker', input); },
  };
}

export function readRecorder(path, batchId = null) {
  if (!path || !existsSync(path)) return [];
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
    .filter((event) => !batchId || event.batchId === batchId);
}

export function summarizeRecorder(path, batchId = null) {
  const events = readRecorder(path, batchId);
  const requests = events.filter((event) => event.type === 'request');
  const responses = events.filter((event) => event.type === 'response');
  const count = (operation) => requests.filter((event) => event.operation === operation).length;
  return {
    gitlabUploadRequests: count('uploadAttachment'),
    gitlabNoteCreateRequests: count('createNote'),
    gitlabNoteReadRequests: count('getNote') + count('findNotesByMarker'),
    gitlabAttachmentDownloadRequests: count('downloadAttachment'),
    gitlabHttpRequests: requests.length,
    uploadedBytes: requests.filter((event) => event.operation === 'uploadAttachment').reduce((sum, event) => sum + event.requestBytes, 0),
    downloadedBytes: responses.filter((event) => event.operation === 'downloadAttachment').reduce((sum, event) => sum + event.responseBytes, 0),
  };
}
