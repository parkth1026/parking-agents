const elements = {
  phases: document.querySelector('#phases'),
  ambiguities: document.querySelector('#ambiguities'),
  connection: document.querySelector('#connection'),
  flow: document.querySelector('#flow'),
  locked: document.querySelector('#locked'),
  flowView: document.querySelector('#flow-view'),
  contractView: document.querySelector('#contract-view'),
  contract: document.querySelector('#contract'),
  flowTab: document.querySelector('#flow-tab'),
  contractTab: document.querySelector('#contract-tab'),
};

let state = null;
let reconnectAttempt = 0;
let socket = null;
let activeView = 'flow';
const drafts = new Map();

function text(value) {
  return String(value ?? '');
}

function draftKey(roundId) {
  return `workflow-interview-web:draft:${state?.slug ?? 'unknown'}:${roundId}`;
}

function queueKey() {
  return `workflow-interview-web:queue:${state?.slug ?? 'unknown'}`;
}

function loadDraft(roundId) {
  if (drafts.has(roundId)) return drafts.get(roundId);
  let value = {};
  try { value = JSON.parse(localStorage.getItem(draftKey(roundId)) ?? '{}'); } catch { value = {}; }
  drafts.set(roundId, value);
  return value;
}

function saveDraft(roundId) {
  localStorage.setItem(draftKey(roundId), JSON.stringify(loadDraft(roundId)));
}

function clearDraft(roundId) {
  drafts.delete(roundId);
  localStorage.removeItem(draftKey(roundId));
}

function updateRoundValidity(round) {
  const button = document.querySelector(`[data-testid="submit-${CSS.escape(round.id)}"]`);
  if (button) button.disabled = missingRequired(round).length > 0;
}

function setConnection(label, status) {
  elements.connection.textContent = label;
  elements.connection.dataset.state = status;
}

function node(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') element.className = value;
    else if (key === 'text') element.textContent = value;
    else if (key === 'html') element.innerHTML = value;
    else if (key.startsWith('data-')) element.setAttribute(key, value);
    else if (key in element) element[key] = value;
    else element.setAttribute(key, value);
  }
  for (const child of children) element.append(child);
  return element;
}

function renderPhases() {
  elements.phases.replaceChildren(...(state.phases ?? []).map((phase) => node('span', {
    class: `phase ${phase.status}`,
    text: `${phase.status === 'done' ? '✓ ' : ''}${phase.label}`,
    'data-phase': phase.id,
  })));
  const count = state.open_ambiguities ?? 0;
  elements.ambiguities.textContent = `开放歧义 ${count}`;
  elements.ambiguities.classList.toggle('zero', count === 0);
}

function optionDetails(option) {
  const details = [];
  if (option.covers) details.push(node('div', { class: 'option-detail', text: `选什么：${option.covers}` }));
  if (option.pros?.length) details.push(node('div', { class: 'option-detail', text: `好处：${option.pros.join(' · ')}` }));
  if (option.cons?.length) details.push(node('div', { class: 'option-detail', text: `代价：${option.cons.join(' · ')}` }));
  return details;
}

function choose(round, item, value) {
  const draft = loadDraft(round.id);
  draft[item.q_id] = value;
  saveDraft(round.id);
  render();
}

function renderAsk(round, item, locked) {
  const draft = loadDraft(round.id);
  const answer = draft[item.q_id];
  const question = node('div', { class: 'question interactive', 'data-testid': `question-${item.q_id}` });
  const head = node('div', { class: 'question-head' }, [
    node('span', { class: 'question-id', text: item.q_id }),
    node('span', { class: 'question-title', text: item.question }),
  ]);
  if (item.irreversible) head.append(node('span', { class: 'pill risk', text: '不可逆 · 值得选' }));
  question.append(head);
  if (item.known_facts) question.append(node('div', { class: 'facts', text: `已知事实：${item.known_facts}` }));
  const options = node('div', { class: 'options' });
  for (const option of item.options ?? []) {
    const button = node('button', {
      type: 'button',
      class: `option ${answer?.type === 'choice' && answer.choice === option.key ? 'selected' : ''}`,
      disabled: locked,
      'data-choice': option.key,
    }, [node('span', { class: 'option-summary' }, [
      node('span', { class: 'option-key', text: `${option.key}.` }),
      node('span', { class: 'option-text', text: option.text }),
      ...(option.recommended ? [node('span', { class: 'recommended', text: '推荐' })] : []),
      node('span', { class: 'pct', text: `${option.pct}%` }),
    ]), ...optionDetails(option)]);
    button.addEventListener('click', () => choose(round, item, { type: 'choice', choice: option.key }));
    options.append(button);
  }
  if (item.allow_custom !== false) {
    const other = node('button', {
      type: 'button',
      class: `other-button ${answer?.type === 'custom' ? 'selected' : ''}`,
      text: 'Other… 自由输入',
      disabled: locked,
    });
    other.addEventListener('click', () => choose(round, item, { type: 'custom', text: answer?.type === 'custom' ? answer.text : '' }));
    options.append(other);
    if (answer?.type === 'custom') {
      const input = node('textarea', {
        class: 'other-input',
        value: answer.text ?? '',
        placeholder: '写下你的选择与边界（最多 2000 字符）',
        maxLength: 4000,
        disabled: locked,
        'data-testid': `other-${item.q_id}`,
      });
      input.addEventListener('input', () => {
        loadDraft(round.id)[item.q_id] = { type: 'custom', text: input.value };
        saveDraft(round.id);
        updateRoundValidity(round);
      });
      options.append(input);
    }
  }
  question.append(options);
  return question;
}

