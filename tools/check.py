#!/usr/bin/env python3
"""
Atlas pre-delivery check (FACTORY §6).
  python3 tools/check.py [--shots DIR] [--chrome PATH]

Runs every page at 1280 and 390, light and dark, over file:// and over a local HTTP server.
Fails (exit 1) on: console errors, page errors, failed requests, horizontal scroll,
a pin that is missing / not on its country / does not open, broken filters, timeline or patterns.
"""
import argparse, asyncio, functools, http.server, json, os, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=str(ROOT))
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/'


class Run:
    def __init__(self, label):
        self.label, self.fail, self.ok = label, [], 0

    def check(self, cond, msg):
        if cond: self.ok += 1
        else: self.fail.append(msg)


async def wire(page, run):
    page.on('console', lambda m: run.fail.append(f'console {m.type}: {m.text}') if m.type == 'error' else None)
    page.on('pageerror', lambda e: run.fail.append(f'pageerror: {e}'))
    page.on('requestfailed', lambda r: run.fail.append(f'request failed: {r.url} {r.failure}'))


async def no_hscroll(page, run, where):
    sw = await page.evaluate('[document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    run.check(sw[0] <= sw[1], f'{where}: horizontal scroll {sw[0]} > {sw[1]}')


async def check_index(page, base, run, width, shots, tag):
    await page.goto(base + 'index.html')
    await page.wait_for_function('window.ATLAS_PINS && document.querySelectorAll(".pcard").length > 0')
    await page.wait_for_timeout(400)
    await no_hscroll(page, run, 'index')
    if shots: await page.screenshot(path=f'{shots}/{tag}-index.png')
    data = await page.evaluate('''() => {
      const pins = Atlas.allPins();
      return { n: pins.length, ids: pins.map(p => p.id), iso: Object.fromEntries(pins.map(p => [p.id, p.place.iso_n3])) };
    }''')
    n = data['n']
    run.check(n > 0, 'no pins loaded')
    run.check(await page.locator('.pcard').count() == n, 'list does not show every pin')
    # every pin is on the map (alone or in a cluster)
    on_map = await page.evaluate('''() => {
      const ids = new Set();
      document.querySelectorAll('#map g.node').forEach(g => { const d = g.__data__; (d.type === 'pin' ? [d.pin] : d.pins).forEach(p => ids.add(p.id)); });
      return [...ids];
    }''')
    run.check(set(on_map) == set(data['ids']), f'pins missing from map: {set(data["ids"]) - set(on_map)}')
    # placement: zoom right in on each pin and confirm the country under it (elementsFromPoint)
    if width >= 1000:
        wrong = await page.evaluate('''() => {
          const bad = [];
          for (const p of Atlas.allPins()) {
            const [x, y] = Atlas.mapFocus(p.id, 14);
            const hit = document.elementsFromPoint(x, y).find(e => e.classList && e.classList.contains('map-land'));
            if (!hit || hit.__data__.id !== p.place.iso_n3) bad.push(p.id + ' under ' + (hit ? hit.__data__.properties.name : 'sea'));
          }
          Atlas.mapFocus(Atlas.allPins()[0].id, 1);
          return bad;
        }''')
        await page.click('#z-reset'); await page.wait_for_timeout(450)
        # tiny islands/coastal points can be covered by a neighbouring path at screen resolution: report, verified again by build pip
        run.check(not wrong, f'pins not on their country on screen: {wrong}')
    # open every pin from the list -> drawer shows that pin
    opened = 0
    for pid in data['ids']:
        await page.evaluate(f'document.querySelector(\'[data-open-pin="{pid}"]\').click()')
        await page.wait_for_timeout(30)
        t = await page.evaluate('document.querySelector("#drawer.is-open .card")?.id')
        if t == f'pin-{pid}': opened += 1
        else: run.fail.append(f'pin {pid} did not open (got {t})')
    run.check(opened == n, f'opened {opened}/{n}')
    await page.keyboard.press('Escape')
    await page.wait_for_timeout(300)
    run.check(not await page.evaluate('document.querySelector("#drawer").classList.contains("is-open")'), 'Escape did not close drawer')
    # click real map pins (desktop): each single pin element opens its card
    if width >= 1000:
        await page.evaluate('Atlas.mapReset()')
        nodes = await page.locator('#map g.pin').count()
        for i in range(nodes):
            await page.evaluate('Atlas.mapReset()')
            g = page.locator('#map g.pin').nth(i)
            pid = await g.get_attribute('data-id')
            await g.click()
            await page.wait_for_timeout(60)
            t = await page.evaluate('document.querySelector("#drawer.is-open .card")?.id')
            run.check(t == f'pin-{pid}', f'map click on {pid} opened {t}')
            await page.keyboard.press('Escape')
        # cluster click zooms in (or lists coincident pins)
        await page.evaluate('Atlas.mapReset()')
        if await page.locator('#map g.cluster').count():
            before = await page.locator('#map g.node').count()
            await page.locator('#map g.cluster').first.click()
            await page.wait_for_timeout(700)
            after = await page.locator('#map g.node').count()
            listed = await page.evaluate('!!document.querySelector("#drawer.is-open .cluster-list")')
            run.check(after != before or listed, 'cluster click did nothing')
            await page.keyboard.press('Escape')
            await page.click('#z-reset'); await page.wait_for_timeout(500)
        # zoom +/- buttons
        await page.click('#z-in'); await page.wait_for_timeout(400)
        k = await page.evaluate('getComputedStyle(document.querySelector(".map-landg")).transform')
        run.check(k != 'none', 'zoom button did nothing')
        await page.click('#z-reset'); await page.wait_for_timeout(450)
    # deep link + open pin screenshot
    await page.goto(base + 'index.html#pin=' + data['ids'][-1])
    await page.wait_for_selector('#drawer.is-open .card')
    await page.wait_for_timeout(350)
    await no_hscroll(page, run, 'index+drawer')
    if shots: await page.screenshot(path=f'{shots}/{tag}-drawer.png')
    # term window
    term = page.locator('#drawer .term').first
    if await term.count():
        await term.click()
        run.check(await page.locator('#term-pop:not([hidden])').count() == 1, 'term window did not open')
        if shots: await page.screenshot(path=f'{shots}/{tag}-term.png')
        await page.keyboard.press('Escape')
    await page.keyboard.press('Escape')
    await page.wait_for_timeout(300)

    # ---- filters ----
    async def visible_count():
        return await page.locator('.pcard').count()
    if width < 861:
        await page.click('#filters-toggle'); await page.wait_for_timeout(300)
        if shots: await page.screenshot(path=f'{shots}/{tag}-filters.png')
    await page.locator('#f-tags .chip[data-tag="אנרגיה"]').click()
    c = await visible_count()
    exp = await page.evaluate('Atlas.allPins().filter(p => p.tags.includes("אנרגיה")).length')
    run.check(c == exp, f'tag filter: {c} != {exp}')
    await page.click('#f-reset')
    await page.locator('#f-prio .chip[data-prio="A"]').click()
    exp = await page.evaluate('Atlas.allPins().filter(p => p.priority === "A").length')
    run.check(await visible_count() == exp, 'priority filter')
    await page.click('#f-reset')
    await page.locator('#f-mode button[data-mode="indirect"]').click()
    exp = await page.evaluate('Atlas.allPins().filter(p => p.indirect).length')
    run.check(await visible_count() == exp, 'indirect filter')
    await page.click('#f-reset')
    await page.check('#f-diff')
    exp = await page.evaluate('Atlas.allPins().filter(p => p.diff_candidate).length')
    run.check(await visible_count() == exp, 'DIFF filter')
    await page.click('#f-reset')
    area = await page.evaluate('document.querySelectorAll("#f-area option")[1].value')
    await page.select_option('#f-area', area)
    exp = await page.evaluate(f'Atlas.allPins().filter(p => p.place.area === {json.dumps(area)}).length')
    run.check(await visible_count() == exp, 'area filter')
    await page.click('#f-reset')
    iss = await page.evaluate('document.querySelectorAll("#f-issue option")[1].value')
    await page.select_option('#f-issue', iss)
    exp = await page.evaluate(f'Atlas.allPins().filter(p => p.issue_date === {json.dumps(iss)}).length')
    run.check(await visible_count() == exp, 'issue filter')
    await page.click('#f-reset')
    await page.fill('#f-q', 'זימבבואה')
    run.check(await visible_count() >= 1, 'search found nothing for זימבבואה')
    await page.fill('#f-q', 'ללא-תוצאה-בכלל')
    run.check(await page.locator('.list-empty').count() == 1, 'empty state missing')
    await page.click('#f-reset')
    run.check(await visible_count() == n, 'reset did not restore all pins')
    if width < 861:
        await page.keyboard.press('Escape'); await page.wait_for_timeout(300)

    # ---- timeline ----
    await page.evaluate('document.querySelector("#tl-range").value = 0; document.querySelector("#tl-range").dispatchEvent(new Event("input"))')
    run.check(await page.locator('#map g.node').count() == 0, 'timeline 0 still shows pins')
    await page.click('#tl-play')
    await page.wait_for_timeout(2200)
    run.check(await page.locator('#map g.node').count() > 0, 'PLAY did not bring pins back')
    run.check(await page.evaluate('document.querySelector("#tl-play").getAttribute("aria-pressed")') == 'false', 'PLAY did not stop at the end')

    # ---- patterns ----
    pats = await page.locator('.pattern').count()
    run.check(pats == await page.evaluate('ATLAS_INDEX.patterns.length'), 'pattern cards missing')
    if pats:
        await page.locator('.pattern').first.click()
        await page.wait_for_timeout(800)
        dims = await page.locator('.pcard.is-dim').count()
        members = await page.evaluate('ATLAS_INDEX.patterns[0].members.length')
        run.check(dims == n - members, f'pattern highlight: {dims} dimmed, expected {n - members}')
        run.check(await page.locator('#pattern-banner:not([hidden])').count() == 1, 'pattern banner hidden')
        if shots: await page.screenshot(path=f'{shots}/{tag}-pattern.png')
        await page.click('#pattern-clear')
        run.check(await page.locator('.pcard.is-dim').count() == 0, 'pattern did not clear')
    # list view tab (desktop)
    if width >= 861:
        await page.click('#view-tabs button[data-view="list"]')
        run.check(await page.locator('#list').is_visible() and not await page.locator('#mapbox').is_visible(), 'list tab')
        if shots: await page.screenshot(path=f'{shots}/{tag}-list.png')
        await page.click('#view-tabs button[data-view="map"]')
        run.check(await page.locator('#mapbox').is_visible(), 'map tab')
    if shots: await page.screenshot(path=f'{shots}/{tag}-index-full.png', full_page=True)
    await no_hscroll(page, run, 'index end')


async def check_issue(page, base, run, shots, tag):
    issues = await page.evaluate('ATLAS_INDEX.issues.map(i => [i.issue, i.count])')
    for iss, count in issues:
        await page.goto(f'{base}issue/{iss}.html')
        await page.wait_for_selector('.issue-cards .card')
        run.check(await page.locator('.issue-cards .card').count() == count, f'issue {iss}: cards != {count}')
        await no_hscroll(page, run, f'issue {iss}')
        if shots: await page.screenshot(path=f'{shots}/{tag}-issue-{iss}.png', full_page=False)


async def check_about(page, base, run, shots, tag):
    await page.goto(base + 'about.html')
    await page.wait_for_selector('main h1')
    await no_hscroll(page, run, 'about')
    if shots: await page.screenshot(path=f'{shots}/{tag}-about.png', full_page=False)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='')
    ap.add_argument('--chrome', default=os.environ.get('CHROME', ''))
    a = ap.parse_args()
    if a.shots: os.makedirs(a.shots, exist_ok=True)
    srv, http_base = serve()
    file_base = ROOT.as_uri() + '/'
    runs = []
    async with async_playwright() as p:
        kw = {'executable_path': a.chrome} if a.chrome else {}
        browser = await p.chromium.launch(**kw)
        for proto, base in (('file', file_base), ('http', http_base)):
            for width, height in ((1280, 900), (390, 844)):
                for scheme in ('light', 'dark'):
                    tag = f'{proto}-{width}-{scheme}'
                    run = Run(tag)
                    ctx = await browser.new_context(viewport={'width': width, 'height': height}, color_scheme=scheme,
                                                    has_touch=width < 500, is_mobile=width < 500)
                    page = await ctx.new_page()
                    await wire(page, run)
                    shots = a.shots if (a.shots and (proto == 'file' or width == 1280)) else ''
                    try:
                        await check_index(page, base, run, width, shots, tag)
                        await check_issue(page, base, run, shots, tag)
                        await check_about(page, base, run, shots, tag)
                    except Exception as e:
                        run.fail.append(f'exception: {e!r}')
                    await ctx.close()
                    runs.append(run)
                    print(f"{'✓' if not run.fail else '✗'} {tag}: {run.ok} checks passed" + (f', {len(run.fail)} failed' if run.fail else ''))
                    for f in run.fail[:12]: print('    ' + f)
        await browser.close()
    srv.shutdown()
    bad = [r for r in runs if r.fail]
    print(f"\n{'ALL CLEAR' if not bad else 'FAILURES'}: {sum(r.ok for r in runs)} checks, {len(runs)} configurations")
    sys.exit(1 if bad else 0)

asyncio.run(main())
