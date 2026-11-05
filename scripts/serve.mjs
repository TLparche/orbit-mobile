import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist'),port=Number(process.env.PORT||8772);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg','.webp':'image/webp'};
createServer(async(req,res)=>{try{
 let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/orbit-mobile(?=\/|$)/,'');
 let file=resolve(root,'.'+p);if(file!==root&&!file.startsWith(root+sep))throw Error('invalid path');
 if((await stat(file)).isDirectory())file=resolve(file,'index.html');
 const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`ORBIT: http://127.0.0.1:${port}/orbit-mobile/`));
