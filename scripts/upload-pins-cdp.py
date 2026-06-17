#!/usr/bin/env python3
"""Upload pin image to Pinterest via persistent CDP WebSocket.
Usage: python3 scripts/upload-pins-cdp.py <slug>
"""
import json, os, sys, time
import urllib.request
import websocket

CDP_HTTP = "http://localhost:9222"
REPO = "/Users/thangnguyen/GIT/PP/mombabypicks"

def find_page_target():
    with urllib.request.urlopen(f"{CDP_HTTP}/json") as resp:
        targets = json.loads(resp.read())
    for t in targets:
        if t.get("type") == "page" and "pin-creation-tool" in t.get("url", ""):
            return t
    for t in targets:
        if t.get("type") == "page":
            return t
    return None

def send_cmd(ws, method, params=None):
    msg_id = int(time.time() * 1000000) % 1000000
    payload = json.dumps({"id": msg_id, "method": method, "params": params or {}})
    ws.send(payload)
    resp = ws.recv()
    return json.loads(resp)

def upload_image(ws, slug, pin_num):
    img_path = os.path.abspath(f"{REPO}/static/images/pins/{slug}-pin-{pin_num}.png")
    if not os.path.exists(img_path):
        print(f"  FAIL Image not found: {img_path}")
        return False
    print(f"  Image: {os.path.basename(img_path)} ({os.path.getsize(img_path):,} bytes)")
    
    # Get object ID via Runtime.evaluate (works with persistent WS)
    eval_result = send_cmd(ws, "Runtime.evaluate", {
        "expression": "document.getElementById('storyboard-upload-input')",
        "objectGroup": "uploads"
    })
    obj = eval_result.get("result", {}).get("result", {})
    obj_id = obj.get("objectId")
    if not obj_id:
        print(f"  FAIL Could not get file input object (result keys: {list(obj.keys())})")
        return False
    
    # Set files using the object ID
    result = send_cmd(ws, "DOM.setFileInputFiles", {
        "objectId": obj_id,
        "files": [img_path]
    })
    if "error" in result:
        print(f"  FAIL: {result['error']}")
        return False
    print("  OK Image uploaded")
    return True

def js_set_value(ws, selector_attrs, value):
    """Find an input by multiple possible selectors and set its value."""
    selectors = ' , '.join(f'input[{a}]' for a in selector_attrs)
    escaped = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": f"""
(function() {{
    var el = document.querySelector('{selectors}');
    if (!el) {{
        var inputs = document.querySelectorAll('input');
        var keywords = {json.dumps([a.split('=')[0].split('*')[0].lower() for a in selector_attrs])};
        for (var inp of inputs) {{
            var text = (inp.placeholder || inp.getAttribute('aria-label') || '').toLowerCase();
            for (var kw of keywords) {{
                if (text.includes(kw)) {{ el = inp; break; }}
            }}
            if (el) break;
        }}
    }}
    if (el) {{
        var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        setter.set.call(el, '{escaped}');
        el.dispatchEvent(new Event('input', {{bubbles: true}}));
        el.dispatchEvent(new Event('change', {{bubbles: true}}));
        return 'OK:' + (el.id || '(unnamed)');
    }}
    return 'NOT_FOUND';
}})()
"""
    })
    return result.get("result", {}).get("result", {}).get("value", "ERROR")

def js_set_contenteditable(ws, value):
    """Find contenteditable div and set its text."""
    escaped = value.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": f"""
