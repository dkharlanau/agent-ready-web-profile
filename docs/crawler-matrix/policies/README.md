# Crawler policy examples

These files are implementation examples derived from the dated ARWP crawler matrix. They are not legal advice, ranking guarantees or universal defaults.

- `search-yes-training-no.robots.txt` — allow documented search/indexing crawlers while opting out of documented training-related crawler/product tokens where the provider exposes an independent control.
- `search-and-training-yes.robots.txt` — allow both search/indexing and the documented training-related crawler/product tokens covered by the matrix.

Important limitations:

- user-triggered fetchers can follow different rules from background crawlers;
- provider documentation can change;
- some controls are page-level meta/X-Robots-Tag directives rather than robots.txt user agents;
- content copyright/reuse permission is separate from technical crawler access;
- an `Allow` rule never guarantees indexing, citation or ranking.
