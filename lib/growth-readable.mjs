/**
 * The public Growth CLI's first useful sentence. Technical registry fields,
 * evidence and provenance remain untouched; these are reader actions, not new
 * ranking rules or claims that a crawler alone can verify.
 */
const ACTIONS = Object.freeze({
  'growth:entity-identity': [
    'Open the page that explains who runs this site. Make that identity clear to readers before repeating it in structured data.',
    'Check that the visible name, URL and structured identity agree on the final published page.',
    'Do not invent a founder, a personal byline or external profiles merely to complete a checklist.'
  ],
  'growth:entity-sameas': [
    'Check whether the site has a real, public profile visitors would recognize. Link it only if it belongs to the same publisher.',
    'Open each claimed profile and confirm that it genuinely points back to the same project.',
    'Skip invented, private or unverified external identities.'
  ],
  'growth:article-authorship': [
    'Read one important article as a visitor. Show a truthful author or project editor where that credit helps explain responsibility.',
    'Compare the visible credit with the article metadata and the public author or brand page.',
    'Do not add a personal name that the publisher has chosen not to expose.'
  ],
  'growth:article-dates': [
    'Check whether the shown publication and update dates match real changes to the article.',
    'Compare the page, metadata and published revision history.',
    'A new deploy or automated build is not necessarily a meaningful editorial update.'
  ],
  'growth:multiformat': [
    'Choose one page where a real screenshot, diagram or demonstration would explain something words cannot.',
    'Check image rights, useful alt text, readable context and the actual published asset.',
    'Do nothing if a decorative picture would make the page less useful.'
  ],
  'growth:faq-deprecation': [
    'Keep useful questions for readers, but stop treating FAQ markup as an available Google rich-result promotion.',
    'Review the current page and any remaining structured data against what is genuinely visible.',
    'Do not delete helpful prose merely because a search feature was retired.'
  ],
  'growth:non-commodity-review': [
    'Pick one priority page. Ask what someone can understand, decide or try here that a generic summary would not provide.',
    'Verify one original example, relevant fact and concrete next action with the editor or subject owner.',
    'Do not invent experiments, user stories or first-hand experience to make the page look original.'
  ],
  'growth:site-reputation-policy': [
    'Check whether guest, partner or sponsored material fits the reason people come to this site.',
    'Review its ownership, editorial independence, real value and visible disclosures.',
    'Do not label genuine partnerships abusive without evidence or use borrowed site reputation as a growth tactic.'
  ],
  'growth:preferred-source-acquisition': [
    'First check whether readers can actually select this domain as a preferred source. Only then consider a small optional link.',
    'Try the official selection flow on a supported device and confirm it preserves the visitor journey.',
    'Skip unqualified subdirectory sites, unsupported regions and buttons that cannot complete the action.'
  ],
  'growth:cloudflare-content-signals': [
    'Ask the publisher which kinds of crawling and reuse they permit before changing any policy.',
    'Compare the declared policy with what a compatible consumer actually honors.',
    'Never relax usage rights solely to chase hypothetical AI-search traffic.'
  ]
});

export function readableGrowthAction(item) {
  if (!item || !item.id || !item.title) throw new Error('A complete growth action is required.');
  const mapped = ACTIONS[item.id];
  if (mapped) return { firstStep: mapped[0], verify: mapped[1], hold: mapped[2] };

  if (item.status === 'external-owner-data' || item.lane === 'measurement') {
    return {
      firstStep: 'Check whether the site owner can provide the actual report for the same pages and dates before drawing a conclusion.',
      verify: 'Record the report scope, dates and unavailable fields; keep different providers separate.',
      hold: 'If owner access is missing, report unknown rather than zero or a claimed improvement.'
    };
  }
  if (item.id.startsWith('audit:')) {
    return {
      firstStep: 'Open the affected public page and verify that the reported problem still exists in the published version.',
      verify: 'Re-run the specific check on the final response after a bounded repair.',
      hold: 'If the bounded audit was inconclusive, investigate before editing the site.'
    };
  }
  return {
    firstStep: 'Confirm this change serves a real reader problem on a specific published page before implementing it.',
    verify: 'Check the exact source and published change, then use comparable owner observations if available.',
    hold: 'Skip when the target capability, audience need or source evidence is not established.'
  };
}

export function formatGrowthActionForReader(item) {
  const advice = readableGrowthAction(item);
  const lines = [
    '- ' + item.title,
    '  Start here: ' + advice.firstStep,
    '  Check it: ' + advice.verify,
    '  When not to do it: ' + advice.hold
  ];
  if (item.status === 'external-owner-data') lines.push('  Evidence: owner report required; not observed by this public audit.');
  else if (item.status === 'manual') lines.push('  Evidence: editorial review required; crawler data is not a human sign-off.');
  if (item.reason) lines.push('  Why this came up: ' + item.reason);
  if (item.implementation?.file) lines.push('  Technical file: ' + item.implementation.file);
  if (item.implementation?.url) lines.push('  Reference link: ' + item.implementation.url);
  if (item.source) lines.push('  Source: ' + item.source);
  return lines.join('\n');
}