function renderTierBlock(round, tier, items, locked) {
  if (items.length === 0) return null;
  const draft = loadDraft(round.id);
  const title = tier === 'default' ? 'DEFAULT · 不反对就算定' : 'CONFIRM · 选错难回头，请确认';
  const block = node('div', { class: 'tier-block interactive', 'data-tier': tier }, [node('p', { class: 'tier-title', text: title })]);
  for (const item of items) {
    const answer = draft[item.q_id];
    const row = node('div', { class: 'tier-row', 'data-testid': `question-${item.q_id}` }, [
      node('div', { class: 'tier-copy', text: item.line }),
    ]);
    const actions = node('div', { class: 'tier-actions' });
    if (tier === 'confirm') {
      const confirm = node('button', {
        type: 'button', class: `small-button confirm ${answer?.type === 'confirm' ? 'active' : ''}`,
        text: answer?.type === 'confirm' ? '已确认 ✓' : '确认', disabled: locked,
      });
      confirm.addEventListener('click', () => choose(round, item, { type: 'confirm' }));
      actions.append(confirm);
    }
    const veto = node('button', {
      type: 'button', class: `small-button veto ${answer?.type === 'veto' ? 'active' : ''}`,
      text: answer?.type === 'veto' ? '已翻掉' : '翻掉', disabled: locked,
    });
    veto.addEventListener('click', () => choose(round, item, { type: 'veto', text: answer?.type === 'veto' ? answer.text : '' }));
    actions.append(veto);
    row.append(actions);
    if (answer?.type === 'veto') {
      const input = node('input', {
        class: 'veto-input', value: answer.text ?? '', placeholder: '翻掉理由 / 期望改成什么', disabled: locked,
      });
      input.addEventListener('input', () => {
        loadDraft(round.id)[item.q_id] = { type: 'veto', text: input.value };
        saveDraft(round.id);
        updateRoundValidity(round);
      });
      row.append(input);
    }
    block.append(row);
  }
  return block;
}

function missingRequired(round) {
  const draft = loadDraft(round.id);
  const missing = [];
  for (const item of round.items ?? []) {
    const answer = draft[item.q_id];
    if (item.tier === 'ask' && item.required !== false && (!answer || (answer.type === 'custom' && !answer.text?.trim()))) missing.push(item.q_id);
    if (item.tier === 'confirm' && (!answer || (answer.type === 'veto' && !answer.text?.trim()))) missing.push(item.q_id);
    if (item.tier === 'default' && answer?.type === 'veto' && !answer.text?.trim()) missing.push(item.q_id);
  }
  return missing;
}

function submissionFor(round) {
  const draft = loadDraft(round.id);
  const answers = [];
  for (const item of round.items ?? []) {
    const answer = draft[item.q_id];
    if (answer) answers.push({ q_id: item.q_id, ...answer });
    else if (item.tier === 'default') answers.push({ q_id: item.q_id, type: 'accept' });
  }
  return { round: round.id, answers };
}

function readQueue() {
  try { return JSON.parse(localStorage.getItem(queueKey()) ?? '[]'); } catch { return []; }
}

function writeQueue(queue) {
  localStorage.setItem(queueKey(), JSON.stringify(queue));
}

async function postSubmission(payload, allowQueue = true) {
  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok) throw Object.assign(new Error(result.error ?? 'submit_failed'), { result, status: response.status });
    clearDraft(payload.round);
    await loadState();
    return result;
  } catch (error) {
    if (!allowQueue || (error.status && error.status < 500)) throw error;
    const queue = readQueue().filter((entry) => entry.round !== payload.round);
    queue.push(payload);
    writeQueue(queue);
    setConnection('离线 · 已入队', 'offline');
    return { ok: true, queued: true, round: payload.round };
  }
}

