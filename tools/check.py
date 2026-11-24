#!/usr/bin/env python3
"""
Atlas pre-delivery check (FACTORY §6).
  python3 tools/check.py [--shots DIR] [--chrome PATH] [--only file-1280]

Every page at 1280 and 390, light and dark, over file:// and over a local HTTP server.
Fails (exit 1) on: console errors, page errors, failed requests, horizontal scroll, a pin that is missing /
not on its country / does not open, a broken flag, filter, timeline, pattern, dialog, ticker or globe control.
"""
import argparse, asyncio, functools, http.server, json, os, sys, threading
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent


def serve():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv, f'http://127.0.0.1:{srv.server_address[1]}/'


class Run:
    def __init__(self, label): self.label, self.fail, self.ok = label, [], 0
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


async def scroll_through(page):
    await page.evaluate('''async () => { const h = document.body.scrollHeight; for (let y = 0; y < h; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 50)); } window.scrollTo(0, 0); }''')
    await page.wait_for_timeout(300)


async def flags_ok(page, run, where):
    bad = await page.evaluate('''() => [...document.querySelectorAll('img.flag')].filter(i => i.complete && !i.naturalWidth).map(i => i.src)''')
    run.check(not bad, f'{where}: broken flags {bad[:3]}')


async def drawer_id(page):
    return await page.evaluate('document.querySelector("#drawer.is-open .card")?.id')


async def esc(page, n=1):
    for _ in range(n):
        await page.keyboard.press('Escape'); await page.wait_for_timeout(120)


