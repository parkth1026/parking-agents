const elements = {
  phases: document.querySelector('#phases'),
  ambiguities: document.querySelector('#ambiguities'),
  connection: document.querySelector('#connection'),
  flow: document.querySelector('#flow'),
  locked: document.querySelector('#locked'),
  flowView: document.querySelector('#flow-view'),
  contractView: document.querySelector('#contract-view'),
  dossierView: document.querySelector('#dossier-view'),
  contract: document.querySelector('#contract'),
  dossier: document.querySelector('#dossier'),
  flowTab: document.querySelector('#flow-tab'),
  contractTab: document.querySelector('#contract-tab'),
  dossierTab: document.querySelector('#dossier-tab'),
};

let state = null;
let dossierData = null;
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

function submittedKey(roundId) {
  return `workflow-interview-web:submitted:${state?.slug ?? 'unknown'}:${roundId}`;
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

function rememberSubmission(payload) {
  const answers = Object.fromEntries((payload.answers ?? []).map((answer) => [answer.q_id, answer]));
  localStorage.setItem(submittedKey(payload.round), JSON.stringify(answers));
}

function loadSubmitted(roundId) {
  try { return JSON.parse(localStorage.getItem(submittedKey(roundId)) ?? '{}'); }
  catch { return {}; }
}

function answerFor(round, item, locked) {
  if (!locked) return loadDraft(round.id)[item.q_id];
  const canonical = dossierData?.submissions?.[round.id]?.answers?.find((answer) => answer.q_id === item.q_id);
  return canonical ?? loadSubmitted(round.id)[item.q_id];
}

function responseType(item) {
  return item.response?.type ?? 'single_select';
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

function markdownBlock(source) {
  const root = node('div', { class: 'dossier-markdown' });
  let list = null;
  let paragraph = [];
  let code = null;
  const flushParagraph = () => {
    if (paragraph.length) root.append(node('p', { text: paragraph.join(' ') }));
    paragraph = [];
  };
  const flushList = () => { list = null; };
  for (const raw of text(source).replaceAll('\r\n', '\n').split('\n')) {
    if (/^```/.test(raw.trim())) {
      flushParagraph(); flushList();
      if (code) { root.append(node('pre', { text: code.join('\n') })); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(raw); continue; }
    const heading = raw.match(/^(#{1,4})\s+(.+)$/);
    const unordered = raw.match(/^\s*[-*]\s+(.+)$/);
    const ordered = raw.match(/^\s*\d+[.)]\s+(.+)$/);
    const quote = raw.match(/^>\s?(.+)$/);
    if (!raw.trim()) { flushParagraph(); flushList(); continue; }
    if (heading) {
      flushParagraph(); flushList();
      root.append(node(`h${Math.min(heading[1].length + 1, 5)}`, { text: heading[2] }));
    } else if (unordered || ordered) {
      flushParagraph();
      const tag = ordered ? 'ol' : 'ul';
      if (!list || list.tagName.toLowerCase() !== tag) { list = node(tag); root.append(list); }
      list.append(node('li', { text: (unordered ?? ordered)[1] }));
    } else if (quote) {
      flushParagraph(); flushList();
      root.append(node('blockquote', { text: quote[1] }));
    } else {
      flushList(); paragraph.push(raw.trim());
    }
  }
  if (code) root.append(node('pre', { text: code.join('\n') }));
  flushParagraph();
  return root;
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

function detailFact(label, value) {
  return node('div', { class: 'decision-fact' }, [
    node('span', { class: 'decision-fact-label', text: label }),
    node('span', { class: 'decision-fact-value', text: value || '未说明' }),
  ]);
}

function choiceDetail(option, active) {
  return node('div', {
    class: `decision-detail ${active ? 'active' : ''}`,
    'aria-hidden': active ? 'false' : 'true',
  }, [
    detailFact('覆盖', option.covers),
    detailFact('好处', option.pros?.join(' · ')),
    detailFact('代价', option.cons?.join(' · ')),
  ]);
}

function renderSingleDetails(round, item, answer, locked) {
  const stack = node('div', {
    id: `detail-${item.q_id}`,
    class: 'decision-detail-stack',
    'aria-live': locked ? 'off' : 'polite',
  });
  const hasAnswer = answer?.type === 'choice' || answer?.type === 'custom';
  stack.append(node('div', {
    class: `decision-detail decision-placeholder ${hasAnswer ? '' : 'active'}`,
    'aria-hidden': hasAnswer ? 'true' : 'false',
  }, [
    node('span', { class: 'decision-placeholder-title', text: '选择后在这里显示判断依据' }),
    node('span', { text: '覆盖范围、好处和代价会固定留在本题下方。' }),
  ]));
  for (const option of item.options ?? []) {
    stack.append(choiceDetail(option, answer?.type === 'choice' && answer.choice === option.key));
  }
  if (item.allow_custom !== false) {
    const active = answer?.type === 'custom';
    const input = node('textarea', {
      class: 'inline-editor', value: active ? answer.text ?? '' : '',
      placeholder: '写下你的选择与边界（最多 2000 字符）', maxLength: 4000,
      disabled: locked || !active,
      'data-testid': `other-${item.q_id}`,
      'aria-label': `${item.q_id} 自由输入`,
    });
    input.addEventListener('input', () => {
      loadDraft(round.id)[item.q_id] = { type: 'custom', text: input.value };
      saveDraft(round.id);
      updateRoundValidity(round);
    });
    stack.append(node('div', {
      class: `decision-detail decision-editor ${active ? 'active' : ''}`,
      'aria-hidden': active ? 'false' : 'true',
    }, [input]));
  }
  return stack;
}

function multiChoices(answer) {
  return answer?.type === 'multi' ? answer.choices ?? [] : [];
}

function toggleMulti(round, item, answer, key) {
  const selected = new Set(multiChoices(answer));
  const exclusive = new Set(item.response?.exclusive_keys ?? []);
  const customActive = answer?.type === 'multi' && Object.hasOwn(answer, 'custom');
  if (selected.has(key)) selected.delete(key);
  else if (exclusive.has(key)) {
    selected.clear();
    selected.add(key);
  } else {
    for (const exclusiveKey of exclusive) selected.delete(exclusiveKey);
    const max = item.response?.max_selections ?? (item.options?.length ?? 0) + (item.allow_custom === false ? 0 : 1);
    if (selected.size + (customActive ? 1 : 0) >= max) return;
    selected.add(key);
  }
  choose(round, item, { type: 'multi', choices: [...selected], ...(customActive ? { custom: answer.custom ?? '' } : {}) });
}

function renderMultiDetails(round, item, answer, locked) {
  const selected = new Set(multiChoices(answer));
  const board = node('div', { id: `detail-${item.q_id}`, class: 'multi-detail-board', 'aria-live': locked ? 'off' : 'polite' });
  for (const option of item.options ?? []) {
    board.append(node('article', { class: `multi-detail-row ${selected.has(option.key) ? 'selected' : ''}` }, [
      node('strong', { text: `${selected.has(option.key) ? '✓ ' : ''}${option.key}. ${option.text}` }),
      detailFact('覆盖', option.covers),
      detailFact('好处', option.pros?.join(' · ')),
      detailFact('代价', option.cons?.join(' · ')),
    ]));
  }
  if (item.allow_custom !== false) {
    const active = answer?.type === 'multi' && Object.hasOwn(answer, 'custom');
    const input = node('textarea', {
      class: 'inline-editor', value: active ? answer.custom ?? '' : '',
      placeholder: '补充未列出的选择与边界', maxLength: 4000, disabled: locked || !active,
      'data-testid': `other-${item.q_id}`, 'aria-label': `${item.q_id} 多选补充`,
    });
    input.addEventListener('input', () => {
      loadDraft(round.id)[item.q_id] = { type: 'multi', choices: multiChoices(answer), custom: input.value };
      saveDraft(round.id);
      updateRoundValidity(round);
    });
    board.append(node('article', { class: `multi-detail-row multi-custom-row ${active ? 'selected' : ''}` }, [
      node('strong', { text: active ? '✓ Other · 自定义选择' : 'Other · 未启用' }),
      input,
    ]));
  }
  return board;
}

function choose(round, item, value) {
  const draft = loadDraft(round.id);
  draft[item.q_id] = value;
  saveDraft(round.id);
  render();
  if (value.type === 'custom' || value.type === 'veto' || (value.type === 'multi' && Object.hasOwn(value, 'custom'))) {
    requestAnimationFrame(() => document.querySelector(
      `[data-testid="${value.type === 'veto' ? 'veto' : 'other'}-${CSS.escape(item.q_id)}"]`,
    )?.focus());
  }
}

function optionSummary(option) {
  return node('span', { class: 'option-summary' }, [
    node('span', { class: 'option-key', text: `${option.key}.` }),
    node('span', { class: 'option-text', text: option.text }),
    ...(option.recommended ? [node('span', { class: 'recommended', text: '推荐' })] : []),
    ...(Number.isFinite(option.pct) ? [node('span', { class: 'pct', text: `${option.pct}%` })] : []),
  ]);
}

function renderSingleChoice(round, item, answer, locked) {
  const options = node('div', { class: 'options' });
  for (const option of item.options ?? []) {
    const button = node('button', {
      type: 'button',
      class: `option ${answer?.type === 'choice' && answer.choice === option.key ? 'selected' : ''}`,
      disabled: locked,
      'data-choice': option.key,
      'aria-pressed': answer?.type === 'choice' && answer.choice === option.key ? 'true' : 'false',
      'aria-controls': `detail-${item.q_id}`,
    }, [optionSummary(option)]);
    button.addEventListener('click', () => choose(round, item, { type: 'choice', choice: option.key }));
    options.append(button);
  }
  if (item.allow_custom !== false) {
    const other = node('button', {
      type: 'button',
      class: `other-button ${answer?.type === 'custom' ? 'selected' : ''}`,
      text: 'Other… 自由输入',
      disabled: locked,
      'aria-pressed': answer?.type === 'custom' ? 'true' : 'false',
      'aria-controls': `detail-${item.q_id}`,
    });
    other.addEventListener('click', () => choose(round, item, { type: 'custom', text: answer?.type === 'custom' ? answer.text : '' }));
    options.append(other);
  }
  return [options, renderSingleDetails(round, item, answer, locked)];
}

function renderMultiChoice(round, item, answer, locked) {
  const selected = new Set(multiChoices(answer));
  const group = node('fieldset', { class: 'options multi-options', 'aria-describedby': `detail-${item.q_id}` });
  group.append(node('legend', { class: 'sr-only', text: item.question }));
  for (const option of item.options ?? []) {
    const input = node('input', { type: 'checkbox', checked: selected.has(option.key), disabled: locked, value: option.key });
    input.addEventListener('change', () => toggleMulti(round, item, answer, option.key));
    group.append(node('label', { class: `option multi-option ${selected.has(option.key) ? 'selected' : ''}` }, [input, optionSummary(option)]));
  }
  if (item.allow_custom !== false) {
    const active = answer?.type === 'multi' && Object.hasOwn(answer, 'custom');
    const input = node('input', { type: 'checkbox', checked: active, disabled: locked });
    input.addEventListener('change', () => {
      const next = { type: 'multi', choices: multiChoices(answer) };
      const max = item.response?.max_selections ?? (item.options?.length ?? 0) + 1;
      if (input.checked && next.choices.length >= max) {
        input.checked = false;
        return;
      }
      if (input.checked) next.custom = answer?.custom ?? '';
      choose(round, item, next);
    });
    group.append(node('label', { class: `option multi-option other-button ${active ? 'selected' : ''}` }, [input, node('span', { text: 'Other… 自由输入' })]));
  }
  return [group, renderMultiDetails(round, item, answer, locked)];
}

function setSimpleAnswer(round, item, answer) {
  loadDraft(round.id)[item.q_id] = answer;
  saveDraft(round.id);
  updateRoundValidity(round);
}

function renderSimpleInput(round, item, answer, locked, type) {
  const spec = item.response ?? {};
  let input;
  if (type === 'long_text' || type === 'evidence') {
    input = node('textarea', {
      class: 'standalone-editor', value: type === 'evidence' ? answer?.values?.join('\n') ?? '' : answer?.value ?? '',
      placeholder: spec.placeholder ?? (type === 'evidence' ? '每行填写一个文件路径、URL 或证据说明' : '写下完整答案与边界'),
      maxLength: spec.max_length ?? 8000, disabled: locked, 'data-testid': `input-${item.q_id}`,
    });
  } else {
    const inputType = type === 'number' ? 'number' : type === 'date_time' ? spec.format ?? 'date' : 'text';
    input = node('input', {
      class: 'standalone-editor standalone-editor-line', type: inputType,
      value: answer?.value ?? '', placeholder: spec.placeholder ?? '', disabled: locked,
      ...(type === 'number' && Number.isFinite(spec.min) ? { min: spec.min } : {}),
      ...(type === 'number' && Number.isFinite(spec.max) ? { max: spec.max } : {}),
      ...(type === 'number' && Number.isFinite(spec.step) ? { step: spec.step } : {}),
      'data-testid': `input-${item.q_id}`,
    });
  }
  input.addEventListener('input', () => {
    if (type === 'number') setSimpleAnswer(round, item, { type: 'number', value: input.value === '' ? null : Number(input.value), ...(spec.unit ? { unit: spec.unit } : {}) });
    else if (type === 'date_time') setSimpleAnswer(round, item, { type: 'date_time', value: input.value });
    else if (type === 'evidence') setSimpleAnswer(round, item, { type: 'evidence', values: input.value.split(/\r?\n/).map((value) => value.trim()).filter(Boolean) });
    else setSimpleAnswer(round, item, { type: 'text', value: input.value });
  });
  return node('div', { class: 'simple-answer-slot' }, [
    input,
    ...(spec.unit ? [node('span', { class: 'input-unit', text: spec.unit })] : []),
  ]);
}

function renderBoolean(round, item, answer, locked) {
  const spec = item.response ?? {};
  const options = item.options ?? [
    { key: 'yes', text: spec.true_label ?? '是', value: true },
    { key: 'no', text: spec.false_label ?? '否', value: false },
  ];
  const labelFor = (value) => {
    const match = options.entries().find(([index, option]) => (option.value ?? index === 0) === value);
    return match ? match[1].text : (value ? '是' : '否');
  };
  const row = node('div', { class: 'options' });
  for (const [index, option] of options.entries()) {
    const value = option.value ?? index === 0;
    const selected = answer?.type === 'boolean' && answer.value === value;
    const button = node('button', { type: 'button', class: `option ${selected ? 'selected' : ''}`, disabled: locked, 'aria-pressed': String(selected) }, [optionSummary(option)]);
    button.addEventListener('click', () => choose(round, item, { type: 'boolean', value }));
    row.append(button);
  }
  return [row, node('div', { class: 'simple-answer-slot boolean-summary' }, [node('span', { text: answer?.type === 'boolean' ? `当前选择：${labelFor(answer.value)}` : '请选择明确的是或否。' })])];
}

function renderRanking(round, item, answer, locked) {
  const order = answer?.type === 'ranking' ? [...answer.choices] : (item.options ?? []).map((option) => option.key);
  const optionByKey = new Map((item.options ?? []).map((option) => [option.key, option]));
  const list = node('ol', { class: 'ranking-list' });
  const move = (index, delta) => {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    choose(round, item, { type: 'ranking', choices: next });
  };
  order.forEach((key, index) => {
    const option = optionByKey.get(key);
    if (!option) return;
    list.append(node('li', {}, [
      node('span', { text: `${option.key}. ${option.text}` }),
      node('div', { class: 'ranking-actions' }, [
        node('button', { type: 'button', text: '上移', disabled: locked || index === 0, 'aria-label': `${option.text} 上移` }),
        node('button', { type: 'button', text: '下移', disabled: locked || index === order.length - 1, 'aria-label': `${option.text} 下移` }),
      ]),
    ]));
    const actions = list.lastElementChild.querySelectorAll('button');
    actions[0].addEventListener('click', () => move(index, -1));
    actions[1].addEventListener('click', () => move(index, 1));
  });
  if (!answer && !locked) requestAnimationFrame(() => setSimpleAnswer(round, item, { type: 'ranking', choices: order }));
  return list;
}

function renderAsk(round, item, locked) {
  const answer = answerFor(round, item, locked);
  const type = responseType(item);
  const question = node('div', { class: 'question interactive', 'data-testid': `question-${item.q_id}` });
  const head = node('div', { class: 'question-head' }, [
    node('span', { class: 'question-id', text: item.q_id }),
    node('span', { class: 'question-title', id: `title-${item.q_id}`, text: item.question }),
    node('span', { class: 'response-type', text: type.replaceAll('_', ' ') }),
  ]);
  if (item.irreversible) head.append(node('span', { class: 'pill risk', text: '不可逆 · 值得选' }));
  question.append(head);
  if (item.known_facts) question.append(node('div', { class: 'facts', text: `已知事实：${item.known_facts}` }));
  if (type === 'single_select') question.append(...renderSingleChoice(round, item, answer, locked));
  else if (type === 'multi_select') question.append(...renderMultiChoice(round, item, answer, locked));
  else if (type === 'boolean') question.append(...renderBoolean(round, item, answer, locked));
  else if (type === 'ranking') question.append(renderRanking(round, item, answer, locked));
  else question.append(renderSimpleInput(round, item, answer, locked, type));
  return question;
}

function renderTierDetails(round, item, answer, tier, locked) {
  const stack = node('div', { id: `detail-${item.q_id}`, class: 'tier-detail-stack', 'aria-live': locked ? 'off' : 'polite' });
  const vetoActive = answer?.type === 'veto';
  const accepted = tier === 'default' && !vetoActive;
  const confirmed = tier === 'confirm' && answer?.type === 'confirm';
  const waiting = tier === 'confirm' && !answer;
  stack.append(node('div', {
    class: `tier-detail ${accepted || confirmed || waiting ? 'active' : ''}`,
    'aria-hidden': accepted || confirmed || waiting ? 'false' : 'true',
  }, [node('span', {
    text: accepted
      ? '默认接受；如不同意，请点“翻掉”并写明期望修改。'
      : confirmed
        ? '已明确确认；提交前仍可翻掉并说明修改意见。'
        : '需要明确确认，或翻掉并写明期望修改。',
  })]));
  const input = node('input', {
    class: 'inline-editor inline-editor-line', value: vetoActive ? answer.text ?? '' : '',
    placeholder: '翻掉理由 / 期望改成什么', maxLength: 4000,
    disabled: locked || !vetoActive,
    'data-testid': `veto-${item.q_id}`,
    'aria-label': `${item.q_id} 翻掉理由`,
  });
  input.addEventListener('input', () => {
    loadDraft(round.id)[item.q_id] = { type: 'veto', text: input.value };
    saveDraft(round.id);
    updateRoundValidity(round);
  });
  stack.append(node('div', {
    class: `tier-detail tier-detail-editor ${vetoActive ? 'active' : ''}`,
    'aria-hidden': vetoActive ? 'false' : 'true',
  }, [input]));
  return stack;
}

function renderTierBlock(round, tier, items, locked) {
  if (items.length === 0) return null;
  const title = tier === 'default' ? 'DEFAULT · 不反对就算定' : 'CONFIRM · 选错难回头，请确认';
  const block = node('div', { class: 'tier-block interactive', 'data-tier': tier }, [node('p', { class: 'tier-title', text: title })]);
  for (const item of items) {
    const answer = answerFor(round, item, locked);
    const itemBlock = node('div', { class: 'tier-item', 'data-testid': `question-${item.q_id}` });
    const row = node('div', { class: 'tier-row' }, [
      node('div', { class: 'tier-copy', text: item.line }),
    ]);
    const actions = node('div', { class: 'tier-actions' });
    if (tier === 'confirm') {
      const confirm = node('button', {
        type: 'button', class: `small-button confirm ${answer?.type === 'confirm' ? 'active' : ''}`,
        text: answer?.type === 'confirm' ? '已确认 ✓' : '确认', disabled: locked, 'aria-controls': `detail-${item.q_id}`,
      });
      confirm.addEventListener('click', () => choose(round, item, { type: 'confirm' }));
      actions.append(confirm);
    }
    const veto = node('button', {
      type: 'button', class: `small-button veto ${answer?.type === 'veto' ? 'active' : ''}`,
      text: answer?.type === 'veto' ? '已翻掉' : '翻掉', disabled: locked, 'aria-controls': `detail-${item.q_id}`,
    });
    veto.addEventListener('click', () => choose(round, item, { type: 'veto', text: answer?.type === 'veto' ? answer.text : '' }));
    actions.append(veto);
    row.append(actions);
    itemBlock.append(row, renderTierDetails(round, item, answer, tier, locked));
    block.append(itemBlock);
  }
  return block;
}

function answerComplete(item, answer) {
  if (!answer) return false;
  const type = responseType(item);
  if (type === 'single_select') return answer.type === 'choice' || (answer.type === 'custom' && answer.text?.trim());
  if (type === 'multi_select') {
    if (answer.type !== 'multi') return false;
    const count = (answer.choices?.length ?? 0) + (answer.custom?.trim() ? 1 : 0);
    const min = item.response?.min_selections ?? (item.required === false ? 0 : 1);
    return count >= min;
  }
  if (type === 'boolean') return answer.type === 'boolean' && typeof answer.value === 'boolean';
  if (type === 'short_text' || type === 'long_text') return answer.type === 'text' && answer.value?.trim();
  if (type === 'number') return answer.type === 'number' && Number.isFinite(answer.value);
  if (type === 'date_time') return answer.type === 'date_time' && answer.value?.trim();
  if (type === 'ranking') return answer.type === 'ranking' && answer.choices?.length >= (item.response?.min_ranked ?? item.options?.length ?? 0);
  if (type === 'evidence') return answer.type === 'evidence' && answer.values?.length > 0;
  return false;
}

function missingRequired(round) {
  const draft = loadDraft(round.id);
  const missing = [];
  for (const item of round.items ?? []) {
    const answer = draft[item.q_id];
    if (item.tier === 'ask' && item.required !== false && !answerComplete(item, answer)) missing.push(item.q_id);
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
    rememberSubmission(payload);
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

function readableAnswer(answer) {
  if (!answer) return '尚未回答';
  if (answer.type === 'choice') return `选择 ${answer.choice}`;
  if (answer.type === 'multi') return `选择 ${answer.choices.join('、')}${answer.custom ? `；补充：${answer.custom}` : ''}`;
  if (answer.type === 'custom' || answer.type === 'veto') return answer.text;
  if (answer.type === 'text') return answer.value;
  if (answer.type === 'number') return `${answer.value}${answer.unit ? ` ${answer.unit}` : ''}`;
  if (answer.type === 'date_time') return answer.value;
  if (answer.type === 'ranking') return answer.choices.join(' → ');
  if (answer.type === 'evidence') return answer.values.join('；');
  if (answer.type === 'boolean') return answer.value ? '是' : '否';
  if (answer.type === 'confirm') return '明确确认';
  if (answer.type === 'accept') return '未反对，按默认接受';
  return JSON.stringify(answer);
}

function dossierDecision(round, item, answer) {
  const article = node('article', { class: 'dossier-decision' }, [
    node('div', { class: 'dossier-decision-head' }, [
      node('span', { text: `${item.q_id} · ${item.tier} · ${responseType(item)}` }),
      node('strong', { text: item.question ?? item.line }),
    ]),
  ]);
  if (item.known_facts) article.append(node('p', { class: 'facts', text: `已知事实：${item.known_facts}` }));
  if (item.options?.length) {
    const selected = new Set(answer?.type === 'choice' ? [answer.choice] : answer?.type === 'multi' ? answer.choices : []);
    article.append(node('div', { class: 'dossier-option-grid' }, item.options.map((option) => node('div', {
      class: `dossier-option ${selected.has(option.key) ? 'selected' : ''}`,
    }, [
      node('strong', { text: `${selected.has(option.key) ? '✓ ' : ''}${option.key}. ${option.text}` }),
      detailFact('覆盖', option.covers),
      detailFact('好处', option.pros?.join(' · ')),
      detailFact('代价', option.cons?.join(' · ')),
    ]))));
  }
  article.append(node('p', { class: 'dossier-answer' }, [
    node('strong', { text: '用户决定' }),
    node('span', { text: readableAnswer(answer) }),
  ]));
  const refs = item.source_refs ?? (item.triggered_by ? [item.triggered_by] : []);
  if (refs.length) article.append(node('p', { class: 'dossier-trace', text: `来源：${refs.join(' · ')}` }));
  return article;
}

function renderDossier() {
  if (!dossierData) {
    elements.dossier.replaceChildren(node('div', { class: 'empty-card', text: '完整轨迹尚未生成。' }));
    return;
  }
  const parts = [node('section', { class: 'dossier-hero' }, [
    node('p', { class: 'eyebrow', text: 'GOAL CONTRACT · DECISION DOSSIER' }),
    node('h1', { text: dossierData.title ?? dossierData.slug }),
    node('p', { text: state.opening ?? '未记录原始请求' }),
    node('div', { class: 'dossier-meta' }, [
      node('span', { text: `状态 ${dossierData.status}` }),
      node('span', { text: `开放歧义 ${state.open_ambiguities ?? 0}` }),
      node('span', { text: `State ${dossierData.state_digest.slice(0, 12)}` }),
      node('span', { text: `Ledger ${dossierData.ledger.length}` }),
    ]),
  ])];

  const context = node('section', { class: 'dossier-section' }, [node('h2', { text: '原始请求与上下文' })]);
  context.append(dossierData.context_markdown
    ? markdownBlock(dossierData.context_markdown)
    : node('p', { text: state.opening ?? '' }));
  parts.push(context);

  const trajectory = node('section', { class: 'dossier-section' }, [node('h2', { text: '完整需求轨迹' })]);
  for (const round of state.rounds ?? []) {
    const submission = dossierData.submissions?.[round.id];
    const answerById = new Map((submission?.answers ?? []).map((answer) => [answer.q_id, answer]));
    const roundSection = node('section', { class: 'dossier-round' }, [
      node('div', { class: 'round-heading' }, [
        node('h3', { text: `Round ${round.no} · ${round.title}` }),
        node('span', { class: 'round-status', text: `${round.stage} · ${round.status}` }),
      ]),
    ]);
    for (const item of round.items ?? []) roundSection.append(dossierDecision(round, item, answerById.get(item.q_id)));
    trajectory.append(roundSection);
  }
  parts.push(trajectory);

  const contract = node('section', { class: 'dossier-section' }, [node('h2', { text: '当前 Goal Contract' })]);
  if (state.final) {
    for (const section of state.final.sections ?? []) {
      contract.append(node('article', { class: 'contract-section' }, [
        node('h3', { text: section.title }),
        ...(section.body ? [node('p', { text: section.body })] : []),
        ...(section.bullets?.length ? [node('ul', {}, section.bullets.map((value) => node('li', { text: value })))] : []),
        ...(section.basis ? [node('p', { class: 'dossier-trace', text: `依据：${section.basis}` })] : []),
      ]));
    }
  } else contract.append(node('p', { class: 'facts', text: '尚未发布契约候选。' }));
  if (dossierData.contract_markdown) contract.append(node('details', {}, [
    node('summary', { text: '查看 contract.md 原文' }),
    markdownBlock(dossierData.contract_markdown),
  ]));
  parts.push(contract);

  const sources = node('section', { class: 'dossier-section' }, [node('h2', { text: '来源、原型与附件' })]);
  for (const source of dossierData.sources ?? []) {
    sources.append(node('details', {}, [
      node('summary', { text: `${source.path} · ${source.bytes} bytes · ${source.sha256.slice(0, 12)}` }),
      ...(source.text !== undefined ? [node('pre', { class: 'dossier-source-text', text: source.text })] : [node('p', { text: '二进制文件；静态导出会内嵌文件与摘要。' })]),
    ]));
  }
  if (!(dossierData.sources ?? []).length) sources.append(node('p', { class: 'facts', text: '没有已发布来源文件。' }));
  parts.push(sources);

  const ledger = node('section', { class: 'dossier-section' }, [node('h2', { text: '溯源账本' })]);
  ledger.append(node('div', { class: 'ledger-list' }, (dossierData.ledger ?? []).map((event) => node('div', { class: 'ledger-event' }, [
    node('time', { text: event.at }),
    node('strong', { text: event.type }),
    node('span', { text: `${event.actor?.id ?? 'unknown'} · ${event.entity?.id ?? ''}` }),
    node('code', { text: event.event_digest?.slice(0, 16) ?? '' }),
  ]))));
  parts.push(ledger);

  elements.dossier.replaceChildren(...parts);
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
  renderDossier();
}

async function loadState() {
  const response = await fetch('/api/state', { cache: 'no-store' });
  if (!response.ok) throw new Error(`state_${response.status}`);
  const result = await response.json();
  state = result.state;
  dossierData = result.dossier;
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
  elements.dossierView.hidden = view !== 'dossier';
  elements.flowTab.classList.toggle('active', view === 'flow');
  elements.contractTab.classList.toggle('active', view === 'contract');
  elements.dossierTab.classList.toggle('active', view === 'dossier');
  elements.flowTab.setAttribute('aria-selected', String(view === 'flow'));
  elements.contractTab.setAttribute('aria-selected', String(view === 'contract'));
  elements.dossierTab.setAttribute('aria-selected', String(view === 'dossier'));
}

elements.flowTab.addEventListener('click', () => showView('flow'));
elements.contractTab.addEventListener('click', () => showView('contract'));
elements.dossierTab.addEventListener('click', () => showView('dossier'));

try {
  await loadState();
  connect();
  setConnection('连接中', 'loading');
} catch (error) {
  elements.flow.replaceChildren(node('div', { class: 'empty-card error-note', text: `页面状态读取失败：${error.message}` }));
  setConnection('不可用', 'offline');
}
