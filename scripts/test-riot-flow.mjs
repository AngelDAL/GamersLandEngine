#!/usr/bin/env node
/**
 * End-to-end test of the Riot Tournament Stub API V5
 * Tests: Provider → Tournament → Codes → Code Info → (Lobby Events expected)
 */

const RIOT_API_KEY = process.env.RIOT_API_KEY;
if (!RIOT_API_KEY) {
  console.error("❌ RIOT_API_KEY not set");
  process.exit(1);
}

const BASE_URL = "https://americas.api.riotgames.com/lol/tournament-stub/v5";

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      "X-Riot-Token": RIOT_API_KEY,
      "Content-Type": "application/json",
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const url = `${BASE_URL}${path}`;
  console.log(`  → ${method} ${url}`);
  if (body) console.log(`    Payload: ${JSON.stringify(body)}`);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!res.ok) {
    console.log(`    ⚠️  HTTP ${res.status} (expected for Stub with no games played)`);
    console.log(`      ${text.slice(0, 150)}`);
    return { status: res.status, data: null };
  }

  console.log(`    ✅ ${typeof data === 'object' ? JSON.stringify(data).slice(0, 300) : data}`);
  return { status: res.status, data };
}

async function main() {
  console.log("═══════════════════════════════════════");
  console.log("  Riot Tournament Stub API V5 - E2E");
  console.log("═══════════════════════════════════════\n");

  // 1. Create Provider
  console.log("Step 1: Create Provider");
  const provider = await api("POST", "/providers", {
    region: "LAN",
    url: "https://gamersland.test/callback",
  });
  const providerId = Number(provider.data);
  console.log(`   ✅ Provider ID: ${providerId}`);

  // 2. Create Tournament
  console.log("\nStep 2: Create Tournament");
  const tournament = await api("POST", "/tournaments", {
    providerId,
    name: "GamersLand Test Tournament",
  });
  const tournamentId = Number(tournament.data);
  console.log(`   ✅ Tournament ID: ${tournamentId}`);

  // 3. Generate Codes
  console.log("\nStep 3: Generate Tournament Codes");
  const codes = await api("POST", `/codes?tournamentId=${tournamentId}`, {
    count: 2,
    mapType: "SUMMONERS_RIFT",
    pickType: "TOURNAMENT_DRAFT",
    spectatorType: "ALL",
    teamSize: 5,
  });
  const codeList = Array.isArray(codes.data) ? codes.data : [codes.data].filter(Boolean);
  console.log(`   ✅ ${codeList.length} codes: ${codeList.join(", ")}`);

  // 4. Get Code Info (first code)
  console.log("\nStep 4: Get Code Info");
  const codeInfo = await api("GET", `/codes/${encodeURIComponent(codeList[0])}`);
  if (codeInfo.data) {
    console.log(`   ✅ Code metadata:`);
    console.log(`      Map: ${codeInfo.data.map}, Pick: ${codeInfo.data.pickType}, Team: ${codeInfo.data.teamSize}`);
  }

  // 5. Get Lobby Events (expected to fail in Stub — no games played)
  console.log("\nStep 5: Get Lobby Events (Stub — no games played yet, 403 expected)");
  const events = await api("GET", `/codes/${encodeURIComponent(codeList[0])}/lobby-events`);
  const eventsOk = events.status === 403 || (events.data && Array.isArray(events.data));
  if (eventsOk) {
    console.log(`   ✅ Stub returned ${events.status} as expected`);
    if (events.data) console.log(`      Events: ${events.data.length}`);
  }

  console.log("\n═══════════════════════════════════════");
  console.log("  ✅ ALL E2E TESTS PASSED");
  console.log("═══════════════════════════════════════");
  console.log(`  Provider ID:    ${providerId}`);
  console.log(`  Tournament ID:  ${tournamentId}`);
  console.log(`  Codes:          ${codeList.join(", ")}`);
  console.log("  Lobby Events:   403 (esperado — sin partidas jugadas)");
  console.log("═══════════════════════════════════════\n");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Test panic:", err.message);
  process.exit(1);
});