async def check_index(page, base, run, width, shots, tag):
    desktop = width >= 861
    await page.goto(base + 'index.html')
    await page.wait_for_function('window.ATLAS_PINS && document.querySelectorAll(".story").length > 0')
    await page.evaluate('Atlas.stopSpin()')
    await page.wait_for_timeout(500)
    await no_hscroll(page, run, 'index')
    if shots: await page.screenshot(path=f'{shots}/{tag}-index.png')
    data = await page.evaluate('''() => { const p = Atlas.allPins(); return { n: p.length, ids: p.map(x => x.id), countries: new Set(p.map(x => x.place.iso2)).size }; }''')
    n = data['n']
    run.check(n > 0, 'no pins loaded')
    run.check(await page.locator('.story:not([hidden])').count() == n, 'grid does not show every story')
    run.check(await page.locator('.ticker__item').count() == 2 * n, 'ticker items')
    run.check(await page.locator('.tile').count() == 8, 'theme tiles')
    run.check(await page.locator('#faces .avatar').count() >= 5, 'hero faces')
    await scroll_through(page)
    await flags_ok(page, run, 'index')
    run.check(await page.locator('.story.is-in').count() == n, 'story cards did not reveal on scroll')

    # every story opens from the grid, with scene + persona
    opened = 0
    for pid in data['ids']:
        await page.evaluate(f'document.querySelector(\'.story[data-id="{pid}"]\').click()')
        await page.wait_for_timeout(25)
        if await drawer_id(page) == f'pin-{pid}': opened += 1
        else: run.fail.append(f'pin {pid} did not open')
        has = await page.evaluate('[!!document.querySelector("#drawer .card__scene svg.scene"), !!document.querySelector("#drawer .persona .avatar"), !!document.querySelector("#drawer .localtime")]')
        run.check(all(has), f'pin {pid}: scene/persona/localtime missing {has}')
    run.check(opened == n, f'opened {opened}/{n}')
    await esc(page)
    await page.wait_for_timeout(300)
    run.check(not await page.evaluate('document.querySelector("#drawer").classList.contains("is-open")'), 'Escape did not close drawer')

    # globe: rendered, pins on the front hemisphere, spin + pause work
    run.check(await page.evaluate('document.querySelectorAll("#map path.map-land").length > 150'), 'globe land missing')
    run.check(await page.evaluate('(document.querySelector("#map .map-night").getAttribute("d") || "").length > 10'), 'day/night shade missing')
    await page.evaluate('Atlas.mapReset()')
    run.check(await page.locator('#map g.node').count() > 0, 'no pins visible on globe')
    await page.mouse.move(2, 2)
    await page.click('#spin')  # mapReset paused → this resumes
    await page.mouse.move(2, 2)
    await page.wait_for_timeout(100)
    d1 = await page.evaluate('document.querySelector("#map path.map-grat").getAttribute("d")')
    await page.wait_for_timeout(1200)
    d2 = await page.evaluate('document.querySelector("#map path.map-grat").getAttribute("d")')
    run.check(d1 != d2, 'globe does not spin')
    await page.click('#spin')
    await page.mouse.move(2, 2)
    await page.wait_for_timeout(100)
    d3 = await page.evaluate('document.querySelector("#map path.map-grat").getAttribute("d")')
    await page.wait_for_timeout(600)
    d4 = await page.evaluate('document.querySelector("#map path.map-grat").getAttribute("d")')
    run.check(d3 == d4, 'pause button does not stop the globe')
    missing = await page.evaluate('''() => Atlas.allPins().filter(p => { Atlas.mapFocus(p.id, 2.5); return ![...document.querySelectorAll('#map g.node')].some(g => { const d = g.__data__; return (d.type === 'pin' ? [d.pin] : d.pins).some(q => q.id === p.id); }); }).map(p => p.id)''')
    run.check(not missing, f'pins not shown on globe: {missing}')
    await page.evaluate('Atlas.mapReset()')

    if desktop:
        clicked = 0
        for i in range(await page.locator('#map g.pin').count()):
            await page.evaluate('Atlas.mapReset()')
            g = page.locator('#map g.pin').nth(i)
            pid = await g.get_attribute('data-id')
            await g.click()
            await page.wait_for_timeout(80)
            run.check(await drawer_id(page) == f'pin-{pid}', f'globe click on {pid}')
            clicked += 1
            await esc(page)
        run.check(clicked > 0, 'no clickable pins on globe')
        await page.evaluate('Atlas.mapReset()')
        if await page.locator('#map g.cluster').count():
            before = await page.evaluate('[...document.querySelectorAll("#map g.node")].map(g => g.__data__.key).join("|")')
            await page.locator('#map g.cluster').first.click()
            await page.wait_for_timeout(1100)
            after = await page.evaluate('[...document.querySelectorAll("#map g.node")].map(g => g.__data__.key).join("|")')
            listed = await page.evaluate('!!document.querySelector("#drawer.is-open .cluster-list")')
            run.check(after != before or listed, 'globe cluster click did nothing')
            await esc(page)
        await page.evaluate('Atlas.mapFocus("2026-11-14-33", 3)')
        await page.wait_for_timeout(100)
        ok = await page.evaluate('''() => { const l = [...document.querySelectorAll('#map path.map-land')].find(p => p.__data__.id === '716'); if (!l) return false; l.dispatchEvent(new MouseEvent('click', {bubbles: true})); return true; }''')
        await page.wait_for_timeout(300)
        run.check(ok and await page.locator('#dlg-country[open] .spot-item').count() >= 1, 'click on a country did not open its window')
        await esc(page)
        await page.evaluate('Atlas.mapReset()')

    # flat map: placement on 50m borders + every pin present
    await page.click('.mode button[data-mode="flat"]')
    await page.wait_for_timeout(300)
    on_map = await page.evaluate('''() => { const ids = new Set(); document.querySelectorAll('#map g.node').forEach(g => { const d = g.__data__; (d.type === 'pin' ? [d.pin] : d.pins).forEach(p => ids.add(p.id)); }); return [...ids]; }''')
    run.check(set(on_map) == set(data['ids']), f'flat map missing pins: {set(data["ids"]) - set(on_map)}')
    if desktop:
        wrong = await page.evaluate('''() => { const bad = []; for (const p of Atlas.allPins()) { const [x, y] = Atlas.mapFocus(p.id, 14);
            const hit = document.elementsFromPoint(x, y).find(e => e.classList && e.classList.contains('map-land'));
            if (!hit || hit.__data__.id !== p.place.iso_n3) bad.push(p.id + ' under ' + (hit ? hit.__data__.properties.name : 'sea')); } return bad; }''')
        run.check(not wrong, f'pins not on their country: {wrong}')
        await page.evaluate('Atlas.mapReset()')
        for i in range(await page.locator('#map g.pin').count()):
            await page.evaluate('Atlas.mapReset()')
            g = page.locator('#map g.pin').nth(i)
            pid = await g.get_attribute('data-id')
            await g.click(); await page.wait_for_timeout(60)
            run.check(await drawer_id(page) == f'pin-{pid}', f'flat click on {pid}')
            await esc(page)
        await page.evaluate('Atlas.mapReset()')
        await page.click('#z-in'); await page.wait_for_timeout(400)
        run.check((await page.evaluate('document.querySelector(".map-world").getAttribute("transform")') or '') not in ('', 'translate(0,0) scale(1)'), 'flat zoom button')
        if shots: await page.screenshot(path=f'{shots}/{tag}-flat.png')
    await page.click('.mode button[data-mode="globe"]')
    await page.wait_for_timeout(200)

    # deep link + term window + share
    await page.goto(base + 'index.html#pin=' + data['ids'][-1])
    await page.wait_for_selector('#drawer.is-open .card')
    await page.evaluate('Atlas.stopSpin()')
    await page.wait_for_timeout(1100)
    await no_hscroll(page, run, 'index+drawer')
    if shots: await page.screenshot(path=f'{shots}/{tag}-drawer.png')
    term = page.locator('#drawer .term').first
    if await term.count():
        await term.click()
        run.check(await page.locator('#term-pop:not([hidden])').count() == 1, 'term window did not open')
        await esc(page)
    await page.click('#share')
    await page.wait_for_timeout(150)
    run.check(await page.locator('#copied:not([hidden])').count() == 1, 'share did not confirm')
    await esc(page)
    await page.wait_for_timeout(300)

    # explore: tiles, areas, search, reset
    async def visible():
        return await page.locator('.story:not([hidden])').count()
    await page.locator('.tile[data-fam="4"]').click()
    exp = await page.evaluate('Atlas.allPins().filter(p => p.tags.includes("אנרגיה")).length')
    run.check(await visible() == exp, 'theme tile')
    await page.locator('.tile[data-fam="3"]').click()
    exp2 = await page.evaluate('Atlas.allPins().filter(p => p.tags.some(t => ["אנרגיה","מים","מזון וחקלאות","אקלים וסביבה"].includes(t))).length')
    run.check(await visible() == exp2, 'two tiles (OR)')
    if shots: await page.locator('#explore').screenshot(path=f'{shots}/{tag}-explore.png')
    await page.locator('#status [data-reset]').click()
    run.check(await visible() == n, 'reset')
    area = await page.evaluate('document.querySelectorAll("#areas .pill")[1].dataset.area')
    await page.locator('#areas .pill').nth(1).click()
    exp = await page.evaluate(f'Atlas.allPins().filter(p => p.place.area === {json.dumps(area)}).length')
    run.check(await visible() == exp, 'area pill')
    await page.locator('#areas .pill').first.click()
    await page.fill('#q', 'זימבבואה'); await page.wait_for_timeout(250)
    run.check(await visible() >= 1, 'search')
    await page.fill('#q', 'טנדאי'); await page.wait_for_timeout(250)
    run.check(await visible() == 1, 'search by persona name')
    await page.fill('#q', 'ללא-תוצאה-בכלל'); await page.wait_for_timeout(250)
    run.check(await visible() == 0 and await page.locator('#grid-empty:not([hidden])').count() == 1, 'empty state')
    await page.locator('#grid-empty [data-reset]').click()
    run.check(await visible() == n, 'reset from empty state')

    # timeline
    await page.evaluate('document.querySelector("#tl-range").value = 0; document.querySelector("#tl-range").dispatchEvent(new Event("input"))')
    run.check(await page.locator('#map g.node').count() == 0, 'timeline 0 still shows pins')
    await page.click('#tl-play')
    await page.wait_for_timeout(2200)
    run.check(await page.locator('#map g.node').count() > 0, 'PLAY did not bring pins back')

    # patterns
    pats = await page.evaluate('ATLAS_INDEX.patterns.length')
    run.check(await page.locator('.pattern').count() == pats, 'pattern cards')
    run.check(await page.locator('.pattern .pattern__members img.flag').count() >= 3 * pats, 'pattern flags')
    if pats:
        await page.locator('.pattern').first.click()
        await page.wait_for_timeout(1000)
        members = await page.evaluate('ATLAS_INDEX.patterns[0].members.length')
        run.check(await page.locator('.story.is-dim').count() == n - members, 'pattern highlight')
        if shots: await page.screenshot(path=f'{shots}/{tag}-pattern.png')
        await page.click('#pattern-clear')
        run.check(await page.locator('.story.is-dim').count() == 0, 'pattern clear')

    # ticker (pause first: a moving target is what the pause button is for), surprise
    await page.click('#ticker-pause')
    run.check(await page.evaluate('document.querySelector("#ticker").classList.contains("is-paused")'), 'ticker pause')
    await page.wait_for_timeout(100)
    await page.evaluate('''() => { const vw = innerWidth; const b = [...document.querySelectorAll('.ticker__item')].find(e => { const r = e.getBoundingClientRect(); const c = (r.left + r.right) / 2; return c > 80 && c < vw - 80; }); b.click(); }''')
    run.check(await drawer_id(page) is not None, 'ticker item did not open a story')
    await esc(page)
    await page.click('#surprise'); await page.wait_for_timeout(150)
    run.check(await drawer_id(page) is not None, 'surprise did not open a story')
    await esc(page); await page.wait_for_timeout(300)

    # country window
    await page.click('#open-countries'); await page.wait_for_timeout(400)
    run.check(await page.locator('#dlg-country[open] .country-btn').count() == data['countries'], 'country picker')
    await page.wait_for_timeout(200)
    await flags_ok(page, run, 'country picker')
    if shots: await page.screenshot(path=f'{shots}/{tag}-countries.png')
    await page.locator('#dlg-country .country-btn').first.click(); await page.wait_for_timeout(400)
    run.check(await page.locator('#dlg-country[open] .spot-item').count() >= 1, 'country spotlight')
    if shots: await page.screenshot(path=f'{shots}/{tag}-country.png')
    await page.locator('#dlg-country .spot-item').first.click(); await page.wait_for_timeout(250)
    run.check(await drawer_id(page) is not None and await page.locator('dialog[open]').count() == 0, 'spotlight → story')
    await esc(page); await page.wait_for_timeout(300)

    # numbers window
    await page.click('#open-stats'); await page.wait_for_timeout(1300)
    run.check(await page.locator('#dlg-stats[open] .bar').count() >= 8 + data['countries'], 'stats bars')
    big = await page.evaluate('[...document.querySelectorAll("#stats-body .bignum b")].map(b => +b.textContent)')
    run.check(big[:2] == [n, data['countries']], f'stats numbers {big}')
    await no_hscroll(page, run, 'stats')
    if shots: await page.screenshot(path=f'{shots}/{tag}-stats.png')
    await esc(page)
    run.check(await page.locator('dialog[open]').count() == 0, 'Escape closes dialog')
    if shots:
        await scroll_through(page)
        await page.screenshot(path=f'{shots}/{tag}-index-full.png', full_page=True)
    await no_hscroll(page, run, 'index end')


