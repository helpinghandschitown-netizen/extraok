import test from 'node:test';
import assert from 'node:assert/strict';
import {createDecisionReceipt,createIdentity,createReviewPackage,decodeEnvelope,encodeEnvelope,verifyDecisionReceipt,verifyReviewPackage} from '../src/crypto.mjs';
import {createChangeRecord} from '../src/core.mjs';

const draft={company:'Northstar Painting',client:'Jordan Lee',job:'Kitchen',originalScope:'Paint walls.',changeTitle:'Patch drywall',changeDescription:'Patch and repaint damage.',reason:'Hidden damage.',labor:'100',materials:'25',taxRate:'8',scheduleDays:'1'};

test('review package round-trips and verifies',async()=>{const record=createChangeRecord(draft,{id:'chg_crypto',now:'2026-09-02T12:00:00.000Z'});const identity=await createIdentity();const pkg=await createReviewPackage(record,identity);assert.equal(await verifyReviewPackage(pkg),true);assert.deepEqual(decodeEnvelope(encodeEnvelope(pkg)),pkg)});

test('tampered issued record fails verification',async()=>{const record=createChangeRecord(draft,{id:'chg_crypto',now:'2026-09-02T12:00:00.000Z'});const identity=await createIdentity();const pkg=await createReviewPackage(record,identity);pkg.record.money.totalCents+=10000;assert.equal(await verifyReviewPackage(pkg),false)});

test('decision receipt verifies and tampering fails',async()=>{const record=createChangeRecord(draft,{id:'chg_crypto',now:'2026-09-02T12:00:00.000Z'});const identity=await createIdentity();const pkg=await createReviewPackage(record,identity);const receipt=await createDecisionReceipt(pkg,{status:'approved',actor:'Jordan Lee',consent:true,decidedAt:'2026-09-02T12:05:00.000Z'});assert.equal(await verifyDecisionReceipt(receipt),true);receipt.decision.status='declined';assert.equal(await verifyDecisionReceipt(receipt),false)});
