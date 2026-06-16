#!/usr/bin/env python3
"""Compatibility wrapper for the HTML/CSS Pinterest pin generator.

This preserves the existing `python3 scripts/generate-pins-v2.py` workflow
while delegating rendering to the Playwright-based implementation.
"""

from __future__ import annotations

import os
import subprocess
import sys


def main() -> int:
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target = os.path.join(repo_dir, "scripts", "generate-pins-v2.mjs")
    cmd = ["node", target, *sys.argv[1:]]
    return subprocess.call(cmd, cwd=repo_dir)


if __name__ == "__main__":
    raise SystemExit(main())
