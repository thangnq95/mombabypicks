#!/bin/bash
# ============================================================
# Pre-commit verifier — chạy trước mỗi lần commit
# Codex PHẢI chạy script này, nếu FAIL thì KHÔNG được commit
# ============================================================
set -e

ERRORS=0
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "🔍 MOMBABYPICKS PRE-COMMIT VERIFIER"
echo "========================================"

# 1. CSS file còn tồn tại?
echo -n "[1/6] CSS file check... "
if [ -f "assets/css/extended/mombabypicks.css" ]; then
    LINES=$(wc -l < assets/css/extended/mombabypicks.css)
    if [ "$LINES" -ge 1000 ]; then
        echo "✅ ($LINES lines)"
    else
        echo "❌ Chỉ có $LINES dòng (cần >=1000)"
        ERRORS=$((ERRORS+1))
    fi
else
    echo "❌ MISSING: assets/css/extended/mombabypicks.css"
    ERRORS=$((ERRORS+1))
fi

# 2. Hugo build?
echo -n "[2/6] Hugo build... "
BUILD_OUTPUT=$(hugo --gc 2>&1) || {
    echo "❌ BUILD FAILED"
    echo "$BUILD_OUTPUT"
    ERRORS=$((ERRORS+1))
}
echo "✅"

# 3. Fake ASINs?
echo -n "[3/6] Fake ASIN check... "
FAKE=$(grep -rl 'B0DFLT' content/posts/ 2>/dev/null | wc -l)
if [ "$FAKE" -eq 0 ]; then
    echo "✅"
else
    echo "❌ $FAKE articles contain B0DFLT* fake ASINs"
    grep -rl 'B0DFLT' content/posts/ | sed 's/^/   /'
    ERRORS=$((ERRORS+1))
fi

# 4. Layout/CSS không bị xóa?
echo -n "[4/6] Critical files intact... "
MISSING=0
for f in "assets/css/extended/mombabypicks.css" "layouts/index.html" "layouts/_partials/home_info.html" "hugo.toml"; do
    [ ! -f "$f" ] && echo "❌ MISSING: $f" && MISSING=$((MISSING+1))
done
[ "$MISSING" -eq 0 ] && echo "✅" || ERRORS=$((ERRORS+MISSING))

# 5. Amazon buttons render đúng?
echo -n "[5/6] Amazon button count... "
MISMATCH=0
for f in content/posts/*.md; do
    slug=$(basename "$f" .md)
    expected=$(grep -c '{{< amazon' "$f" 2>/dev/null || echo 0)
    live=$(grep -c 'amazon-cta' "public/posts/$slug/index.html" 2>/dev/null || echo 0)
    if [ "$expected" -ne "$live" ] 2>/dev/null && [ "$expected" -gt 0 ] 2>/dev/null; then
        MISMATCH=$((MISMATCH+1))
    fi
done
[ "$MISMATCH" -eq 0 ] && echo "✅" || echo "⚠️ $MISMATCH mismatch (may be expected if shortcodes have fake ASINs)"

# 6. Git diff không có thay đổi nguy hiểm
echo -n "[6/6] Dangerous changes... "
DANGER=$(git diff --name-only -- layouts/ assets/css/extended/ hugo.toml 2>/dev/null | wc -l)
if [ "$DANGER" -eq 0 ]; then
    echo "✅ (no changes to layouts/CSS/config)"
else
    echo "⚠️ $DANGER file(s) changed — verify these are intentional:"
    git diff --name-only -- layouts/ assets/css/extended/ hugo.toml | sed 's/^/   /'
fi

echo ""
echo "========================================"
if [ "$ERRORS" -eq 0 ]; then
    echo "✅ ALL CHECKS PASSED — you can commit"
else
    echo "❌ $ERRORS ERROR(S) — FIX BEFORE COMMIT"
    exit 1
fi
