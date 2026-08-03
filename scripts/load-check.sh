#!/usr/bin/env bash
# Lightweight concurrency smoke: 50 parallel joins + display polls against a live session.
set -euo pipefail
API="${API:-http://localhost:8080/api}"
TEMPLATE_ID="${TEMPLATE_ID:-$(curl -s "$API/templates" | python3 -c 'import sys,json; print(json.load(sys.stdin)[0]["id"])')}"
CREATE=$(curl -s -X POST "$API/sessions" -H 'Content-Type: application/json' \
  -d "{\"templateId\":\"$TEMPLATE_ID\",\"title\":\"Load Check\"}")
SID=$(echo "$CREATE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["id"])')
CODE=$(echo "$CREATE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["code"])')
HT=$(echo "$CREATE" | python3 -c 'import sys,json; print(json.load(sys.stdin)["hostToken"])')
curl -s -X POST "$API/sessions/$SID/start" -H "X-Host-Token: $HT" >/dev/null

echo "Session $SID code=$CODE — joining 50 participants…"
seq 1 50 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "$API/sessions/$CODE/join" -H 'Content-Type: application/json' \
  -d '{"displayName":"User{}"}' | sort | uniq -c

echo "Display poll x50…"
seq 1 50 | xargs -P 20 -I{} curl -s -o /dev/null -w "%{http_code}\n" \
  "$API/sessions/$SID/display" | sort | uniq -c

COUNT=$(curl -s "$API/sessions/$SID/display" | python3 -c 'import sys,json; print(json.load(sys.stdin)["participantCount"])')
echo "participantCount=$COUNT (expect 50)"
test "$COUNT" = "50"
echo "Load check OK"