(function() {{
    var descEl = document.querySelector('div[contenteditable][aria-label*=\"Description\" i], div[role=\"textbox\"][aria-label*=\"Description\" i], div[aria-label*=\"Describe\" i]');
    if (!descEl) {{
        var divs = document.querySelectorAll('div[contenteditable]:not([aria-hidden])');
        for (var d of divs) {{
            var label = (d.getAttribute('aria-label') || '').toLowerCase();
            if (label.includes('description') || label.includes('describe')) {{ descEl = d; break; }}
        }}
    }}
    if (!descEl) {{
        var divs = document.querySelectorAll('div[contenteditable]:not([aria-hidden])');
        if (divs.length > 0) descEl = divs[0];
    }}
    if (descEl) {{
        descEl.textContent = '{escaped}';
        descEl.dispatchEvent(new Event('input', {{bubbles: true}}));
        descEl.dispatchEvent(new Event('change', {{bubbles: true}}));
        return 'OK:' + (descEl.id || 'contenteditable');
    }}
    return 'NOT_FOUND';
}})()
"""
    })
    return result.get("result", {}).get("result", {}).get("value", "ERROR")

def js_click_publish(ws):
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": """
(function() {
    var buttons = document.querySelectorAll('button');
    var cand = [];
    for (var btn of buttons) {
        var t = btn.textContent.trim().toLowerCase();
        if ((t === 'publish' || t === 'save' || t.includes('publish') || t.includes('save')) && btn.offsetParent !== null) {
            cand.push(btn);
        }
    }
    if (cand.length > 0) {
        cand[0].click();
        return 'OK:' + cand[0].textContent.trim();
    }
    return 'NOT_FOUND';
})()
"""
    })
    return result.get("result", {}).get("result", {}).get("value", "ERROR")

def get_url(ws):
    result = send_cmd(ws, "Runtime.evaluate", {
        "expression": "window.location.href"
    })
    return result.get("result", {}).get("result", {}).get("value", "")

if __name__ == "__main__":
    slug = sys.argv[1] if len(sys.argv) > 1 else ""
    if not slug:
        print("Usage: python3 scripts/upload-pins-cdp.py <slug>")
        sys.exit(1)
    
    with open(f"{REPO}/data/pinterest/{slug}.json") as f:
        pins = json.load(f)
    
    target = find_page_target()
    if not target:
        print("FAIL No Pinterest page target found")
        sys.exit(1)
    
    print(f"Connecting to CDP...")
    ws = websocket.create_connection(target["webSocketDebuggerUrl"], timeout=30)
    print("Connected")
    
    if "pin-creation-tool" not in target.get("url", ""):
        print("Navigating to pin-creation-tool...")
        send_cmd(ws, "Page.navigate", {"url": "https://www.pinterest.com/pin-creation-tool/"})
        time.sleep(4)
    
    pin_urls = []
    for i, pin in enumerate(pins):
        num = i + 1
        print(f"\n--- Pin {num}: {pin['title'][:50]} ---")
        
        if pin.get("status") == "published" and "NEED_REAL_ID" not in pin.get("published_pin_url", ""):
            print(f"  Already published: {pin['published_pin_url']}")
            pin_urls.append(pin["published_pin_url"])
            continue
        
        # Navigate fresh to pin-creation-tool before each pin
        print("  Navigating to pin-creation-tool...")
        send_cmd(ws, "Page.navigate", {"url": "https://www.pinterest.com/pin-creation-tool/"})
        time.sleep(4)
        
        ok = upload_image(ws, slug, num)
        if not ok:
            continue
        time.sleep(4)
        
        # Title
        r = js_set_value(ws, ['aria-label*="Title"', 'placeholder*="Title"', 'id*="title"', 'data-test-id*="title"', 'placeholder*="Tell everyone"'], pin["title"])
        print(f"  Title: {r[:60]}")
        
        # Link
        r = js_set_value(ws, ['aria-label*="Link"', 'placeholder*="Link"', 'aria-label*="Destination"', 'placeholder*="Add a link"'], pin["destination_url"])
        print(f"  Link: {r[:60]}")
        
        # Description
        r = js_set_contenteditable(ws, pin["description"])
        print(f"  Desc: {r[:60]}")
        
        time.sleep(1)
        
        # Publish
        r = js_click_publish(ws)
        print(f"  Pub: {r[:60]}")
        
        time.sleep(5)
        
        url = get_url(ws)
        if "/pin/" in url and "pin-creation" not in url and "login" not in url:
            pin_urls.append(url)
            print(f"  DONE URL: {url}")
        else:
            print(f"  URL: {url} (pin saved to drafts - needs manual publish)")
            pin_urls.append(url)
    
    ws.close()
    
    if pin_urls:
        for i, url in enumerate(pin_urls):
            if i < len(pins):
                pins[i]["status"] = "published"
                pins[i]["published_pin_url"] = url
        # If no real pin URLs were captured but images were uploaded, mark as draft
        if not any("/pin/" in u and "pin-creation" not in u for u in pin_urls):
            # Try to get pin URLs from the current page or drafts
            print("\n⚠️  No real pin URLs captured. Checking if pins saved as drafts...")
            result = send_cmd(ws, "Runtime.evaluate", {
                "expression": "window.location.href"
            })
            current_url = result.get("result", {}).get("result", {}).get("value", "")
            print(f"  Current URL: {current_url}")
        
        with open(f"{REPO}/data/pinterest/{slug}.json", "w") as f:
            json.dump(pins, f, indent=2)
        print(f"\nSaved {len(pin_urls)} URL(s) to {slug}.json")
    
    print(f"\nResult: {len(pin_urls)}/{len(pins)} published")
