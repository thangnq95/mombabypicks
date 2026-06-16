#!/usr/bin/env python3
"""Compatibility wrapper for the legacy Pinterest pin generator.

This script now forwards to `scripts/generate-pins-v2.py`, which is the
canonical pin pipeline and matches the current visual rule set.
"""

import os
import subprocess
import sys


def main():
    repo_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target = os.path.join(repo_dir, "scripts", "generate-pins-v2.py")
    cmd = [sys.executable, target, *sys.argv[1:]]
    raise SystemExit(subprocess.call(cmd, cwd=repo_dir))


if __name__ == "__main__":
    main()
