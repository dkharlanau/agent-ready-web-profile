#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { reviewEditorialParity } from '../lib/editorial-parity.mjs';

const args=process.argv.slice(2);
const option=name=>args.find(a=>a.startsWith('--'+name+'='))?.slice(name.length+3);
if(args.includes('--help')||!args.length){
  console.log('Goose editorial preflight: node bin/arwp-editorial.mjs --html=BUILT-PAGE.html --contract=OWNER-CLAIMS.json [--json] [--output=PRIVATE-REVIEW.json]');
  console.log('Uses local files only. The owner contract is not proof that its statements are true; follow human rights/editorial review. No live Search or AI-writing score.');
}else{
  try{
    const htmlPath=option('html'),contractPath=option('contract');
    if(!htmlPath||!contractPath)throw Error('Both --html and --contract are required.');
    const html=fs.readFileSync(path.resolve(htmlPath),'utf8');
    const contract=JSON.parse(fs.readFileSync(path.resolve(contractPath),'utf8'));
    const result=reviewEditorialParity({html,contract});
    const output=option('output');
    if(output){
      const absolute=path.resolve(output);
      if(fs.existsSync(absolute))throw Error('Refusing to overwrite existing editorial review.');
      fs.mkdirSync(path.dirname(absolute),{recursive:true});
      fs.writeFileSync(absolute,JSON.stringify(result,null,2)+'\n');
    }
    if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
    else{
      console.log('Goose editorial/metadata preflight: '+result.state+' for '+result.canonicalUrl);
      for(const row of result.fail)console.log('FAIL '+row.id+': '+row.why);
      for(const row of result.review)console.log('REVIEW '+row.id+': '+row.why);
      console.log('Human source/right-to-publish review is still required. No search benefit proven.');
      if(output)console.log('WROTE '+path.resolve(output));
    }
    if(result.fail.length)process.exitCode=1;
  }catch(error){console.error('ERROR '+(error?.message||String(error)));process.exitCode=2;}
}
