import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMoney,
  createChangeRecord,
  recordDecision,
  validateDraft,
  buildAuditSummary
} from '../src/core.mjs';

const draft = {
  company: 'Northstar Painting',
  client: 'Jordan Lee',
  job: 'Kitchen refresh',
  originalScope: 'Prime and paint walls and ceiling.',
  changeTitle: 'Repair water-damaged drywall',
  changeDescription: 'Cut out damaged section, patch, sand, prime, and repaint.',
  reason: 'Damage was hidden behind the refrigerator.',
  labor: '275.00',
  materials: '86.50',
  taxRate: '8.25',
  scheduleDays: '1'
};

test('calculateMoney returns integer cents and deterministic totals', () => {
  assert.deepEqual(calculateMoney('275.00', '86.50', '8.25'), {
    laborCents: 27500,
    materialsCents: 8650,
    subtotalCents: 36150,
    taxCents: 2982,
    totalCents: 39132
  });
});

test('validateDraft rejects missing identity and invalid amounts', () => {
  const errors = validateDraft({...draft, client: '', labor: '-1', taxRate: 'nope'});
  assert.equal(errors.client, 'Client name is required.');
  assert.match(errors.labor, /zero or greater/);
  assert.match(errors.taxRate, /number/);
});

test('createChangeRecord normalizes the draft and starts pending', () => {
  const record = createChangeRecord(draft, {id: 'chg_test', now: '2026-09-02T12:00:00.000Z'});
  assert.equal(record.id, 'chg_test');
  assert.equal(record.status, 'pending');
  assert.equal(record.money.totalCents, 39132);
  assert.equal(record.scheduleDays, 1);
  assert.deepEqual(record.events.map(e => e.type), ['issued']);
});

test('recordDecision requires consent and actor and freezes a final decision', () => {
  const record = createChangeRecord(draft, {id: 'chg_test', now: '2026-09-02T12:00:00.000Z'});
  assert.throws(() => recordDecision(record, {status: 'approved', actor: '', consent: true}), /name/i);
  assert.throws(() => recordDecision(record, {status: 'approved', actor: 'Jordan Lee', consent: false}), /consent/i);
  const approved = recordDecision(record, {status: 'approved', actor: 'Jordan Lee', consent: true, note: 'Proceed.', now: '2026-09-02T12:05:00.000Z'});
  assert.equal(approved.status, 'approved');
  assert.equal(approved.events.at(-1).actor, 'Jordan Lee');
  assert.throws(() => recordDecision(approved, {status: 'declined', actor: 'Jordan Lee', consent: true}), /final/i);
});

test('revision request is final for that issued version and appears in audit summary', () => {
  const record = createChangeRecord(draft, {id: 'chg_test', now: '2026-09-02T12:00:00.000Z'});
  const revised = recordDecision(record, {status: 'revision_requested', actor: 'Jordan Lee', consent: true, note: 'Please separate labor.', now: '2026-09-02T12:05:00.000Z'});
  const summary = buildAuditSummary(revised);
  for (const value of ['Kitchen refresh', 'Repair water-damaged drywall', '$391.32', '+1 day', 'REVISION REQUESTED', 'Jordan Lee', 'Please separate labor.']) {
    assert.match(summary, new RegExp(value.replace(/[+.$]/g, '\\$&')));
  }
});
