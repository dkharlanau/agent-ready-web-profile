#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { reviewBingContext, compareBingContext } from '../lib/bing-context-evidence.mjs';

const args=process.argv.slice(2);
const command=args[0];
const option=name=>args.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3)||null;
const read=filepath=>JSON.parse(fs.readFileSync(path.resolve(filepath),'utf8'));
const required=name=>{const v=option(name);if(!v)throw Error('Required --'+name+'=PRIVATE-FILE');return v;};
const write=result=>{const target=option('output');if(!target)return null;
  const full=path.resolve(target);
  if(fs.existsSync(full))throw Error('Refusing to overwrite existing private Bing evidence review.');
  fs.mkdirSync(path.dirname(full),{recursive:true});
  fs.writeFileSync(full,JSON.stringify(result,null,2)+'\n');return full;};
if(!command||args.includes('--help')){
  console.log('Goose Bing AI owner evidence (read-only, local files)');
  console.log('  arwp-bing inspect --input=PRIVATE-NORMALIZED-BING.json [--json] [--output=PRIVATE-REVIEW.json]');
  console.log('  arwp-bing compare --before=PRIVATE-REVIEW.json --after=PRIVATE-REVIEW.json [--json] [--output=PRIVATE-COMPARISON.json]');
  console.log('Requires owner-normalized query/page IDs with filters; raw exports stay private. Never infers exact prompts, rankings, clicks, traffic or causality.');
}else{
  try{
    const result=command==='inspect'?reviewBingContext(read(required('input')))
      :command==='compare'?compareBingContext(read(required('before')),read(required('after')))
      :null;
    if(!result)throw Error('Unknown command: '+command);
    const saved=write(result);
    if(args.includes('--json'))console.log(JSON.stringify(result,null,2));
    else{
      console.log('Goose '+result.kind);
      console.log('Site: '+result.site);
      if(result.kind==='bing-ai-owner-context-review'){
        console.log('Owner period: '+result.period.start+' — '+result.period.end+', state: '+result.state);
        console.log('Registered private query IDs: '+result.queriesRegistered+'; pages: '+result.pagesRegistered);
        console.log('Provider preview context rows: '+result.context.length);
        console.log('Query-filtered projections: '+result.filteredProjections['query-to-page'].length);
        console.log('Page-filtered projections: '+result.filteredProjections['page-to-query'].length);
      }else{
        console.log('Matched stable owner query IDs: '+result.matchedQueryIds);
        console.log('Missing in before / after: '+result.missingBeforeQueryIds.length+' / '+result.missingAfterQueryIds.length);
      }
      console.log('No ranking, traffic, causal, user or sitewide Citation Share score.');
      if(saved)console.log('WROTE '+saved);
    }
  }catch(e){console.error('ERROR '+(e?.message||String(e)));process.exitCode=2;}
}
