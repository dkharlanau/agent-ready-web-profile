#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { compileSeoGeoExecution } from '../lib/search-geo-execution.mjs';
const args=process.argv.slice(2);
const option=name=>args.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)||null;
if(args.includes('--help')||!args.length){
  console.log('Goose Search/GEO implementation decision planner (34 research opportunities; no ranking score)');
  console.log('  arwp-geo-plan --context=OWNER-FACTS.json [--json] [--output=PRIVATE-PLAN.json]');
  console.log('Facts must be explicit boolean or null. Missing is unknown. No target mutation, program approval or provider report is inferred.');
}else{
  try{
    const input=option('context');if(!input)throw Error('--context=OWNER-FACTS.json is required.');
    const context=JSON.parse(fs.readFileSync(path.resolve(input),'utf8'));
    const result=compileSeoGeoExecution(context);
    const target=option('output');
    if(target){
      const file=path.resolve(target);
      if(fs.existsSync(file))throw Error('Refusing to overwrite an existing owner decision plan.');
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');
    }
    if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
    else{
      console.log('Goose SEO/GEO next actions for '+result.site);
      console.log('34 candidate decisions, never automatic changes or a rank score.');
      for(const group of ['P0','P1','P2']){
        console.log(group);
        for(const row of result.opportunities.filter(x=>x.priority===group)){
          console.log('- '+row.title);
          console.log('  State: '+row.executionState+' — '+row.reason);
          console.log('  Next: '+row.firstStep);
          console.log('  Do not: '+row.stop);
        }
      }
      if(target)console.log('WROTE '+path.resolve(target));
    }
  }catch(e){console.error('ERROR '+(e?.message||String(e)));process.exitCode=2;}
}