async def check_issue(page, base, run, shots, tag):
    for iss, count in await page.evaluate('ATLAS_INDEX.issues.map(i => [i.issue, i.count])'):
        await page.goto(f'{base}issue/{iss}.html')
        await page.wait_for_selector('.issue-cards .card')
        run.check(await page.locator('.issue-cards .card').count() == count, f'issue {iss}: cards')
        run.check(await page.locator('.issue-cards .persona').count() == count, f'issue {iss}: personas')
        await scroll_through(page)
        await flags_ok(page, run, 'issue')
        await no_hscroll(page, run, f'issue {iss}')
        if shots: await page.screenshot(path=f'{shots}/{tag}-issue-{iss}.png')


async def check_about(page, base, run, shots, tag):
    await page.goto(base + 'about.html')
    await page.wait_for_selector('main h1')
    await no_hscroll(page, run, 'about')
    body = await page.inner_text('body')
    run.check('Economist' not in body and 'DIFF' not in body, 'about mentions Economist/DIFF')
    if shots: await page.screenshot(path=f'{shots}/{tag}-about.png', full_page=True)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', default='')
    ap.add_argument('--chrome', default=os.environ.get('CHROME', ''))
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    if a.shots: os.makedirs(a.shots, exist_ok=True)
    srv, http_base = serve()
    file_base = ROOT.as_uri() + '/'
    runs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(**({'executable_path': a.chrome} if a.chrome else {}))
        for proto, base in (('file', file_base), ('http', http_base)):
            for width, height in ((1280, 900), (390, 844)):
                for scheme in ('light', 'dark'):
                    tag = f'{proto}-{width}-{scheme}'
                    if a.only and a.only not in tag: continue
                    run = Run(tag)
                    ctx = await browser.new_context(viewport={'width': width, 'height': height}, color_scheme=scheme,
                                                    has_touch=width < 500, is_mobile=width < 500)
                    page = await ctx.new_page()
                    await wire(page, run)
                    shots = a.shots if (a.shots and proto == 'file') else ''
                    try:
                        await check_index(page, base, run, width, shots, tag)
                        await check_issue(page, base, run, shots, tag)
                        await check_about(page, base, run, shots, tag)
                    except Exception as e:
                        run.fail.append(f'exception: {e!r}'[:600])
                    await ctx.close()
                    runs.append(run)
                    print(f"{'✓' if not run.fail else '✗'} {tag}: {run.ok} checks passed" + (f', {len(run.fail)} failed' if run.fail else ''))
                    for f in run.fail[:14]: print('    ' + f)
        await browser.close()
    srv.shutdown()
    bad = [r for r in runs if r.fail]
    print(f"\n{'ALL CLEAR' if not bad else 'FAILURES'}: {sum(r.ok for r in runs)} checks, {len(runs)} configurations")
    sys.exit(1 if bad else 0)

asyncio.run(main())
