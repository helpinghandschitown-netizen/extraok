const REQUIRED = {
  company: 'Company name is required.',
  client: 'Client name is required.',
  job: 'Job name is required.',
  originalScope: 'Original scope reference is required.',
  changeTitle: 'Change title is required.',
  changeDescription: 'Change description is required.',
  reason: 'Reason for the change is required.'
};

function clean(value) {
  return String(value ?? '').trim();
}

function decimalToCents(value, label) {
  const text = clean(value);
  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(text)) {
    throw new Error(`${label} must be a number with no more than two decimal places.`);
  }
  if (text.startsWith('-')) {
    throw new Error(`${label} must be zero or greater.`);
  }
  const [whole = '0', fraction = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`${label} is too large.`);
  }
  return cents;
}

function parseRate(value) {
  const text = clean(value || '0');
  if (!/^(?:\d+|\d*\.\d{1,3})$/.test(text)) {
    throw new Error('Tax rate must be a number with no more than three decimal places.');
  }
  const rate = Number(text);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    throw new Error('Tax rate must be between 0 and 100.');
  }
  return rate;
}

export function calculateMoney(labor, materials, taxRate) {
  const laborCents = decimalToCents(labor || '0', 'Labor');
  const materialsCents = decimalToCents(materials || '0', 'Materials');
  const rate = parseRate(taxRate);
  const subtotalCents = laborCents + materialsCents;
  const taxCents = Math.round(subtotalCents * rate / 100);
  return {laborCents, materialsCents, subtotalCents, taxCents, totalCents: subtotalCents + taxCents};
}

export function validateDraft(draft) {
  const errors = {};
  for (const [field, message] of Object.entries(REQUIRED)) {
    if (!clean(draft[field])) errors[field] = message;
  }
  for (const [field, label] of [['labor', 'Labor'], ['materials', 'Materials']]) {
    try { decimalToCents(draft[field] || '0', label); }
    catch (error) { errors[field] = error.message; }
  }
  try { parseRate(draft.taxRate); }
  catch (error) { errors.taxRate = error.message; }
  const days = Number(clean(draft.scheduleDays || '0'));
  if (!Number.isInteger(days) || days < -365 || days > 365) {
    errors.scheduleDays = 'Schedule change must be a whole number from -365 to 365.';
  }
  return errors;
}

function randomId() {
  if (globalThis.crypto?.randomUUID) return `chg_${globalThis.crypto.randomUUID()}`;
  return `chg_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function createChangeRecord(draft, options = {}) {
  const errors = validateDraft(draft);
  if (Object.keys(errors).length) {
    const error = new Error('Please correct the highlighted fields.');
    error.fields = errors;
    throw error;
  }
  const now = options.now || new Date().toISOString();
  const money = calculateMoney(draft.labor, draft.materials, draft.taxRate);
  return {
    version: 1,
    id: options.id || randomId(),
    status: 'pending',
    issuedAt: now,
    company: clean(draft.company),
    client: clean(draft.client),
    job: clean(draft.job),
    originalScope: clean(draft.originalScope),
    changeTitle: clean(draft.changeTitle),
    changeDescription: clean(draft.changeDescription),
    reason: clean(draft.reason),
    money,
    taxRate: Number(clean(draft.taxRate || '0')),
    scheduleDays: Number(clean(draft.scheduleDays || '0')),
    events: [{type: 'issued', at: now, actor: clean(draft.company)}]
  };
}

const ALLOWED_DECISIONS = new Set(['approved', 'declined', 'revision_requested']);

export function recordDecision(record, decision) {
  if (!record || record.status !== 'pending') throw new Error('This issued change already has a final decision.');
  if (!ALLOWED_DECISIONS.has(decision.status)) throw new Error('Choose approve, decline, or request revision.');
  const actor = clean(decision.actor);
  if (!actor) throw new Error('Your name is required.');
  if (decision.consent !== true) throw new Error('Consent is required before submitting a decision.');
  const now = decision.now || new Date().toISOString();
  return {
    ...structuredClone(record),
    status: decision.status,
    decidedAt: now,
    decidedBy: actor,
    decisionNote: clean(decision.note),
    events: [...record.events, {type: decision.status, at: now, actor, note: clean(decision.note)}]
  };
}

export function formatCurrency(cents) {
  return new Intl.NumberFormat('en-US', {style: 'currency', currency: 'USD'}).format(cents / 100);
}

export function formatSchedule(days) {
  if (days === 0) return 'No schedule change';
  const sign = days > 0 ? '+' : '';
  return `${sign}${days} ${Math.abs(days) === 1 ? 'day' : 'days'}`;
}

export function buildAuditSummary(record) {
  const status = record.status.replaceAll('_', ' ').toUpperCase();
  const latest = record.events.at(-1);
  return [
    'EXTRAOK CHANGE SUMMARY',
    `Record: ${record.id} · Version ${record.version}`,
    `Company: ${record.company}`,
    `Client: ${record.client}`,
    `Job: ${record.job}`,
    `Original scope: ${record.originalScope}`,
    `Change title: ${record.changeTitle}`,
    `Requested change: ${record.changeDescription}`,
    `Reason: ${record.reason}`,
    `Labor: ${formatCurrency(record.money.laborCents)}`,
    `Materials: ${formatCurrency(record.money.materialsCents)}`,
    `Tax (${record.taxRate}%): ${formatCurrency(record.money.taxCents)}`,
    `Total change: ${formatCurrency(record.money.totalCents)}`,
    `Schedule change: ${formatSchedule(record.scheduleDays)}`,
    `Decision: ${status}`,
    `Decision by: ${record.decidedBy || 'Pending'}`,
    `Decision time: ${record.decidedAt || 'Pending'}`,
    `Note: ${record.decisionNote || 'No note provided'}`,
    '',
    'Operational record only. ExtraOK does not provide legal advice or promise enforceability.'
  ].join('\n');
}
