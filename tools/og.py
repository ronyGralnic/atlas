#!/usr/bin/env python3
"""Render Open Graph images (1200x630): og/site.png and og/<issue>.png for every issue.
   python3 tools/og.py [--chrome PATH]"""
import argparse, asyncio, json, os, re
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent


async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('--chrome', default=os.environ.get('CHROME', '')); a = ap.parse_args()
    idx = (ROOT / 'data/index.js').read_text(encoding='utf8')
    data = json.loads(re.sub(r'^[\s\S]*?window\.ATLAS_INDEX=', '', idx).rstrip().rstrip(';'))
    jobs = [('', ROOT / 'og/site.png')] + [(i['issue'], ROOT / f"og/{i['issue']}.png") for i in data['issues']]
    (ROOT / 'og').mkdir(exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(**({'executable_path': a.chrome} if a.chrome else {}))
        pg = await b.new_page(viewport={'width': 1200, 'height': 630}, color_scheme='light')
        for issue, out in jobs:
            url = (ROOT / 'templates/og.html').as_uri() + (f'?issue={issue}' if issue else '')
            await pg.goto(url)
            await pg.wait_for_selector('body[data-ready="1"]')
            await pg.wait_for_timeout(200)
            await pg.screenshot(path=str(out))
            print('✓', out.relative_to(ROOT))
        await b.close()

asyncio.run(main())