async function flushQueue() {
  const pending = readQueue();
  if (pending.length === 0) return;
  const remaining = [];
  for (const payload of pending) {
    try { await postSubmission(payload, false); }
    catch (error) {
      if (error.status !== 409) remaining.push(payload);
    }
  }
  writeQueue(remaining);
}

function renderRound(round) {
  const locked = round.status !== 'pending';
  const card = node('section', {
    class: `round-card ${locked ? 'submitted' : ''}`,
    'data-round': round.id,
    'data-testid': `round-${round.id}`,
  });
  card.append(node('div', { class: 'round-heading' }, [
    node('h2', { text: `Round ${round.no} · ${round.title}` }),
    node('span', { class: 'round-status', text: locked ? 'SUBMITTED · 已锁定' : 'PENDING' }),
  ]));
  for (const item of (round.items ?? []).filter((candidate) => candidate.tier === 'ask')) card.append(renderAsk(round, item, locked));
  for (const tier of ['default', 'confirm']) {
    const block = renderTierBlock(round, tier, (round.items ?? []).filter((item) => item.tier === tier), locked);
    if (block) card.append(block);
  }
  if (round.attachments?.length) {
    const area = node('div', { class: 'round-attachments' });
    for (const name of round.attachments) {
      area.append(node('div', { class: 'attachment' }, [
        node('div', { class: 'attachment-head' }, [node('span', { text: `确认版对照物 · ${name}` })]),
        node('iframe', { src: `/files/${encodeURIComponent(name)}`, sandbox: '', title: name, loading: 'lazy' }),
      ]));
    }
    card.append(area);
  }
  const note = node('span', {
    class: `submit-note ${locked ? 'submitted-note' : ''}`,
    text: locked ? '本轮已经提交，内容只读。' : '提交后先入盘，再唤醒 Agent。',
    'data-testid': `submit-note-${round.id}`,
  });
  if (!locked) {
    const submit = node('button', {
      type: 'button', class: 'primary', text: '提交本轮，生成追问 →',
      disabled: missingRequired(round).length > 0,
      'data-testid': `submit-${round.id}`,
    });
    submit.addEventListener('click', async () => {
      const missing = missingRequired(round);
      if (missing.length > 0) {
        note.textContent = `还需要回答：${missing.join('、')}`;
        note.className = 'submit-note error-note';
        for (const id of missing) card.querySelector(`[data-testid="question-${CSS.escape(id)}"]`)?.classList.add('invalid');
        return;
      }
      submit.disabled = true;
      note.textContent = '正在落盘提交…';
      try {
        const result = await postSubmission(submissionFor(round));
        note.textContent = result.queued ? '服务暂不可达；提交已保存在本机，重连后自动补发。' : '已提交并锁定；Agent 正在继续下一轮。';
        note.className = 'submit-note submitted-note';
      } catch (error) {
        note.textContent = error.status === 409 ? '本轮此前已提交，首次内容为准。' : `提交失败：${error.result?.error ?? error.message}`;
        note.className = 'submit-note error-note';
        submit.disabled = false;
      }
    });
    card.append(node('div', { class: 'submit-row' }, [submit, note]));
  } else card.append(node('div', { class: 'submit-row' }, [note]));
  return card;
}

function renderLocked() {
  if (!(state.locked ?? []).length) {
    elements.locked.replaceChildren(node('div', { class: 'empty-card', text: '结论会随已吸收轮次累积在这里。' }));
    return;
  }
  elements.locked.replaceChildren(...state.locked.map((item) => node('div', { class: 'lock-card' }, [
    node('p', { class: 'lock-question', text: item.q ?? item.ref }),
    node('p', { class: 'lock-answer', text: item.a }),
    node('p', { class: 'lock-source', text: `from ${item.round ?? 'previous'} · ${item.tier ?? 'decision'}` }),
  ])));
}

function finalRound() {
  if (!state.final) return null;
  return state.rounds.find((round) => round.id === state.final.round && round.status === 'pending')
    ?? [...state.rounds].reverse().find((round) => round.view === 'contract' && round.status === 'pending')
    ?? null;
}

