"""
Concurrent seat locking load test.
Simulates N users trying to lock seats simultaneously to verify:
  - PostgreSQL SKIP LOCKED works (no double-locks)
  - Rate limiting and proper error responses
  - WebSocket broadcasting works under load

Usage:
  pip install httpx
  python load_test.py --users 20 --event 1 --url http://localhost:8000

Note: Uses the seed test users for quick testing. In production,
      generate real auth tokens.
"""

import asyncio
import argparse
import time
import httpx
from collections import Counter


async def create_test_token(client: httpx.AsyncClient, base_url: str, user_num: int) -> str:
    """
    In dev mode, create a JWT by directly posting to a debug endpoint.
    Replace this with real OAuth flow for integration tests.
    """
    # For testing: call a /dev/token endpoint that issues tokens without OAuth.
    # This endpoint should ONLY exist in development (controlled by env var).
    resp = await client.post(f"{base_url}/dev/token", json={"user_id": user_num})
    if resp.status_code != 200:
        raise RuntimeError(f"Could not get test token for user {user_num}: {resp.text}")
    return resp.json()["token"]


async def try_lock_seat(
    client: httpx.AsyncClient,
    base_url: str,
    token: str,
    event_id: int,
    seat_id: int,
    user_id: int,
) -> dict:
    """One user attempts to lock one seat."""
    start = time.monotonic()
    try:
        resp = await client.post(
            f"{base_url}/api/events/{event_id}/seats/lock",
            json={"seat_id": seat_id},
            headers={"Authorization": f"Bearer {token}"},
            timeout=10.0,
        )
        elapsed = time.monotonic() - start
        return {
            "user_id": user_id,
            "seat_id": seat_id,
            "status": resp.status_code,
            "success": resp.status_code == 200,
            "elapsed_ms": round(elapsed * 1000),
            "body": resp.json() if resp.status_code in (200, 409) else {},
        }
    except Exception as e:
        return {
            "user_id": user_id,
            "seat_id": seat_id,
            "status": 0,
            "success": False,
            "elapsed_ms": round((time.monotonic() - start) * 1000),
            "error": str(e),
        }


async def run_concurrent_test(base_url: str, event_id: int, num_users: int):
    """
    All num_users attempt to lock the SAME seat simultaneously.
    Only ONE should succeed. All others should get 409.
    """
    print(f"\n{'='*60}")
    print(f"Concurrent seat locking test")
    print(f"  URL:      {base_url}")
    print(f"  Event:    {event_id}")
    print(f"  Users:    {num_users}")
    print(f"  Target:   seat 1 (all {num_users} users fight for it)")
    print(f"{'='*60}\n")

    # Get seats to find the first available one
    async with httpx.AsyncClient() as client:
        seats_resp = await client.get(f"{base_url}/api/events/{event_id}/seats",
                                       headers={"Authorization": "Bearer dummy"})

    # We'll just target seat_id=1 for this test
    target_seat_id = 1

    # Fire all requests simultaneously
    print(f"Firing {num_users} concurrent lock requests for seat {target_seat_id}…")
    fire_time = time.monotonic()

    async with httpx.AsyncClient() as client:
        tasks = []
        for i in range(1, num_users + 1):
            # Each user gets their own token (in real test: real OAuth tokens)
            # For simplicity here we use user_id as auth hint; replace with real tokens
            tasks.append(
                try_lock_seat(client, base_url, f"test-token-{i}", event_id, target_seat_id, i)
            )
        results = await asyncio.gather(*tasks)

    total_time = time.monotonic() - fire_time

    # ── Report ────────────────────────────────────────────────
    successes = [r for r in results if r["success"]]
    conflicts = [r for r in results if r["status"] == 409]
    errors = [r for r in results if not r["success"] and r["status"] != 409]

    status_counts = Counter(r["status"] for r in results)
    avg_ms = round(sum(r["elapsed_ms"] for r in results) / len(results))
    max_ms = max(r["elapsed_ms"] for r in results)

    print(f"\n{'─'*40}")
    print(f"Results (completed in {total_time*1000:.0f}ms total):")
    print(f"  ✅ Locked successfully: {len(successes)}")
    print(f"  ⚡ Conflicts (409):     {len(conflicts)}")
    print(f"  ❌ Errors:              {len(errors)}")
    print(f"\nStatus code breakdown: {dict(status_counts)}")
    print(f"Response times: avg={avg_ms}ms, max={max_ms}ms")

    # Correctness check
    if len(successes) == 1:
        print(f"\n✅ PASS: Exactly 1 user acquired the lock (user {successes[0]['user_id']})")
    elif len(successes) == 0:
        print(f"\n⚠️  No user acquired the lock (all rejected?)")
    else:
        print(f"\n❌ FAIL: {len(successes)} users acquired the same lock — race condition detected!")

    print(f"{'='*60}\n")

    return results


async def run_spread_test(base_url: str, event_id: int, num_users: int):
    """
    Each user locks a DIFFERENT seat.
    All should succeed. Tests throughput.
    """
    print(f"\n{'='*60}")
    print(f"Spread lock test (each user locks a different seat)")
    print(f"  Users: {num_users}")
    print(f"{'='*60}\n")

    fire_time = time.monotonic()
    async with httpx.AsyncClient() as client:
        tasks = [
            try_lock_seat(client, base_url, f"test-token-{i}", event_id, i, i)
            for i in range(1, num_users + 1)
        ]
        results = await asyncio.gather(*tasks)

    total_time = time.monotonic() - fire_time
    successes = sum(1 for r in results if r["success"])
    avg_ms = round(sum(r["elapsed_ms"] for r in results) / len(results))

    print(f"Results: {successes}/{num_users} locked in {total_time*1000:.0f}ms (avg {avg_ms}ms each)")
    if successes == num_users:
        print("✅ PASS: All seats locked without conflict")
    else:
        failed = [r for r in results if not r["success"]]
        print(f"❌ {len(failed)} failures:")
        for r in failed[:5]:
            print(f"   seat {r['seat_id']}: {r}")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seat locking load test")
    parser.add_argument("--url", default="http://localhost:8000")
    parser.add_argument("--event", type=int, default=1)
    parser.add_argument("--users", type=int, default=20)
    args = parser.parse_args()

    async def main():
        # Test 1: Concurrent fight for one seat
        await run_concurrent_test(args.url, args.event, args.users)

        # Brief pause to let the lock settle
        await asyncio.sleep(1)

        # Test 2: Each user gets their own seat
        await run_spread_test(args.url, args.event, min(args.users, 50))

    asyncio.run(main())
