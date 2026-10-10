#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { reviewVideoObject, reviewStableCommerceFeed } from '../lib/qualified-feature-preflight.mjs';
const args=process.argv.slice(2);
const option=name=>args.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)||null;
if(args.includes('--help')||!args.length){
  console.log('Goose conditional media and commerce owner preflight (read-only)');
  console.log('  arwp-qualified-review --kind=video --input=PRIVATE-OWNER-VIDEO.json [--json] [--output=PRIVATE-REVIEW.json]');
  console.log('  arwp-qualified-review --kind=commerce --input=PRIVATE-ACP-STABLE.json [--json] [--output=PRIVATE-REVIEW.json]');
  console.log('No account login, upload, website mutation, ranking promise or implied provider approval.');
}else{
  try{
    const kind=option('kind'),file=option('input');
    if(!file||!['video','commerce'].includes(kind))throw Error('--kind=video|commerce and --input=PRIVATE.json are required.');
    const data=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));
    const report=kind==='video'?reviewVideoObject(data):reviewStableCommerceFeed(data);
    const output=option('output');
    if(output){
      const target=path.resolve(output);
      if(fs.existsSync(target))throw Error('Refusing to overwrite an existing owner preflight report.');
      fs.mkdirSync(path.dirname(target),{recursive:true});
      fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
    }
    if(args.includes('--json'))console.log(JSON.stringify(report,null,2));
    else{
      console.log('Goose '+report.kind+': '+report.state);
      for(const problem of report.problems||report.issues||[])console.log('FIX '+problem.code+': '+problem.reason);
      for(const watch of report.watch||[])console.log('REVIEW '+watch);
      console.log('This is a source preflight only, never provider eligibility or user outcome proof.');
      if(output)console.log('WROTE '+path.resolve(output));
    }
    if(report.state==='needs-correction')process.exitCode=1;
  }catch(e){console.error('ERROR '+(e?.message||String(e)));process.exitCode=2;}
}
