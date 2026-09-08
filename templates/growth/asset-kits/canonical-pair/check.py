"""Reproduce one synthetic canonical-prefix regression; not a website crawler."""
from html.parser import HTMLParser
from pathlib import Path

class CanonicalParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.canonicals = []

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag == 'link' and 'canonical' in (values.get('rel') or '').lower().split():
            self.canonicals.append(values.get('href'))


def matches(html, expected):
    parser = CanonicalParser()
    parser.feed(html)
    return parser.canonicals == [expected]

if __name__ == '__main__':
    root = Path(__file__).resolve().parent
    expected = 'https://example.com/project/guide/'
    before = matches((root / 'before.html').read_text(), expected)
    after = matches((root / 'after.html').read_text(), expected)
    if before or not after:
        raise SystemExit('Fixture regression: expected before=False, after=True')
    print('Synthetic fixture: before=False; after=True. No live or indexing check performed.')
