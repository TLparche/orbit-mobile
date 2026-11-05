// Copy the existing web's point/edge shaders; keep mobile timing and controls separate.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const work=resolve(process.argv[2]);
const original=await readFile(join(work,'hologram.js'),'utf8');
const shader=name=>{
 const block=original.slice(original.indexOf(`${name}=new THREE.ShaderMaterial`));
 const match=block.match(/vertexShader:`([^`]+)`,\s*fragmentShader:`([^`]+)`/);
 if(!match)throw Error(`Missing ${name} shaders`);return {vertex:match[1],fragment:match[2]};
};
const source='// Verbatim point/edge shader source from the existing ORBIT web.\n'+
 `export const pointShaders=${JSON.stringify(shader('pointMaterial'),null,2)};\n`+
 `export const edgeShaders=${JSON.stringify(shader('lineMaterial'),null,2)};\n`;
await writeFile(fileURLToPath(new URL('../src/legacy-shaders.mjs',import.meta.url)),source);
console.log('Reused existing web point and edge shaders.');
