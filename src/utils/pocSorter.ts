/**
 * Utility for sorting POC (Point of Consumption) stations along Assembly Line Conveyors.
 * 
 * Plant Physical Operating Rules:
 * 1. Stations Distance: Every station has exactly 2m distance gap (e.g., PL-01 to PL-02 has 2m gap).
 * 2. POC Capacity: On the POC, the workstation can handle ONLY 2 trolleys max in any place.
 * 3. Replenishment Tolerance: Delivery schedule has -2.0 mins tolerance (arrivals target 2m before stock exhaustion).
 * 4. Pre-Line (PL) Conveyor: Stations PL-49 down to PL-01.
 * 5. Main Line (ML) Conveyor: Stations ML-01 up to ML-50.
 */

export const STATION_GAP_METERS = 2; // Exact 2-meter gap between consecutive stations
export const POC_MAX_TROLLEYS_PER_STATION = 2; // Workstation physical footprint can hold max 2 trolleys
export const DELIVERY_TOLERANCE_MINUTES = -2.0; // Delivery target tolerance: -2 mins before stockout
export const DELIVERY_TOLERANCE_SECONDS = 120; // 120 seconds
export const BASE_STORES_TO_LINE_METERS = 190; // Base distance from Central Stores to PL-01 entrance

/**
 * Returns the POC physical space constraint (maximum trolleys allowed at station) per part.
 * Reads the explicit part `pocSpaceTrolleysMax` (e.g. from Part Master 'POC Space Constraint (no/trolley)').
 * Default plant physical limits:
 * - Swingarm, Lower Brkt, Wheel: 1 trolley max
 * - Frame, Sub Frame: 2 trolleys max
 */
export function getPartPocSpaceLimit(part?: { pocSpaceTrolleysMax?: number; description?: string; partNo?: string }): number {
  if (part?.pocSpaceTrolleysMax !== undefined && part.pocSpaceTrolleysMax > 0) {
    return Math.min(part.pocSpaceTrolleysMax, POC_MAX_TROLLEYS_PER_STATION);
  }
  if (part?.description) {
    const desc = part.description.toLowerCase();
    if (desc.includes('swingarm') || desc.includes('lower brkt') || desc.includes('wheel')) {
      return 1;
    }
    if (desc.includes('frame')) {
      return 2;
    }
  }
  return POC_MAX_TROLLEYS_PER_STATION;
}

/**
 * Validates whether a given trolley quantity exceeds the station's physical capacity for the part.
 */
export function checkPocSpaceViolation(currentTrolleys: number, part?: { pocSpaceTrolleysMax?: number; description?: string; partNo?: string }): {
  isViolation: boolean;
  limit: number;
  message: string;
} {
  const limit = getPartPocSpaceLimit(part);
  const isViolation = currentTrolleys > limit;
  return {
    isViolation,
    limit,
    message: isViolation 
      ? `POC Space Exceeded: ${currentTrolleys} trolleys at station exceeds limit of ${limit} trolley(s) for ${part?.partNo || 'part'}` 
      : `Within POC Space limit (${currentTrolleys}/${limit} trolleys)`
  };
}

export interface PocParsed {
  line: 'PL' | 'ML' | 'OTHER';
  stationNum: number;
  raw: string;
}

export function parsePocPoint(pocStr?: string): PocParsed {
  const clean = (pocStr || '').trim().toUpperCase();
  if (clean.startsWith('PL')) {
    const numMatch = clean.match(/\d+/);
    return { line: 'PL', stationNum: numMatch ? parseInt(numMatch[0], 10) : 1, raw: clean };
  }
  if (clean.startsWith('ML')) {
    const numMatch = clean.match(/\d+/);
    return { line: 'ML', stationNum: numMatch ? parseInt(numMatch[0], 10) : 1, raw: clean };
  }
  const numMatch = clean.match(/\d+/);
  return { line: 'OTHER', stationNum: numMatch ? parseInt(numMatch[0], 10) : 1, raw: clean };
}

/**
 * Calculates exact transit distance between any two POC stations.
 * Specific plant layout rule from algorithm.md Section 12:
 * PL-03 <-> PL-13 = 2 metres (Travel time = 2 / 0.72 = 2.78 seconds).
 */
export function calculateInterStationDistance(pocA?: string, pocB?: string): number {
  if (!pocA || !pocB) return 0;
  const pA = parsePocPoint(pocA);
  const pB = parsePocPoint(pocB);

  // If identical POC point, no conveyor traversal needed
  if (pA.raw === pB.raw) return 0;

  // Specific rule for PL-03 <-> PL-13
  if ((pA.raw === 'PL-03' && pB.raw === 'PL-13') || (pA.raw === 'PL-13' && pB.raw === 'PL-03')) {
    return 2; // 2 metres as per algorithm.md Section 12
  }

  // If on the same conveyor line (PL to PL or ML to ML)
  if (pA.line === pB.line) {
    return Math.abs(pA.stationNum - pB.stationNum) * STATION_GAP_METERS;
  }

  // If between Pre-Line (PL) and Main Line (ML), transfer happens at PL-01 -> ML-01 junction
  if ((pA.line === 'PL' && pB.line === 'ML') || (pA.line === 'ML' && pB.line === 'PL')) {
    const plStation = pA.line === 'PL' ? pA.stationNum : pB.stationNum;
    const mlStation = pA.line === 'ML' ? pA.stationNum : pB.stationNum;
    const plStepsToJunction = Math.abs(plStation - 1);
    const junctionSteps = 1; // 2m transfer gap
    const mlStepsFromJunction = Math.abs(mlStation - 1);
    return (plStepsToJunction + junctionSteps + mlStepsFromJunction) * STATION_GAP_METERS;
  }

  // Fallback for OTHER
  return Math.abs(pA.stationNum - pB.stationNum) * STATION_GAP_METERS;
}

/**
 * Calculates loaded distance from Stores to a POC station based on the 2m per station gap rule.
 * Base distance to PL-01 = 190m.
 * To PL-02 = 192m (190 + 2m).
 * To PL-03 = 194m (190 + 4m) -> matches plant standard (194m).
 */
export function calculateStoreToStationDistance(pocStr?: string, baseStoreMeters: number = BASE_STORES_TO_LINE_METERS): number {
  const p = parsePocPoint(pocStr);
  const stationOffset = Math.max(0, p.stationNum - 1) * STATION_GAP_METERS;
  return baseStoreMeters + stationOffset;
}

/**
 * Sorts items by POC Point along the assembly line conveyor flow direction:
 * - PL conveyor: PL-49 comes FIRST down to PL-01 LAST.
 * - ML conveyor: ML-01 comes FIRST up to ML-50 LAST.
 */
export function sortPocStations<T extends { pocPoint?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const pA = parsePocPoint(a.pocPoint);
    const pB = parsePocPoint(b.pocPoint);

    const lineOrder: Record<string, number> = { PL: 1, ML: 2, OTHER: 3 };
    if (lineOrder[pA.line] !== lineOrder[pB.line]) {
      return lineOrder[pA.line] - lineOrder[pB.line];
    }

    if (pA.line === 'PL') {
      // Pre-Line: 49 is FIRST, 01 is LAST
      return pB.stationNum - pA.stationNum;
    }

    if (pA.line === 'ML') {
      // Main Line: 01 is FIRST, 50 is LAST
      return pA.stationNum - pB.stationNum;
    }

    return pA.stationNum - pB.stationNum;
  });
}

