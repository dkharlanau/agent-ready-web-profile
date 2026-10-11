/** Bounded source extraction, not a rendered DOM or an HTML conformance parser. */
const tags = () => /<!--[\s\S]*?-->|<\/?[a-z][a-z0-9:_-]*\b(?:[^<>"']|"[^"]*"|'[^']*')*>/gi;
const inert = new Set(['script', 'style', 'template', 'svg']);

export function sourceMarkup(value) {
  const html = String(value || ''), re = tags();
  let output = '', last = 0, depth = 0, ignored = null, match;
  while ((match = re.exec(html))) {
    const tag = match[0], name = tag.match(/^<\/?([a-z][a-z0-9:_-]*)/i)?.[1]?.toLowerCase();
    const closing = /^<\//.test(tag);
    if (!depth) output += html.slice(last, match.index);
    if (tag.startsWith('<!--')) { if (!depth) output += ' '; }
    else if ((name === 'script' || name === 'style') && !closing) {
      // This also holds inside a template: fake closing tags in JS are text.
      const end = new RegExp(`</${name}\\s*>`, 'gi'); end.lastIndex = re.lastIndex;
      const found = end.exec(html); re.lastIndex = found ? end.lastIndex : html.length;
      if (!depth) output += ' '; last = re.lastIndex; continue;
    } else if (!depth && inert.has(name) && !closing) {
      if (!/\/\s*>$/.test(tag)) {ignored = name; depth = 1;}
      output += ' ';
    } else if (depth) {
      if (name === ignored) {
        if (closing) depth--;
        else if (!/\/\s*>$/.test(tag)) depth++;
        if (!depth) ignored = null;
      }
    } else output += tag;
    last = re.lastIndex;
  }
  if (!depth) output += html.slice(last);
  return output;
}

export function elementContent(markup, name) {
  const re = tags(), parts = [];
  let depth = 0, start = 0, match;
  while ((match = re.exec(markup))) {
    const tag = match[0];
    if (tag.match(/^<\/?([a-z][a-z0-9:_-]*)/i)?.[1]?.toLowerCase() !== name) continue;
    if (/^<\//.test(tag)) {
      if (depth && --depth === 0) parts.push(markup.slice(start, match.index));
    } else if (!/\/\s*>$/.test(tag)) {
      if (!depth) start = re.lastIndex;
      depth++;
    }
  }
  // An unclosed primary region is still source evidence, not an empty page.
  if (depth) parts.push(markup.slice(start));
  return parts;
}

export function sourceText(markup) {
  return String(markup || '').replace(tags(), ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ').trim();
}

export function primarySourceText(html) {
  const markup = sourceMarkup(html);
  const main = elementContent(markup, 'main'), article = elementContent(markup, 'article');
  const primary = main.length ? main : article;
  const text = sourceText(primary.join(' '));
  if (text || !primary.length) return {text:text || sourceText(markup.replace(/<head\b[\s\S]*?<\/head>/i,'')), scope:main.length?'main':article.length?'article':'document', emptyPrimary:false};
  // Streaming SSR may deliver the completed payload outside the initial main.
  // Do not label that text missing, or claim the fallback is rendered/visible.
  return {text:sourceText(markup.replace(/<head\b[\s\S]*?<\/head>/i,'')), scope:'document_fallback_empty_primary', emptyPrimary:true};
}
