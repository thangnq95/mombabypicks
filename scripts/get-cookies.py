#!/usr/bin/env python3
"""
Extract Pinterest cookies from Chrome via osascript/JXA and write them to a Playwright-compatible JSON.
Chrome on macOS encrypts cookies with the keychain, so we need to use osascript to run JS in Chrome.
"""
import json
import os
import subprocess
import sys
import time

REPO = "/Users/thangnguyen/GIT/PP/mombabypicks"

def get_pinterest_cookies_via_js():
    """Use Chrome's JavaScript console to extract document.cookie for pinterest.com"""
    script = '''
    tell application "Google Chrome"
        set tabIndex to 0
        set winIndex to 1
        set currentURL to URL of tab tabIndex of window winIndex
        
        -- Navigate to Pinterest to get cookies
        set URL of tab tabIndex of window winIndex to "https://www.pinterest.com/"
        delay 3
        
        -- Execute JS to get cookies
        set cookieStr to execute tab tabIndex of window winIndex javascript "document.cookie"
        set pageTitle to execute tab tabIndex of window winIndex javascript "document.title"
        
        return pageTitle & "|||" & cookieStr
    end tell
    '''
    
    result = subprocess.run(["osascript", "-e", script], capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f"AppleScript error: {result.stderr}")
        return None
    
    output = result.stdout.strip()
    parts = output.split("|||", 1)
    if len(parts) == 2:
        title, cookie_str = parts
        print(f"Page: {title}")
        cookies = {}
        for item in cookie_str.split(";"):
            item = item.strip()
            if "=" in item:
                name, _, value = item.partition("=")
                cookies[name.strip()] = value.strip()
        return cookies
    return {}

def main():
    print("=" * 60)
    print("Extracting Pinterest cookies from Chrome...")
    print("=" * 60)
    
    cookies = get_pinterest_cookies_via_js()
    if cookies:
        print(f"Found {len(cookies)} cookies via JS")
        for k, v in list(cookies.items())[:5]:
            print(f"  {k}: {v[:30]}...")
        
        with open("/tmp/pinterest-js-cookies.json", "w") as f:
            json.dump(cookies, f, indent=2)
        
        print("Saved to /tmp/pinterest-js-cookies.json")
        return True
    else:
        print("No cookies found")
        return False

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
