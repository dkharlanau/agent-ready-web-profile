# no-bonihua-trends (ARWP)

Эта папка хранит экспорт статы по портфелю без строк Bonihua:
- отдельный агрегат для `Bonihua.com` (если он есть),
- без отдельных строк `bonihua.ru` и `bonihua.by` для чтения,
- плюс отдельная строка `Metalhatscats` (через `sc-domain:metalhatscats.com`).

## Что лежит в папке

- [seo-no-bonihua-trends.artifact.json](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/no-bonihua-trends/seo-no-bonihua-trends.artifact.json)
- [seo-no-bonihua-trends.csv](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/no-bonihua-trends/seo-no-bonihua-trends.csv)
- [seo-no-bonihua-trends.md](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/no-bonihua-trends/seo-no-bonihua-trends.md)
- [build-no-bonihua-trends.mjs](/Users/dzmitryikharlanau/Documents/ChatGPT/SEO/output/arwp/no-bonihua-trends/build-no-bonihua-trends.mjs)

## Как обновлять

Запустите:

```sh
node output/arwp/no-bonihua-trends/build-no-bonihua-trends.mjs
```

Скрипт пересобирает все файлы выше из текущего `gsc-2026-09-05.json` и `seo-project-registry.json`.
