"""CP060: actual Chromium networking against the disposable CP049 loopback TLS fixture.
No route interception, synthetic fetch, ignore_https_errors, production identities or credentials.
Run only in a dedicated test environment. The temporary NSS trust store is removed at exit.
"""
import json
import os
from pathlib import Path
import select
import shutil
import subprocess
import tempfile
from playwright.sync_api import sync_playwright, Error as PlaywrightError, expect

ROOT = Path(__file__).resolve().parents[2]
LINK = "__Host-crownicles_link"
SESSION = "__Host-crownicles_session"
CHECKS = []
PHASE = "preflight"


def check(name, condition):
    global PHASE
    PHASE = name
    if not condition:
        raise AssertionError(name)
    CHECKS.append(name)
    print("PASS", name, flush=True)


def run(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=30)


def readline(proc):
    ready, _, _ = select.select([proc.stdout], [], [], 10)
    if not ready:
        raise RuntimeError("FIXTURE_READ_TIMEOUT")
    return json.loads(proc.stdout.readline())


def command(proc, action, **fields):
    proc.stdin.write(json.dumps({"command": action, **fields}) + "\n")
    proc.stdin.flush()
    if readline(proc).get("ok") is not True:
        raise RuntimeError("FIXTURE_COMMAND_REJECTED")


def cookie(ctx, name):
    rows = [c for c in ctx.cookies() if c["name"] == name]
    if len(rows) > 1:
        raise AssertionError("DUPLICATE_COOKIE")
    return rows[0] if rows else None


def attributes(c):
    return bool(c and c["secure"] and c["httpOnly"] and c["sameSite"] == "Strict"
                and c["path"] == "/" and c["domain"] == "127.0.0.1"
                and c["expires"] > 0)


def btn(page, action):
    return page.locator(f'button[data-action="{action}"]').first


def request(page, action, path, status):
    with page.expect_response(lambda r: r.url == ORIGIN + path, timeout=10000) as info:
        btn(page, action).click()
    if info.value.status != status:
        raise AssertionError("UNEXPECTED_HTTP_STATUS_" + action)
    return info.value


def profile(page):
    return page.evaluate("async () => (await fetch('/v1/me/profile',{credentials:'same-origin',cache:'no-store'})).status")


def start(page):
    response = request(page, "link-start", "/v1/link/start", 201)
    expect(page.locator("#link-code")).to_be_visible()
    return response, page.locator("#link-code").inner_text().strip()


def link(proc, ctx, page, user, level):
    response, code = start(page)
    check(user + " link cookie native attributes", attributes(cookie(ctx, LINK)))
    check(user + " HttpOnly link invisible to JS", LINK not in page.evaluate("document.cookie"))
    check(user + " preapproval profile denied", profile(page) == 401)
    request(page, "link-check", "/v1/link/status", 200)
    expect(btn(page, "link-check")).to_be_visible()
    check(user + " pending UI has no private metrics", page.locator(".metric").count() == 0)
    command(proc, "approve", user=user, code=code)
    request(page, "link-check", "/v1/link/status", 200)
    expect(btn(page, "link-redeem")).to_be_visible()
    check(user + " approval is not yet a session", profile(page) == 401)
    request(page, "link-redeem", "/v1/link/redeem", 200)
    metric = page.locator(".metric").filter(has_text="Nível").locator("strong")
    expect(metric).to_have_text(str(level))
    check(user + " real network own level", metric.inner_text() == str(level))
    check(user + " native session cookie attributes", attributes(cookie(ctx, SESSION)))
    check(user + " session not exposed to JS", SESSION not in page.evaluate("document.cookie"))
    check(user + " redeemed link cookie removed", cookie(ctx, LINK) is None)
    check(user + " own profile authenticated", profile(page) == 200)
    return cookie(ctx, SESSION)


def open_page(ctx):
    page = ctx.new_page()
    page.set_default_timeout(10000)
    r = page.goto(URL, wait_until="domcontentloaded", timeout=15000)
    if r.status != 200:
        raise AssertionError("PREVIEW_HTTP_STATUS")
    expect(btn(page, "verify")).to_be_visible()
    return page


