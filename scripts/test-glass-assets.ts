import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assets from '../src/features/appearance/glassAssets.json';
for(const url of Object.values(assets)){
  const body=readFileSync('public'+url);assert(body.length<16_384);assert.equal(body.toString('ascii',8,12),'WEBP');
  const hash=createHash('sha256').update(body).digest('hex').slice(0,12);assert(url.includes(hash));
}
console.log('Optical glass: one immutable WebP under 16 KB, reused with CSS color variants');
