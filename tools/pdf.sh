#!/usr/bin/env bash
# usage: tools/pdf.sh input.html output.pdf
set -e
google-chrome --headless=new --no-sandbox --disable-gpu --no-pdf-header-footer --print-to-pdf="$2" "file://$(realpath "$1")" 2>/dev/null
