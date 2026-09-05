#!/usr/bin/env node

import {
  buildIndexNowPayload,
  publicIndexNowPayload,
  readIndexNowUrls,
  submitIndexNow
} from '../lib/indexnow.mjs';

function usage() {
  console.log(`ARWP IndexNow helper

Usage:
  arwp-indexnow payload <https://site.example/> --urls-file=<urls.txt|urls.json> [--key-location=<https://...>] [--json]
  arwp-indexnow submit <https://site.example/> --urls-file=<urls.txt|urls.json> --endpoint=<https://search-engine/indexnow> [--key-location=<https://...>] [--json]

Set INDEXNOW_KEY in the environment. The CLI never prints the key. A successful submission receipt means only that the endpoint received/accepted the request; it does not guarantee crawling, indexing or ranking.`);
}

const args = process.argv.slice(2);
const command = args[0];
const site = args[1];
const jsonOutput = args.includes('--json');

function optionValue(name) {
  const prefix = `--${name}=`;
  const inline = args.find(arg => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith('--')) return args[index + 1];
  return null;
}

async function main() {
  if (!command || command === '--help' || command === '-h') {
    usage();
    return 0;
  }
  if (!['payload', 'submit'].includes(command) || !site) {
    usage();
    return 2;
  }
  const urlsFile = optionValue('urls-file');
  if (!urlsFile) throw new Error('--urls-file is required.');
  const key = process.env.INDEXNOW_KEY;
  if (!key) throw new Error('INDEXNOW_KEY environment variable is required.');
  const payload = buildIndexNowPayload(site, {
    key,
    keyLocation: optionValue('key-location') || undefined,
    urls: readIndexNowUrls(urlsFile)
  });

  if (command === 'payload') {
    const safe = publicIndexNowPayload(payload);
    if (jsonOutput) console.log(JSON.stringify(safe, null, 2));
    else {
      console.log(`IndexNow payload valid for ${safe.host}`);
      console.log(`URLs: ${safe.urlCount}`);
      console.log(`Key location: ${safe.keyLocation}`);
      for (const url of safe.urlList) console.log(url);
    }
    return 0;
  }

  const endpoint = optionValue('endpoint');
  if (!endpoint) throw new Error('--endpoint is required for submit.');
  const result = await submitIndexNow(payload, endpoint);
  if (jsonOutput) console.log(JSON.stringify(result, null, 2));
  else console.log(`${result.accepted ? 'ACCEPTED' : 'REJECTED'} HTTP ${result.status} ${result.endpoint} — ${result.urlCount} URL(s). ${result.note}`);
  return result.accepted ? 0 : 1;
}

try {
  process.exit(await main());
} catch (error) {
  if (jsonOutput) console.log(JSON.stringify({ accepted: false, fatal: String(error.message ?? error) }, null, 2));
  else console.error(`ERROR ${error.message ?? error}`);
  process.exit(2);
}
