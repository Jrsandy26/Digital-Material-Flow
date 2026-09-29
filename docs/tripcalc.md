# Digital Material Flow Planning — Grouping Algorithm Test Sheet

This document serves as the official test vector and specification sheet for the Mizusumashi (Jumbo Trolley) Auto-Grouping and Replenishment Scheduling Algorithm.

---

## 1. Test Input Data

The following table lists the physical constraints, demand metrics, and layout distances for the active materials to be routed.

| S.NO | Part No | Description | bin/trolley | Qty Per Trolley | Store | POC Point | Usages / hr | Trolleys Required / hr | Load Distance (M) | Empty Distance (M) | POC Space Constraint |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | KE090530 | SWINGARM SUB ASSY DRUM | Trolley | 60 | E 03,04 | PL-03 | 1 | 2 | 194 | 194 | 1 |
| 2 | K6100890 | LOWER BRKT COMP | Trolley | 80 | E 05,06 | PL-13 | 1 | 2 | 278 | 278 | 1 |
| 3 | KE121500 | SUB FRAME COMP | Trolley | 64 | E 07,09 | PL-03 | 1 | 3 | 186 | 186 | 2 |
| 4 | KE121530 | FRAME | Trolley | 6 | E 10-17 | PL-03 | 1 | 11 | 198 | 198 | 2 |
| 5 | KE110470 | WHEEL ASSY DISC TUBELESS | Trolley | 30 | B 15,16 | PL-13 | 1 | 4 | 204 | 204 | 1 |

### Operational Assumptions
* **Jumbo Trolley Capacity**: Maximum of 3 trolleys per delivery trip.
* **Operator Division Rule**: The physical demand of the line requires 22 Frames per hour. However, because this is split across two independent delivery operators handling different parts, **consider exactly 11 Frames per hour** for the target operator's planning.

---

## 2. Mathematical Formulations & Steps

### Step 1: Calculate Total Hourly Trolley Demand
$$\text{Total Trolleys} = \sum_{i} \text{Trolleys Required}_i$$
$$\text{Total Trolleys} = 11 \text{ (Frame)} + 4 \text{ (Wheel)} + 3 \text{ (Sub Frame)} + 2 \text{ (Swingarm)} + 2 \text{ (Lower Bracket)} = 22 \text{ Trolleys/hr}$$

### Step 2: Calculate Required Trips per Hour
$$\text{Required Trips} = \left\lceil \frac{\text{Total Trolleys}}{\text{Jumbo Capacity}} \right\rceil$$
$$\text{Required Trips} = \left\lceil \frac{22}{3} \right\rceil = 8 \text{ Trips/hr}$$

Total available slots across the 8 trips = $8 \times 3 = 24$ slots. Since demand is 22 trolleys, there will be exactly 2 empty/buffer slots remaining in the schedule.

### Step 3: Rank Parts by Priority Score
Priority is determined dynamically using consumption rate and remaining coverage time.
1. **FRAME** (Priority 1) — Demands 11 trolleys/hr (Consumption interval of ~5.45 mins per trolley).
2. **WHEEL ASSY** (Priority 2) — Demands 4 trolleys/hr.
3. **SUB FRAME COMP** (Priority 3) — Demands 3 trolleys/hr.
4. **SWINGARM** (Priority 4) — Demands 2 trolleys/hr.
5. **LOWER BRKT COMP** (Priority 5) — Demands 2 trolleys/hr.

### Step 4: Frame Reservation & Balanced Distribution
Because Frame has an exceptionally high demand (11 trolleys/hr), we must distribute Frames across all trips to prevent stockouts at the POC:
* **Base Reservation**: Place at least 1 Frame in each of the 8 trips (8 Frames allocated).
* **Residual Frame Allocation**: Distribute the remaining $11 - 8 = 3$ Frames into the earliest trips (Trips 1, 2, and 3).
* **Frame Distribution Result**:
  * Trips 1, 2, and 3: **2 Frames each**
  * Trips 4, 5, 6, 7, and 8: **1 Frame each**

