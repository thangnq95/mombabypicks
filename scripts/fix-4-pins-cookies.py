#!/usr/bin/env python3
"""
Extract Pinterest cookies from Chrome using browser-cookie3,
then hand them to a Playwright Node.js script for pin upload.
"""
import json
import os
import subprocess
import sys
import time

REPO = "/Users/thangnguyen/GIT/PP/mombabypicks"
LOG_FILE = "/tmp/pin-fix-4-log.txt"

def log(m):
    with open(LOG_FILE, "a") as f:
        f.write(time.strftime("%H:%M:%S") + " " + m + "\n")

def extract_pinterest_cookies():
    """Extract Pinterest cookies via browser-cookie3."""
    try:
        import browser_cookie3
        cj = browser_cookie3.chrome(domain_name="pinterest.com")
        
        cookies_list = []
        for c in cj:
            cookie = {
                "name": c.name,
                "value": c.value,
                "domain": c.domain,
                "path": c.path,
                "secure": c.secure,
                "httpOnly": c.has_nonstandard_attr("httponly"),
            }
            if c.expires:
                cookie["expires"] = c.expires
            cookies_list.append(cookie)
        
        log(f"Found {len(cookies_list)} Pinterest cookies via browser-cookie3")
        
        # Check for key auth cookies
        auth_keys = ['_pinterest_sess', 'auth', 'csrftoken', '__session']
        for c in cookies_list:
            if c['name'] in auth_keys:
                log(f"  KEY COOKIE: {c['name']} = {c['value'][:40]}...")
        
        return cookies_list
    except Exception as e:
        log(f"browser-cookie3 error: {e}")
        return None

def main():
    log("=" * 60)
    log("START fix-4-pins (browser-cookie3 + Playwright)")
    log("=" * 60)
    
    cookies = extract_pinterest_cookies()
    if not cookies:
        log("FAILED: Could not extract Pinterest cookies")
        print("❌ Could not extract Pinterest cookies from Chrome")
        return False
    
    # Check if we have the session cookie
    has_auth = any(c['name'] == '_pinterest_sess' and len(c['value']) > 10 for c in cookies)
    if not has_auth:
        log("WARNING: No _pinterest_sess cookie found. Might not be logged in.")
        # Still try — maybe there's another auth mechanism
    
    # Save cookies for Node.js script
    with open("/tmp/pinterest-cookies.json", "w") as f:
        json.dump(cookies, f, indent=2)
    log(f"Saved {len(cookies)} cookies")
    
    # Run the Node.js Playwright script
    env = os.environ.copy()
    result = subprocess.run(
        ["node", "scripts/fix-4-pins-cookies.mjs"],
        cwd=REPO,
        capture_output=True,
        text=True,
        timeout=180
    )
    
    log(f"Node exit code: {result.returncode}")
    log(f"stdout last 500: {result.stdout[-500:]}")
    log(f"stderr last 500: {result.stderr[-500:] if result.stderr else 'none'}")
    
    print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result.returncode == 0

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
