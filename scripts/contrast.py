#!/usr/bin/env python3
"""Compatibility entry point: test the actual generated palette values.

The former script tested an unrelated, hardcoded colour list. The canonical
checks now cover all 20 variants and both modes, including native semantic
controls, text, header, focus, switch and chart contrast.
"""
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parent.parent
sys.exit(subprocess.call(['node', '--test', 'test/themes.test.mjs'], cwd=root))
