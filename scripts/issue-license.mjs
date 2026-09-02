import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {canonicalize, encodeEnvelope, toBase64Url} from '../src/crypto.mjs';

const args=Object.fromEntries(process.argv.slice(2).map((item,i,a)=>item.startsWith('--')?[item.slice(2),a[i+1]]:null).filter(Boolean));
if(!args.customer||!args.order){console.error('Usage: node scripts/issue-license.mjs --customer "Name or email" --order "ORDER-ID"');process.exit(2)}
const keyPath=process.env.EXTRAOK_LICENSE_PRIVATE_KEY||path.join(os.homedir(),'AppData','Local','hermes','secrets','extraok-license-private.jwk');
const privateJwk=JSON.parse(fs.readFileSync(keyPath,'utf8'));
const license={product:'extraok-pro-lifetime',customer:String(args.customer).trim(),orderId:String(args.order).trim(),issuedAt:new Date().toISOString()};
const unsigned={kind:'extraok-license',protocol:1,license};
const key=await crypto.subtle.importKey('jwk',privateJwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,new TextEncoder().encode(canonicalize(unsigned)));
console.log(encodeEnvelope({...unsigned,signature:toBase64Url(new Uint8Array(signature))}));
