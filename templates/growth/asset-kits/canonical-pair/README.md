# Reproduce a project-prefix canonical error

Kit 1.0.0. All URLs and HTML are synthetic. Python 3, standard library only.

Run `python3 check.py` from this directory (or pass its full path). The script deliberately confirms that the before fixture fails its exact one-canonical contract and the after fixture passes. It has no network access or site mutation. It is an executable explanation, not a general SEO scanner or a Jekyll build test.

For a real site, first establish the intended URL and whether the page is actually a duplicate. Inspect Jekyll `url`/`baseurl` and the template, rebuild with the real project command, then examine the emitted canonical and live response. Do not copy the fixtures' noindex or example.com URLs into production. Do not automatically replace all canonicals with the current request URL.

The kit demonstrates a declared-URL mismatch, not its cause in a particular repository, a Google-selected canonical or a ranking loss. Pair real evidence with the existing Growth adoption record.

Source: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
