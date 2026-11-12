import {mkdir,readdir,readFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readDemoAssets} from './demo-assets.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const assets=await readDemoAssets();
const manifest=JSON.parse(assets[0].contents.toString());
const build=await readFile(root+'dist/index.html','utf8');
if(!build.includes('type="module"'))throw new Error('Build demonstrativo ausente. Execute npm run demo:package.');
// Confirm this dist was built with this exact snapshot, not the regular app.
const deployed=await readFile(root+'dist/demo/manifest.json');
if(!deployed.equals(assets[0].contents))throw new Error('O build não corresponde à fotografia exportada.');
const identity=createHash('sha256').update(deployed).update(build).digest('hex').slice(0,12);
const directory=root+'.local/apresentacao-'+identity;
await mkdir(directory,{recursive:true});
await cp(root+'dist',directory,{recursive:true});
const config={version:2,framework:null,buildCommand:null,installCommand:null,outputDirectory:'.',cleanUrls:false,
 rewrites:[{source:'/((?!assets/|demo/|favicon.ico).*)',destination:'/index.html'}],
 headers:[{source:'/demo/(.*)',headers:[{key:'Cache-Control',value:'public, max-age=0, must-revalidate'}]},{source:'/(.*)',headers:[{key:'X-Robots-Tag',value:'noindex, nofollow'}]}]};
await writeFile(directory+'/vercel.json',JSON.stringify(config,null,2)+'\n');
// Publish only the frozen application. The CLI can create local credentials,
// build caches and metadata alongside it when the same package is reused.
await writeFile(directory+'/.vercelignore','/*\n!index.html\n!vercel.json\n!assets\n!demo\n');
await writeFile(directory+'/README.txt',`Demonstração TCC. Posição: ${manifest.referenceDate}\n\nPublicar somente esta pasta:\nnpx vercel . --prod\n\nNenhum banco, API, .env ou credencial acompanha este pacote.\nConsulte docs/demonstracao.md no código-fonte.\n`);
// List the final result without exposing connection settings or data records.
console.log('Pacote estático: '+directory);
console.log('Arquivos na raiz: '+(await readdir(directory)).join(', '));
console.log('Na pasta do pacote: npx vercel . --prod');
