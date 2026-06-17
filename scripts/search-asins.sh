#!/bin/bash
# Quick search for real ASINs
echo "Searching for real products..."

search_asin() {
  local query="$1"
  local url="https://www.amazon.com/s?k=$(echo "$query" | sed 's/ /+/g')"
  local html=$(curl -sL -A "Mozilla/5.0" "$url" --max-time 10)
  # Extract first ASIN from search results
  local asin=$(echo "$html" | grep -o '/dp/[A-Z0-9]\{10\}' | head -1 | sed 's|/dp/||')
  echo "$query -> $asin"
}

search_asin "Diono Ultra Dry Car Seat Protector"
search_asin "Brica Sun Shield Car Shade"
search_asin "LittleMissMatched Baby Swim Diaper 3 pack"