function renderContract() {
  if (!state.final) {
    elements.contract.replaceChildren(node('div', { class: 'empty-card', text: '契约视图尚未发布。' }));
    return;
  }
  const final = state.final;
  const parts = [
    node('h1', { text: final.title }),
    node('p', { class: 'contract-subtitle', text: final.subtitle ?? `${state.slug} · 等待确认` }),
  ];
  for (const section of final.sections ?? []) {
    const content = [node('h2', { text: section.title })];
    if (section.body) content.push(node('p', { text: section.body }));
    if (section.bullets?.length) content.push(node('ul', {}, section.bullets.map((item) => node('li', { text: item }))));
    if (section.basis) content.push(node('div', { class: 'basis', text: `依据：${section.basis}` }));
    parts.push(node('section', { class: 'contract-section' }, content));
  }
  const round = finalRound();
  if (round) {
    const item = round.items.find((candidate) => candidate.tier === 'confirm') ?? round.items[0];
    const draft = loadDraft(round.id);
    const actions = node('div', { class: 'contract-actions', 'data-testid': 'contract-actions' });
    const confirm = node('button', { type: 'button', class: 'contract-confirm', text: '确认交付标准 ✓', 'data-testid': 'contract-confirm' });
    const revise = node('button', { type: 'button', class: 'contract-revise', text: '需要修改', 'data-testid': 'contract-revise' });
    const revisionArea = node('div', { class: 'revision-area', hidden: draft[item.q_id]?.type !== 'veto' });
    const input = node('textarea', {
      class: 'revision-input', value: draft[item.q_id]?.text ?? '', placeholder: '哪一节要改？怎么改？',
      'data-testid': 'contract-revision-input',
    });
    const send = node('button', { type: 'button', class: 'revision-send', text: '发送修改意见 →', 'data-testid': 'contract-revision-send' });
    confirm.addEventListener('click', async () => {
      confirm.disabled = true;
      try { await postSubmission({ round: round.id, answers: [{ q_id: item.q_id, type: 'confirm' }] }); }
      catch { confirm.disabled = false; }
    });
    revise.addEventListener('click', () => {
      draft[item.q_id] = { type: 'veto', text: input.value };
      saveDraft(round.id);
      revisionArea.hidden = false;
      input.focus();
    });
    input.addEventListener('input', () => {
      draft[item.q_id] = { type: 'veto', text: input.value };
      saveDraft(round.id);
    });
    send.addEventListener('click', async () => {
      if (!input.value.trim()) return input.focus();
      send.disabled = true;
      try { await postSubmission({ round: round.id, answers: [{ q_id: item.q_id, type: 'veto', text: input.value }] }); }
      catch { send.disabled = false; }
    });
    revisionArea.append(input, send);
    actions.append(confirm, revise, revisionArea);
    parts.push(actions);
  } else {
    parts.push(node('div', { class: 'gate pass', text: '此契约轮次已经提交并锁定。' }));
  }
  elements.contract.replaceChildren(...parts);
}

function renderFlow() {
  const parts = [];
  if (state.opening) parts.push(node('section', { class: 'opening', 'data-testid': 'opening' }, [
    node('small', { text: 'OPENING · 任务陈述（只读）' }),
    node('p', { text: state.opening }),
  ]));
  for (const round of (state.rounds ?? []).filter((candidate) => candidate.view !== 'contract')) parts.push(renderRound(round));
  if (parts.length === 0) parts.push(node('div', { class: 'empty-card', text: '等待 Agent 发布第一轮问题。' }));
  const open = state.open_ambiguities ?? 0;
  parts.push(node('div', { class: `gate ${open === 0 ? 'pass' : ''}`, text: open === 0 ? '✓ 零开放歧义 · 可以进入下一阶段' : `还剩 ${open} 个开放歧义` }));
  elements.flow.replaceChildren(...parts);
}

function render() {
  if (!state) return;
  renderPhases();
  renderFlow();
  renderLocked();
  renderContract();
}

async function loadState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error(`state_${response.status}`);
  const result = await response.json();
  state = result.state;
  render();
}

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/ws`);
  socket.addEventListener('open', async () => {
    reconnectAttempt = 0;
    setConnection('在线', 'online');
    await flushQueue();
  });
  socket.addEventListener('message', async (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (['state-updated', 'submitted', 'reload'].includes(message.type)) await loadState();
  });
  socket.addEventListener('close', () => {
    setConnection('离线 · 重连中', 'offline');
    const wait = Math.min(30_000, 500 * (2 ** reconnectAttempt));
    reconnectAttempt += 1;
    setTimeout(connect, wait);
  });
  socket.addEventListener('error', () => socket.close());
}

function showView(view) {
  activeView = view;
  elements.flowView.hidden = view !== 'flow';
  elements.contractView.hidden = view !== 'contract';
  elements.flowTab.classList.toggle('active', view === 'flow');
  elements.contractTab.classList.toggle('active', view === 'contract');
  elements.flowTab.setAttribute('aria-selected', String(view === 'flow'));
  elements.contractTab.setAttribute('aria-selected', String(view === 'contract'));
}

elements.flowTab.addEventListener('click', () => showView('flow'));
elements.contractTab.addEventListener('click', () => showView('contract'));

try {
  await loadState();
  connect();
  setConnection('连接中', 'loading');
} catch (error) {
  elements.flow.replaceChildren(node('div', { class: 'empty-card error-note', text: `页面状态读取失败：${error.message}` }));
  setConnection('不可用', 'offline');
}