---

## 3. Step-by-Step Bin-Packing and Replenishment Allocation

We fill the remaining slots sequentially from Trip 1 to Trip 8 using a round-robin greedy algorithm based on remaining part demands:

* **Trip 1 (Has 2 Frames, 1 slot left)**: Add **1 Wheel** (Wheel remaining: 3)
* **Trip 2 (Has 2 Frames, 1 slot left)**: Add **1 Sub Frame** (Sub Frame remaining: 2)
* **Trip 3 (Has 2 Frames, 1 slot left)**: Add **1 Wheel** (Wheel remaining: 2)
* **Trip 4 (Has 1 Frame, 2 slots left)**: Add **1 Swingarm** (remaining: 1) and **1 Wheel** (remaining: 1)
* **Trip 5 (Has 1 Frame, 2 slots left)**: Add **1 Lower Bracket** (remaining: 1) and **1 Sub Frame** (remaining: 1)
* **Trip 6 (Has 1 Frame, 2 slots left)**: Add **1 Wheel** (remaining: 0) and **1 Lower Bracket** (remaining: 0)
* **Trip 7 (Has 1 Frame, 2 slots left)**: Add **1 Sub Frame** (remaining: 0) and **1 Swingarm** (remaining: 0)
* **Trip 8 (Has 1 Frame, 2 slots left)**: All remaining demands are 0. The remaining 2 slots are **Empty**.

---

## 4. Final Optimized Delivery Plan (Test Output Vectors)

This table contains the exact, verified trip-by-trip material output plan. Use these vectors to validate your algorithm's outputs.

| Trip S.NO | Slot 1 (Part No) | Slot 2 (Part No) | Slot 3 (Part No) | One-Way Route Distance (M)* | Round-Trip Distance (M) |
|---|---|---|---|---|---|
| **Trip 1** | KE121530 (Frame) | KE121530 (Frame) | KE110470 (Wheel) | 204 | 408 |
| **Trip 2** | KE121530 (Frame) | KE121530 (Frame) | KE121500 (Sub Frame) | 198 | 396 |
| **Trip 3** | KE121530 (Frame) | KE121530 (Frame) | KE110470 (Wheel) | 204 | 408 |
| **Trip 4** | KE121530 (Frame) | KE090530 (Swingarm) | KE110470 (Wheel) | 204 | 408 |
| **Trip 5** | KE121530 (Frame) | K6100890 (Lower Brkt) | KE121500 (Sub Frame) | 278 | 556 |
| **Trip 6** | KE121530 (Frame) | KE110470 (Wheel) | K6100890 (Lower Brkt) | 278 | 556 |
| **Trip 7** | KE121530 (Frame) | KE121500 (Sub Frame) | KE090530 (Swingarm) | 198 | 396 |
| **Trip 8** | KE121530 (Frame) | *Empty* | *Empty* | 198 | 396 |
| **TOTAL** | | | | **1,766 M** | **3,532 M** |

*\*Note: The one-way route distance is determined as the maximum load moving distance of any loaded material in that specific trip, assuming a consolidated dispatch delivery run.*

### Demand Reconciliation Check

| Part Number | Description | Required Trolleys / hr | Planned Trolleys / hr | Reconciliation Status |
|---|---|---|---|---|
| **KE121530** | FRAME | 11 | 11 | ✅ Demands Balanced |
| **KE110470** | WHEEL ASSY | 4 | 4 | ✅ Demands Balanced |
| **KE121500** | SUB FRAME | 3 | 3 | ✅ Demands Balanced |
| **KE090530** | SWINGARM | 2 | 2 | ✅ Demands Balanced |
| **K6100890** | LOWER BRKT COMP | 2 | 2 | ✅ Demands Balanced |
