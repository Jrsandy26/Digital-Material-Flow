/**
 * TVS Motor Company - Mizusumashi Replenishment System
 * Automated Verification Script: Test Case TC-MIZU-S1H1-001
 * Shift 1 First Hour (07:00 AM - 08:00 AM)
 * Target Demand: 11 Frame + 4 Wheel + 3 Sub Frame + 2 Swingarm + 2 Lower Bracket = 22 Trolleys
 */

const assert = (condition, msg) => {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${msg}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${msg}`);
  }
};

console.log("================================================================================");
console.log("TEST CASE TC-MIZU-S1H1-001: SHIFT 1 FIRST HOUR (07:00 AM - 08:00 AM)");
console.log("================================================================================\n");

// 1. Demand & Capacity Inputs
const JUMBO_CAPACITY = 3;
const partsMaster = {
  FRAME: { partNo: 'KE121530', desc: 'FRAME, SCOOTER COMP', binCap: 6, demandTrolleys: 11, maxPoc: 2, dist: 198 },
  WHEEL: { partNo: 'KE110470', desc: 'WHEEL ASSY DISC TUBELESS', binCap: 30, demandTrolleys: 4, maxPoc: 1, dist: 204 },
  SUB_FRAME: { partNo: 'KE121500', desc: 'SUB FRAME COMP', binCap: 64, demandTrolleys: 3, maxPoc: 2, dist: 186 },
  SWINGARM: { partNo: 'KE090530', desc: 'SWINGARM SUB ASSY DRUM', binCap: 60, demandTrolleys: 2, maxPoc: 1, dist: 194 },
  LOWER_BRKT: { partNo: 'K6100890', desc: 'LOWER BRKT COMP', binCap: 80, demandTrolleys: 2, maxPoc: 1, dist: 278 },
};

// 2. Total Demand Validation
const totalTrolleys = Object.values(partsMaster).reduce((s, p) => s + p.demandTrolleys, 0);
assert(totalTrolleys === 22, `Total hourly demand must be exactly 22 trolleys (Got: ${totalTrolleys})`);

// 3. Trips Requirement Validation
const expectedTrips = Math.ceil(totalTrolleys / JUMBO_CAPACITY);
assert(expectedTrips === 8, `Required trips must be ceil(22/3) = 8 trips (Got: ${expectedTrips})`);

// 4. Master 8-Trip Delivery Schedule
const trips = [
  { tripNo: 1, slot1: 'FRAME', slot2: 'FRAME', slot3: 'WHEEL', maxDist: 204 },
  { tripNo: 2, slot1: 'FRAME', slot2: 'FRAME', slot3: 'SUB_FRAME', maxDist: 198 },
  { tripNo: 3, slot1: 'FRAME', slot2: 'FRAME', slot3: 'WHEEL', maxDist: 204 },
  { tripNo: 4, slot1: 'FRAME', slot2: 'SWINGARM', slot3: 'WHEEL', maxDist: 204 },
  { tripNo: 5, slot1: 'FRAME', slot2: 'LOWER_BRKT', slot3: 'SUB_FRAME', maxDist: 278 },
  { tripNo: 6, slot1: 'FRAME', slot2: 'WHEEL', slot3: 'LOWER_BRKT', maxDist: 278 },
  { tripNo: 7, slot1: 'FRAME', slot2: 'SUB_FRAME', slot3: 'SWINGARM', maxDist: 198 },
  { tripNo: 8, slot1: 'FRAME', slot2: null, slot3: null, maxDist: 198 },
];

assert(trips.length === 8, "Trips count must be 8");

// 5. Part-level Demand Reconciliation
const deliveredCounts = { FRAME: 0, WHEEL: 0, SUB_FRAME: 0, SWINGARM: 0, LOWER_BRKT: 0 };
let totalDelivered = 0;

trips.forEach(t => {
  [t.slot1, t.slot2, t.slot3].forEach(slot => {
    if (slot) {
      deliveredCounts[slot]++;
      totalDelivered++;
    }
  });
});

assert(deliveredCounts.FRAME === 11, `Frame delivered must be 11 (Got: ${deliveredCounts.FRAME})`);
assert(deliveredCounts.WHEEL === 4, `Wheel delivered must be 4 (Got: ${deliveredCounts.WHEEL})`);
assert(deliveredCounts.SUB_FRAME === 3, `Sub Frame delivered must be 3 (Got: ${deliveredCounts.SUB_FRAME})`);
assert(deliveredCounts.SWINGARM === 2, `Swingarm delivered must be 2 (Got: ${deliveredCounts.SWINGARM})`);
assert(deliveredCounts.LOWER_BRKT === 2, `Lower Bracket delivered must be 2 (Got: ${deliveredCounts.LOWER_BRKT})`);
assert(totalDelivered === 22, `Total delivered trolleys must be 22 (Got: ${totalDelivered})`);

// 6. Frame Distribution Verification
// Base: 1 frame per trip. Residual 3 frames in early trips 1, 2, 3.
const framePerTrip = trips.map(t => [t.slot1, t.slot2, t.slot3].filter(s => s === 'FRAME').length);
assert(JSON.stringify(framePerTrip) === JSON.stringify([2, 2, 2, 1, 1, 1, 1, 1]), 
  `Frame distribution across trips must be [2, 2, 2, 1, 1, 1, 1, 1] (Got: ${JSON.stringify(framePerTrip)})`);

// 7. Cycle Time & Workload Calculations
const pickPerTrolleySec = 15;
const dropPerTrolleySec = 15;
const bufferSec = 10;
const vLoad = 1.4; // m/s
const vEmpty = 2.2; // m/s

let totalActiveTimeSec = 0;

trips.forEach(t => {
  const loadedTrolleys = [t.slot1, t.slot2, t.slot3].filter(Boolean).length;
  const pickSec = loadedTrolleys * pickPerTrolleySec;
  const transitOutSec = t.maxDist / vLoad;
  const dropSec = loadedTrolleys * dropPerTrolleySec;
  const transitRetSec = t.maxDist / vEmpty;
  const tripTimeSec = pickSec + transitOutSec + dropSec + transitRetSec + bufferSec;
  t.tripTimeSec = tripTimeSec;
  totalActiveTimeSec += tripTimeSec;
});

const totalActiveMin = totalActiveTimeSec / 60;
const idleMin = 60 - totalActiveMin;
const operatorUtilization = (totalActiveMin / 60) * 100;

console.log(`\n--- Workload Audit ---`);
console.log(`Total Active Time: ${totalActiveMin.toFixed(2)} min (${Math.floor(totalActiveMin)}m ${Math.round((totalActiveMin % 1) * 60)}s)`);
console.log(`Idle / Buffer Time: ${idleMin.toFixed(2)} min (${Math.floor(idleMin)}m ${Math.round((idleMin % 1) * 60)}s)`);
console.log(`Operator Utilization: ${operatorUtilization.toFixed(1)}%`);

assert(operatorUtilization <= 85.0, `Utilization must be within ergonomic limit <= 85% (Got: ${operatorUtilization.toFixed(1)}%)`);
assert(totalActiveMin < 60.0, "All 8 trips must complete within the 60-minute window");

// 8. Line Starvation Audit (Continuous Stock Proof)
// Frame consumption interval: 5.4545 minutes per trolley (60 / 11)
const frameIntervalMin = 60 / 11;
let currentFrameStockMin = frameIntervalMin; // 1 trolley initial stock
let currentTimeMin = 0;

console.log(`\n--- Frame Timeline & Zero-Starvation Audit ---`);
trips.forEach(t => {
  const frameCount = [t.slot1, t.slot2, t.slot3].filter(s => s === 'FRAME').length;
  const leadTimeMin = (frameCount * pickPerTrolleySec + (t.maxDist / vLoad) + frameCount * dropPerTrolleySec) / 60;
  const deliveryMin = currentTimeMin + leadTimeMin;
  
  // Verify material arrives BEFORE current stock runs out
  assert(deliveryMin <= currentFrameStockMin, 
    `Trip ${t.tripNo} Frame delivery at ${deliveryMin.toFixed(2)}m must precede stockout at ${currentFrameStockMin.toFixed(2)}m`);
  
  // Add buffer coverage
  currentFrameStockMin += (frameCount * frameIntervalMin);
  console.log(`  Trip ${t.tripNo}: Delivered ${frameCount} Frame(s) at ${deliveryMin.toFixed(2)}m. Line covered until ${currentFrameStockMin.toFixed(2)}m.`);
  currentTimeMin += (t.tripTimeSec / 60);
});

assert(currentFrameStockMin >= 60.0, `Final frame coverage must extend to at least 60.0m (Got: ${currentFrameStockMin.toFixed(2)}m)`);

console.log("\n================================================================================");
console.log("🎉 ALL TEST SUITE ASSERTIONS PASSED WITH ZERO DEFECTS!");
console.log("================================================================================\n");
