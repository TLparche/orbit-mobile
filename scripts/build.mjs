import {build} from 'esbuild';
import {mkdir,cp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve('.'),dist=resolve('dist');
if(dist!==join(root,'dist'))throw Error('Invalid build target');
// Only this app's disposable build directory is replaced.
await rm(dist,{recursive:true,force:true});await mkdir(dist,{recursive:true});
for(const name of ['data','fonts','licenses','image-assets','image-previews','favicon.svg'])await cp(`public/${name}`,`${dist}/${name}`,{recursive:true});
const result=await build({entryPoints:['src/app.js'],bundle:true,format:'esm',splitting:true,minify:true,
 target:['es2020'],outdir:'dist/assets',entryNames:'[name]-[hash]',chunkNames:'[name]-[hash]',loader:{'.woff2':'file'},metafile:true,legalComments:'eof'});
const entry=Object.entries(result.metafile.outputs).find(([,v])=>v.entryPoint==='src/app.js');
const js=entry[0].replace('dist/',''),css=entry[1].cssBundle.replace('dist/','');
const html=(await readFile('public/index.html','utf8')).replace('__APP_JS__',js).replace('__APP_CSS__',css);
await writeFile('dist/index.html',html);await writeFile('dist/.nojekyll','');
console.log(`Built ${js}; ${await readdir('dist/data').then(x=>x.length)} data files.`);
