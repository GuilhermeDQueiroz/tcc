import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const directory=fileURLToPath(new URL('../.local/demo/',import.meta.url));
export async function readDemoAssets(){
 let raw;try{raw=await readFile(directory+'manifest.json');}catch{throw new Error('Demonstração não exportada. Prepare o PostgreSQL e execute npm run demo:export.');}
 const manifest=JSON.parse(raw);
 if(manifest.schema!==1||manifest.synthetic!==false||manifest.source!=='firebird/apache-hop'||!/^\d{4}-\d{2}-\d{2}$/.test(manifest.referenceDate))throw new Error('Manifesto demonstrativo inválido.');
 const assets=[{file:'manifest.json',contents:raw}];
 for(const asset of Object.values(manifest.assets)){
  if(!/^[a-z0-9-]+\.json\.gz$/.test(asset.file))throw new Error('Nome de arquivo demonstrativo inválido.');
  const contents=await readFile(directory+asset.file);
  if(createHash('sha256').update(contents).digest('hex')!==asset.sha256)throw new Error('Integridade da demonstração divergente. Exporte novamente.');
  assets.push({file:asset.file,contents});
 }
 return assets;
}
export function demoAssetsPlugin(mode){
 let assets;
 return {name:'frozen-demo-assets',
  async buildStart(){if(mode==='demo')assets=await readDemoAssets();},
  async configureServer(server){if(mode!=='demo')return;assets=await readDemoAssets();
   server.middlewares.use('/demo/',(req,res,next)=>{
    const asset=assets.find(asset=>asset.file===req.url?.split('?')[0].replace(/^\//,''));
    if(!asset){res.statusCode=404;res.end('Recurso demonstrativo ausente.');return;}
    res.setHeader('Content-Type',asset.file.endsWith('.gz')?'application/gzip':'application/json');
    res.end(asset.contents);
   });
  },
  generateBundle(){if(mode==='demo')for(const asset of assets)this.emitFile({type:'asset',fileName:'demo/'+asset.file,source:asset.contents});},
 };
}
