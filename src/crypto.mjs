const enc = new TextEncoder();
const dec = new TextDecoder();

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalize(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function fromBase64Url(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('binary');
  return Uint8Array.from(binary, ch => ch.charCodeAt(0));
}

export function encodeEnvelope(value) {
  return toBase64Url(enc.encode(JSON.stringify(value)));
}

export function decodeEnvelope(value) {
  if (!value || value.length > 120000) throw new Error('This link is empty or too large.');
  return JSON.parse(dec.decode(fromBase64Url(value)));
}

async function importPrivate(jwk) {
  return crypto.subtle.importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['sign']);
}

async function importPublic(jwk) {
  return crypto.subtle.importKey('jwk', jwk, {name: 'ECDSA', namedCurve: 'P-256'}, false, ['verify']);
}

export async function createIdentity() {
  const pair = await crypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
  return {
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey)
  };
}

export async function fingerprint(publicJwk) {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(canonicalize(publicJwk)));
  return Array.from(new Uint8Array(digest)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('').match(/.{1,4}/gu).join('-');
}

async function sign(value, privateJwk) {
  const key = await importPrivate(privateJwk);
  const signature = await crypto.subtle.sign({name: 'ECDSA', hash: 'SHA-256'}, key, enc.encode(canonicalize(value)));
  return toBase64Url(new Uint8Array(signature));
}

async function verify(value, signature, publicJwk) {
  const key = await importPublic(publicJwk);
  return crypto.subtle.verify({name: 'ECDSA', hash: 'SHA-256'}, key, fromBase64Url(signature), enc.encode(canonicalize(value)));
}

export async function createReviewPackage(record, identity) {
  const unsigned = {kind: 'extraok-review', protocol: 1, record, issuerPublicKey: identity.publicJwk};
  return {...unsigned, signature: await sign(unsigned, identity.privateJwk)};
}

export async function verifyReviewPackage(pkg) {
  if (!pkg || pkg.kind !== 'extraok-review' || pkg.protocol !== 1 || !pkg.record || !pkg.issuerPublicKey || !pkg.signature) return false;
  return verify({kind: pkg.kind, protocol: pkg.protocol, record: pkg.record, issuerPublicKey: pkg.issuerPublicKey}, pkg.signature, pkg.issuerPublicKey);
}

export async function createDecisionReceipt(reviewPackage, decision) {
  if (!await verifyReviewPackage(reviewPackage)) throw new Error('The original approval package did not pass its integrity check.');
  const identity = await createIdentity();
  const body = {
    kind: 'extraok-receipt', protocol: 1, reviewPackage,
    decision: {
      status: decision.status,
      actor: String(decision.actor || '').trim(),
      note: String(decision.note || '').trim(),
      consent: decision.consent === true,
      decidedAt: decision.decidedAt || new Date().toISOString()
    },
    decisionPublicKey: identity.publicJwk
  };
  if (!body.decision.actor || !body.decision.consent || !['approved','declined','revision_requested'].includes(body.decision.status)) throw new Error('A valid decision, name, and consent are required.');
  return {...body, signature: await sign(body, identity.privateJwk)};
}

export async function verifyDecisionReceipt(receipt) {
  if (!receipt || receipt.kind !== 'extraok-receipt' || receipt.protocol !== 1 || !receipt.reviewPackage || !receipt.decisionPublicKey || !receipt.signature) return false;
  if (!await verifyReviewPackage(receipt.reviewPackage)) return false;
  const body = {kind: receipt.kind, protocol: receipt.protocol, reviewPackage: receipt.reviewPackage, decision: receipt.decision, decisionPublicKey: receipt.decisionPublicKey};
  return verify(body, receipt.signature, receipt.decisionPublicKey);
}
