#!/usr/bin/env python3
"""strip-code-fences.py — Remove markdown code fences from Claude output"""
import re, sys
text = sys.stdin.read()
text = text.lstrip()
text = re.sub(r'^```\w*\n?', '', text)
text = re.sub(r'\n```\s*$', '', text)
text = text.strip() + '\n'
sys.stdout.write(text)
