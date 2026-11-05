import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const manifest=JSON.parse(await readFile('scripts/web_assets.json','utf8'));
const digest=b=>createHash('sha256').update(b).digest('hex');
for(const image of manifest.images)for(const spec of [image,image.preview]){
 const bytes=await readFile(`public/${spec.path}`);assert.equal(bytes.length,spec.bytes,spec.path);assert.equal(digest(bytes),spec.sha256,spec.path);
}
const index=await readFile('dist/index.html','utf8');assert(!index.includes('__APP_'));
for(const path of [...index.matchAll(/(?:src|href)="\.\/([^"#]+)"/g)].map(m=>m[1]))assert((await stat(`dist/${path}`)).isFile());
async function files(dir){const found=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${e.name}`;if(e.isDirectory())found.push(...await files(p));else found.push(p);}return found;}
const list=await files('dist');assert(!list.some(p=>/\.mp4$|\.zip$|\/review\/|\/presentation\/|node_modules|\.map$/.test(p)));
console.log(`PASS: ${manifest.images.length*2} image hashes; ${list.length} deploy files; local-only dependencies.`);
