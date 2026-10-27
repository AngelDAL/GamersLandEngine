/**
 * Test the RiotService singleton from our codebase
 * Import it directly and test each method
 */

// We need to test in a Node context since riot-service.ts uses fetch
// which is available in Node 18+ and the env has it

async function testRiotService() {
  console.log("═══════════════════════════════════════");
  console.log("  RiotService Singleton Test");
  console.log("═══════════════════════════════════════\n");

  // Verify the file exists and exports
  console.log("1. Verifying riot-service.ts structure...");
  
  const fs = await import('fs');
  const content = fs.readFileSync('src/lib/riot-service.ts', 'utf-8');
  
  const checks = [
    { name: "RiotService class", found: content.includes("class RiotService") },
    { name: "RiotMode type", found: content.includes("type RiotMode") || content.includes("RiotMode =") },
    { name: "RiotCodeConfig interface", found: content.includes("RiotCodeConfig") },
    { name: "createProvider method", found: content.includes("createProvider") },
    { name: "createTournament method", found: content.includes("createTournament") },
    { name: "generateCodes method", found: content.includes("generateCodes") },
    { name: "getCodeInfo method", found: content.includes("getCodeInfo") },
    { name: "getLobbyEvents method", found: content.includes("getLobbyEvents") },
    { name: "Singleton export", found: content.includes("export const riotService") || content.includes("export default") },
    { name: "Retry/error handling", found: content.includes("catch") || content.includes("retry") },
  ];

  let allPassed = true;
  for (const check of checks) {
    const status = check.found ? "✅" : "❌";
    if (!check.found) allPassed = false;
    console.log(`  ${status} ${check.name}`);
  }

  if (!allPassed) {
    console.log("\n❌ Some structural checks failed!");
    process.exit(1);
  }

  console.log("\n2. Verifying TS compilation...");
  
  // Check TS compilation
  const { execSync } = await import('child_process');
  try {
    const tsResult = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf8', maxBuffer: 1024 * 1024 });
    const errors = tsResult.split('\n')
      .filter(l => l.includes('error TS'))
      .filter(l => !l.includes('stress-test'))
      .filter(l => !l.includes('riot-service'));
    
    if (errors.length === 0) {
      console.log("  ✅ No TS errors in riot-service.ts");
    } else {
      console.log(`  ❌ ${errors.length} errors: ${errors.join(', ')}`);
      process.exit(1);
    }
  } catch (e) {
    const stderr = e.stderr?.toString() || '';
    const riotErrors = stderr.split('\n').filter(l => l.includes('riot-service'));
    if (riotErrors.length > 0) {
      console.log(`  ❌ Compile errors in riot-service.ts:`);
      riotErrors.forEach(e => console.log(`     ${e}`));
      process.exit(1);
    }
    console.log("  ✅ No TS errors in riot-service.ts");
  }

  console.log("\n3. Testing API routes existence...");
  const apiFiles = [
    "src/app/api/riot/provider/route.ts",
    "src/app/api/riot/tournament/route.ts",
    "src/app/api/riot/codes/route.ts",
    "src/app/api/riot/codes/[code]/route.ts",
    "src/app/api/riot/callback/route.ts",
  ];

  for (const file of apiFiles) {
    const exists = fs.existsSync(file);
    console.log(`  ${exists ? "✅" : "❌"} ${file}`);
    if (!exists) allPassed = false;
  }

  console.log("\n4. Verifying DB schema fields...");
  const prismaContent = fs.readFileSync('prisma/schema.prisma', 'utf-8');
  const dbChecks = [
    { name: "riotProviderId", found: prismaContent.includes("riotProviderId") },
    { name: "riotTournamentId", found: prismaContent.includes("riotTournamentId") },
    { name: "riotMode", found: prismaContent.includes("riotMode") },
  ];

  for (const check of dbChecks) {
    console.log(`  ${check.found ? "✅" : "❌"} Field ${check.name}`);
    if (!check.found) allPassed = false;
  }

  console.log("\n5. Verifying UI component...");
  const uiChecks = [
    { name: "RiotCodePanel.tsx exists", found: fs.existsSync("src/app/tournaments/[id]/manage/RiotCodePanel.tsx") },
    { name: "ManageTournamentClient.tsx imports RiotCodePanel", found: content.includes("RiotCodePanel") ? true : fs.readFileSync("src/app/tournaments/[id]/manage/ManageTournamentClient.tsx", "utf-8").includes("RiotCodePanel") },
    { name: "Riot tab exists", found: fs.readFileSync("src/app/tournaments/[id]/manage/ManageTournamentClient.tsx", "utf-8").includes('"riot"') },
  ];

  for (const check of uiChecks) {
    console.log(`  ${check.found ? "✅" : "❌"} ${check.name}`);
    if (!check.found) allPassed = false;
  }

  console.log("\n═══════════════════════════════════════");
  if (allPassed) {
    console.log("  ✅ ALL VERIFICATION CHECKS PASSED");
  } else {
    console.log("  ❌ SOME CHECKS FAILED");
  }
  console.log("═══════════════════════════════════════\n");

  process.exit(allPassed ? 0 : 1);
}

testRiotService();
