import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'docs', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const marker = 'id="arwp-growth-entity-identity"';

if (html.includes(marker)) {
  console.log('Homepage Growth entity identity already present.');
  process.exit(0);
}

const block = `  <link rel="describedby" type="application/ld+json" href="./ai/product.jsonld">\n  <link rel="describedby" type="application/json" href="./growth/profile.json">\n  <script type="application/ld+json" id="arwp-growth-entity-identity">\n  {\n    "@context": "https://schema.org",\n    "@graph": [\n      {\n        "@id": "https://dkharlanau.github.io/agent-ready-web-profile/#maintainer",\n        "@type": "Person",\n        "name": "Dzmitryi Kharlanau",\n        "url": "https://github.com/dkharlanau",\n        "sameAs": ["https://github.com/dkharlanau"]\n      },\n      {\n        "@id": "https://dkharlanau.github.io/agent-ready-web-profile/#software",\n        "@type": ["SoftwareApplication", "WebApplication"],\n        "name": "Agent-Ready Web Profile",\n        "alternateName": "ARWP",\n        "url": "https://dkharlanau.github.io/agent-ready-web-profile/",\n        "description": "Evidence-backed agentic web interoperability resolver, scanner, Growth Profile and conformance tooling for discovering, improving and verifying website interfaces.",\n        "applicationCategory": "DeveloperApplication",\n        "applicationSubCategory": "Agentic Web Interoperability Resolver",\n        "softwareVersion": "0.2.0",\n        "isAccessibleForFree": true,\n        "license": "https://www.apache.org/licenses/LICENSE-2.0",\n        "maintainer": {"@id": "https://dkharlanau.github.io/agent-ready-web-profile/#maintainer"},\n        "sameAs": ["https://github.com/dkharlanau/agent-ready-web-profile"]\n      },\n      {\n        "@id": "https://dkharlanau.github.io/agent-ready-web-profile/#website",\n        "@type": "WebSite",\n        "name": "Agent-Ready Web Profile",\n        "alternateName": "ARWP",\n        "url": "https://dkharlanau.github.io/agent-ready-web-profile/",\n        "about": {"@id": "https://dkharlanau.github.io/agent-ready-web-profile/#software"},\n        "publisher": {"@id": "https://dkharlanau.github.io/agent-ready-web-profile/#maintainer"}\n      }\n    ]\n  }\n  </script>\n`;

if (!html.includes('</head>')) throw new Error('docs/index.html has no closing head tag.');
html = html.replace('</head>', `${block}</head>`);
fs.writeFileSync(file, html, 'utf8');
console.log('Inserted canonical homepage Person + SoftwareApplication + WebSite identity metadata.');
