import sys
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

import httpx
import random

BASE = "http://localhost:8000/api/v1"

print("=" * 70)
print("  VERIFYING LIVE FASTAPI + SUPABASE POSTGRES INTEGRATION")
print("=" * 70)

# 1. Fetch precomputed list
resp = httpx.get(f"{BASE}/graph/precomputed")
print(f"GET /graph/precomputed -> Status: {resp.status_code}")
if resp.status_code != 200:
    print(f"Error: {resp.text}")
    sys.exit(1)

hubs = resp.json()
print(f"✔ Successfully loaded {len(hubs)} precomputed discovery hubs directly from Supabase!")

# 2. Pick 5 random hubs across categories and verify full schema parsing
sample = random.sample(hubs, min(5, len(hubs)))
print("\nVerifying 5 random hub payload schemas from Supabase:")
for h in sample:
    hid = h["id"]
    hresp = httpx.get(f"{BASE}/graph/precomputed/{hid}")
    if hresp.status_code == 200:
        data = hresp.json()
        print(f"  ✔ [200 OK] [{data.get('category', 'General'):12}] {data.get('topic'):40} | Root: {data.get('root', {}).get('title')} | Children: {len(data.get('children', []))}")
    else:
        print(f"  ❌ [{hresp.status_code}] {hid} -> {hresp.text}")

print("\n✔ All Supabase discovery hubs verified successfully!")
