#!/usr/bin/env bash
# Rebuilds docs/*.pdf and resume/resume.pdf (needs pandoc + Google Chrome)
set -e
cd "$(dirname "$0")/.."
T=$(mktemp -d); cp tools/doc_style.css "$T/"
for n in AI_PROMPT_LOG:AI_Prompt_Log Job_Search_Analysis:Job_Search_Analysis Skills_Gap_Analysis:Skills_Gap_Analysis AI_Project_Documentation:AI_Project_Documentation; do
  src=${n%%:*}; out=${n##*:}
  pandoc "docs/$src.md" -s --metadata title=" " -c doc_style.css -o "$T/$out.html"
  sed -i 's#<header id="title-block-header">.*</header>##; /<h1 class="title">/d' "$T/$out.html"
  tools/pdf.sh "$T/$out.html" "docs/$out.pdf"
done
tools/pdf.sh resume/resume.html resume/resume.pdf
cp resume/resume.pdf resume.pdf
echo "PDFs rebuilt"
