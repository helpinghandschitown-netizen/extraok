const KEY = 'extraok.state.v1';
const EMPTY = {schema: 1, identity: null, records: [], license: null, company: ''};

export function loadState(storage = localStorage) {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) || 'null');
    if (!parsed || parsed.schema !== 1 || !Array.isArray(parsed.records)) return structuredClone(EMPTY);
    return {...structuredClone(EMPTY), ...parsed};
  } catch { return structuredClone(EMPTY); }
}

export function saveState(state, storage = localStorage) {
  storage.setItem(KEY, JSON.stringify({...state, schema: 1}));
  return state;
}

export function upsertRecord(state, entry) {
  const records = state.records.filter(x => x.record.id !== entry.record.id);
  return {...state, records: [entry, ...records]};
}

export function findRecord(state, id) {
  return state.records.find(x => x.record.id === id) || null;
}

export function activeCount(state) {
  return state.records.filter(x => x.record.status === 'pending').length;
}

export function exportBackup(state) {
  return JSON.stringify({kind: 'extraok-backup', exportedAt: new Date().toISOString(), state}, null, 2);
}

export function importBackup(text) {
  const data = JSON.parse(text);
  if (data?.kind !== 'extraok-backup' || data?.state?.schema !== 1 || !Array.isArray(data.state.records)) throw new Error('Not a valid ExtraOK backup.');
  return data.state;
}
