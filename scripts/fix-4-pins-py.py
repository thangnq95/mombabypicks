#!/usr/bin/env python3
"""Extract Pinterest cookies from Chrome and launch Playwright to upload pins."""
import json
import os
import shutil
import subprocess
import sys
import time
import sqlite3
import tempfile

REPO = "/Users/thangnguyen/GIT/PP/mombabypicks"
CHROME_COOKIES = "/Users/thangnguyen/Library/Application Support/Google/Chrome/Default/Cookies"
PINS_DIR = os.path.join(REPO, "static/images/pins")
DATA_DIR = os.path.join(REPO, "data/pinterest")
LOG_FILE = "/tmp/pin-fix-4-py.txt"

def log(m):
    with open(LOG_FILE, "a") as f:
        f.write(time.strftime("%H:%M:%S") + " " + m + "\n")

def extract_pinterest_cookies():
    """Extract Pinterest cookies from Chrome's cookie store using sqlite3."""
    if not os.path.exists(CHROME_COOKIES):
        log(f"Cookie file not found: {CHROME_COOKIES}")
        return None
    
    # Copy the cookies file (Chrome locks it)
    tmp_cookies = "/tmp/chrome-cookies-copy.sqlite"
    shutil.copy2(CHROME_COOKIES, tmp_cookies)
    log(f"Copied cookies DB: {os.path.getsize(tmp_cookies)} bytes")
    
    try:
        conn = sqlite3.connect(tmp_cookies)
        cursor = conn.cursor()
        
        # Find Pinterest cookies
        cursor.execute("""
            SELECT name, value, host_key, path, is_secure, is_httponly, has_expires, expires_utc
            FROM cookies 
            WHERE host_key LIKE '%pinterest%'
        """)
        
        cookies = []
        for row in cursor.fetchall():
            name, value, host_key, path, is_secure, is_httponly, has_expires, expires_utc = row
            cookie = {
                "name": name,
                "value": value,
                "domain": host_key,
                "path": path,
                "secure": bool(is_secure),
                "httpOnly": bool(is_httponly),
            }
            if has_expires and expires_utc:
                cookie["expires"] = expires_utc / 1000000 - 11644473600  # Convert Chrome timestamp
            cookies.append(cookie)
        
        conn.close()
        log(f"Found {len(cookies)} Pinterest cookies")
        
        # Check for auth cookies
        auth_cookies = [c for c in cookies if any(k in c['name'] for k in ['auth', 'token', 'session', '_pinterest_sess', '__session'])]
        log(f"Auth-related cookies: {len(auth_cookies)}")
        for c in auth_cookies:
            log(f"  {c['name']}: {c['value'][:30]}...")
        
        return cookies
    except Exception as e:
        log(f"Cookie error: {e}")
        return None

def main():
    log("="*60)
    log("START fix-4-pins (Python + Playwright)")
    log("="*60)
    
    cookies = extract_pinterest_cookies()
    if not cookies:
        log("FAILED: Could not extract Pinterest cookies")
        print("❌ Could not extract Pinterest cookies")
        return False
    
    # Write cookies to a temp file for the Node.js script
    with open("/tmp/pinterest-cookies.json", "w") as f:
        json.dump(cookies, f, indent=2)
    log(f"Saved {len(cookies)} cookies to /tmp/pinterest-cookies.json")
    
    # Now call the Node.js Playwright script with these cookies
    env = os.environ.copy()
    result = subprocess.run(
        ["node", "scripts/fix-4-pins-with-cookies.mjs"],
        cwd=REPO,
        capture_output=True,
        text=True,
        timeout=180
    )
    log(f"Node exit code: {result.returncode}")
    log(f"stdout: {result.stdout[-500:]}")
    if result.stderr:
        log(f"stderr: {result.stderr[-500:]}")
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result.returncode == 0

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