def main():
    global ORIGIN, URL, PHASE
    with tempfile.TemporaryDirectory(prefix="cp060-") as folder:
        d = Path(folder)
        home = d / "home"
        home.mkdir(mode=0o700)
        nss = home / ".pki/nssdb"
        nss.mkdir(parents=True)
        ca = d / "ca.pem"
        ca_key = d / "ca.key"
        cert = d / "leaf.pem"
        key = d / "leaf.key"
        csr = d / "leaf.csr"
        ext = d / "leaf.ext"
        ext.write_text("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=IP:127.0.0.1\n")
        old_umask = os.umask(0o077)
        try:
            run("openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(ca_key), "-out", str(ca), "-days", "1",
                "-subj", "/CN=Crownicles CP060 ephemeral test CA",
                "-addext", "basicConstraints=critical,CA:TRUE",
                "-addext", "keyUsage=critical,keyCertSign,cRLSign")
            run("openssl", "req", "-new", "-newkey", "rsa:2048", "-nodes",
                "-keyout", str(key), "-out", str(csr), "-subj", "/CN=127.0.0.1")
            run("openssl", "x509", "-req", "-in", str(csr), "-CA", str(ca),
                "-CAkey", str(ca_key), "-CAcreateserial", "-out", str(cert),
                "-days", "1", "-sha256", "-extfile", str(ext))
            run("openssl", "verify", "-CAfile", str(ca), "-verify_ip", "127.0.0.1", str(cert))
            run("certutil", "-N", "-d", "sql:" + str(nss), "--empty-password")
        finally:
            os.umask(old_umask)
        env = {**os.environ, "CROWNICLES_P0_LAB_STATIC": "1"}
        proc = subprocess.Popen(["node", str(ROOT / "lab/ux-p0-010/https-cookie-fixture.cp049.mjs"),
                                 str(key), str(cert)], cwd=ROOT, env=env,
                                stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, text=True, bufsize=1)
        try:
            info = readline(proc)
            port = info["port"]
            ORIGIN = f"https://127.0.0.1:{port}"
            URL = ORIGIN + "/lab/ux-p0-010/preview.html"
            check("fixture loopback only", info.get("ready") is True and info.get("previewUrl") == URL)
            browser_env = {**os.environ, "HOME": str(home),
                           "XDG_CONFIG_HOME": str(home / ".config"),
                           "XDG_CACHE_HOME": str(home / ".cache")}
            executable = shutil.which("google-chrome") or shutil.which("chromium")
            if not executable:
                raise RuntimeError("CHROMIUM_NOT_INSTALLED")
            with sync_playwright() as p:
                PHASE = "untrusted certificate negative control"
                browser = p.chromium.launch(executable_path=executable, headless=True, env=browser_env)
                try:
                    rejected = False
                    try:
                        browser.new_page(ignore_https_errors=False).goto(URL, timeout=15000)
                    except PlaywrightError as exc:
                        rejected = "ERR_CERT_AUTHORITY_INVALID" in str(exc)
                    check("untrusted certificate rejected by Chromium", rejected)
                finally:
                    browser.close()
                run("certutil", "-A", "-d", "sql:" + str(nss), "-n", "CP060 ephemeral CA",
                    "-t", "C,,", "-i", str(ca))
                PHASE = "trusted browser navigation"
                browser = p.chromium.launch(executable_path=executable, headless=True, env=browser_env)
                try:
                    a = browser.new_context(ignore_https_errors=False, viewport={"width": 390, "height": 844})
                    b = browser.new_context(ignore_https_errors=False, viewport={"width": 390, "height": 844},
                                            extra_http_headers={"x-fixture-user": "b"})
                    pa, pb = open_page(a), open_page(b)
                    check("trusted HTTPS navigation secure context", pa.evaluate("isSecureContext") is True)
                    check("both contexts anonymous", profile(pa) == 401 and profile(pb) == 401)
                    old = link(proc, a, pa, "a", 12)
                    check("independent B still denied", profile(pb) == 401)
                    link(proc, b, pb, "b", 77)
                    check("A remains isolated", pa.locator(".metric").filter(has_text="Nível").locator("strong").inner_text() == "12")
                    btn(pa, "inventory").click()
                    expect(pa.locator('button[data-action="select"]').first).to_be_visible()
                    pa.locator('button[data-action="select"]').first.click()
                    btn(pa, "inspect").click()
                    expect(pa.locator(".facts")).to_be_visible()
                    check("actual inventory and inspection", "Nível do item" in pa.locator(".facts").inner_text())
                    btn(pa, "back").click()
                    check("return restores selected slot", pa.locator('button[data-slot="0"]').get_attribute("aria-pressed") == "true")
                    pa.reload(wait_until="domcontentloaded")
                    expect(btn(pa, "verify")).to_be_visible()
                    request(pa, "verify", "/v1/me/profile", 200)
                    expect(pa.locator(".metric").filter(has_text="Nível").locator("strong")).to_have_text("12")
                    check("reload retains browser session", profile(pa) == 200)
                    request(pa, "forget", "/v1/session/logout", 200)
                    expect(btn(pa, "link-start")).to_be_visible()
                    check("logout clears native cookie and server session", cookie(a, SESSION) is None and profile(pa) == 401)
                    replay = browser.new_context(ignore_https_errors=False)
                    replay.add_cookies([old])
                    pr = open_page(replay)
                    check("revoked synthetic cookie rejected on replay", profile(pr) == 401)
                    replay.close()
                    check("B unaffected by A logout", profile(pb) == 200)
                    _, _ = start(pa)
                    request(pa, "link-cancel", "/v1/link/cancel", 200)
                    expect(btn(pa, "link-start")).to_be_visible()
                    check("cancel removes link cookie and code", cookie(a, LINK) is None and pa.locator("#link-code").count() == 0)
                    command(proc, "unbind", user="b")
                    check("private unbind revokes B browser session", profile(pb) == 401)
                    request(pb, "refresh", "/v1/me/profile", 401)
                    expect(btn(pb, "verify")).to_be_visible()
                    check("revocation removes private DOM", pb.locator(".metric").count() == 0)
                finally:
                    browser.close()
            command(proc, "exit")
            check("fixture exits cleanly", proc.wait(timeout=10) == 0)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
        if len(CHECKS) != 36 or len(set(CHECKS)) != 36:
            raise AssertionError("CHECK_COUNT_DRIFT")
        print(f"CP060 NATIVE BROWSER TLS: {len(CHECKS)} / 36", flush=True)
    except Exception as exc:
        # No exception details, cookies, code values, stdout or TLS keys in CI logs.
        print(f"CP060 FAIL phase={PHASE} category={type(exc).__name__} passed={len(CHECKS)}", flush=True)
        raise SystemExit(1)
