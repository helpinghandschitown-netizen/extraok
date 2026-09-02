import {canonicalize, decodeEnvelope, encodeEnvelope, fromBase64Url} from './crypto.mjs';

const PUBLIC_KEY = {"key_ops":["verify"],"ext":true,"kty":"EC","x":"LZzTxIWBAbfChuOEEVAWM2Z2-wiRKW81GK4GKQLLnek","y":"hbBtePcDByy7CaLg7aQF7aQHmY3IAmUANeBCCjeuBGE","crv":"P-256"};
const enc = new TextEncoder();

export async function verifyLicenseCode(code) {
  try {
    const envelope = decodeEnvelope(String(code || '').trim());
    if (envelope?.kind !== 'extraok-license' || envelope?.protocol !== 1 || !envelope.license || !envelope.signature) return null;
    const key = await crypto.subtle.importKey('jwk', PUBLIC_KEY, {name:'ECDSA',namedCurve:'P-256'}, false, ['verify']);
    const unsigned = {kind: envelope.kind, protocol: envelope.protocol, license: envelope.license};
    const ok = await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'}, key, fromBase64Url(envelope.signature), enc.encode(canonicalize(unsigned)));
    if (!ok || envelope.license.product !== 'extraok-pro-lifetime') return null;
    return envelope.license;
  } catch { return null; }
}

export function encodeLicense(unsigned, signature) {
  return encodeEnvelope({...unsigned, signature});
}
