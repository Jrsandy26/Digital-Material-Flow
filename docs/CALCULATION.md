# Mizusumashi (Water Spider) Delivery & Grouping Calculations
## Operational Specification: 11 Frame Trolleys Required Per Hour (TVS Dual-Operator Split & Line-Balancing Rule)

This document details the mathematical model, grouping logic, and hourly timeline execution of the **Mizusumashi** (Water Spider) material replenishment system utilizing **Jumbo Tuggers** (3-trolley capacity) under a **27.9-second Takt Time** constraint, updated strictly for the **11 Frame Trolleys per Hour** operational requirement.

---

## 1. Core Mathematical Model & Formulas

The replenishment engine operates on a standardized kanban model to guarantee zero line-stops without accumulating excess inventory at the Point of Consumption (POC).

### Formula 1: Hourly Production Demand ($P_h$)
The volume of vehicles produced per hour is a function of the assembly line's Takt Time:
$$P_h = \frac{3600 \text{ seconds}}{T_{takt}} = \frac{3600}{27.9} \approx 129.03 \text{ vehicles/hour}$$

### Formula 2: Hourly Material Consumption Rate ($C_i$)
The hourly quantity required for a specific material part $i$:
$$C_i = P_h \times U_i$$
*Where $U_i$ is the number of usages of part $i$ per vehicle (for all parts here, $U_i = 1$).*

### Formula 3: Hourly Trolley Requirement ($T_i$) & Operator Division Rule
Under plant lean logistics:
* **Gross Frame Demand across assembly line**: $\lceil 129 / 6 \rceil = 22\text{ Frame trolleys/hr}$.
* **Operator Division Rule**: Heavy frame delivery is divided between two Water Spiders; this operator's planned requirement is strictly **11 Frame trolleys per hour**.
$$T_{\text{frame}} = \mathbf{11\text{ trolleys/hour}}$$

### Formula 4: Operator Trip Cycle Time ($T_{cycle}$)
The duration of a single delivery run consisting of picking, transit, unloading, and returning:
$$T_{cycle} = \sum (t_{pick} \times n) + \left(\frac{D_{load}}{v_{load}}\right) + \sum (t_{drop} \times n) + \left(\frac{D_{empty}}{v_{empty}}\right) + t_{buffer}$$
*Where:*
*   $n$ = Number of trolleys delivered in the trip (Max 3 for Jumbo)
*   $t_{pick}$ = Picking/coupling time per trolley (15 seconds)
*   $D_{load}, D_{empty}$ = Load moving and empty return distances (meters)
*   $v_{load}, v_{empty}$ = Tugger speed loaded ($1.4\text{ m/s}$) and empty ($2.2\text{ m/s}$)
*   $t_{drop}$ = Decoupling and drop-off time per trolley (15 seconds)
*   $t_{buffer}$ = Operator buffer time for safety checks, hookups, or path adjustments (10 seconds)

---

## 2. Input Data Analysis (Updated for 11 Frame Trolleys / Hour)

| S.No | Part No | Description | Bin Capacity ($B_i$) | Store | POC Point | Usages ($U_i$) | Required Trolleys/hr ($T_i$) | Load Dist (m) | Return Dist (m) |
|:---:|:---|:---|:---:|:---|:---:|:---:|:---:|:---:|:---:|
| **1** | **KE121530** | **FRAME, SCOOTER COMP** | **6** | E 10-17 | PL-03 | 1 | **11** | 198 | 198 |
| **2** | **KE110470** | **WHEEL ASSY DISC TUBELESS** | 30 | B 15,16 | PL-13 | 1 | **4** | 204 | 204 |
| **3** | **KE121500** | **SUB FRAME COMP** | 64 | E 07,09 | PL-03 | 1 | **3** | 186 | 186 |
| **4** | **KE090530** | **SWINGARM SUB ASSY DRUM** | 60 | E 03,04 | PL-03 | 1 | **2** | 194 | 194 |
| **5** | **K6100890** | **LOWER BRKT COMP** | 80 | E 05,06 | PL-13 | 1 | **2** | 278 | 278 |

*   **Total Trolleys to Deliver per Hour** = $11 + 4 + 3 + 2 + 2 = \mathbf{22\text{ trolleys/hour}}$.
*   **Jumbo Tugger Carrying Capacity** = **3 trolleys**.
*   **Required Trips per Hour**:
    $$\mathbf{N_{\text{trips}}} = \left\lceil \frac{22}{3} \right\rceil = \mathbf{8\text{ trips/hour}}$$
*   **Total Trolley Slots Available in Schedule** = $8 \times 3 = 24\text{ slots}$ (22 utilized, 2 buffer slots in Trip 8).

---

## 3. Frame Reservation & Balanced Bin-Packing Logic

Because Frame has the highest delivery frequency (11 trolleys/hr, needing 1 trolley every $5.45\text{ minutes}$), we distribute the 11 Frames across all 8 trips:
1. **Base Frame Reservation**: 1 Frame in each of the 8 trips ($8 \times 1 = 8\text{ Frames}$).
2. **Residual Frame Allocation**: Distribute the remaining $11 - 8 = 3$ Frames into early trips:
   * **Trip 1, 2, 3**: **2 Frames each**
   * **Trip 4, 5, 6, 7, 8**: **1 Frame each**
   * **Sum of Frames**: $2 + 2 + 2 + 1 + 1 + 1 + 1 + 1 = \mathbf{11\text{ Frame Trolleys}}$.
3. **Co-loading the remaining 11 Trolleys**:
   * Wheel Assy (4 trolleys): Trips 1, 3, 4, 6
   * Sub Frame (3 trolleys): Trips 2, 5, 7
   * Swingarm (2 trolleys): Trips 4, 7
   * Lower Brkt (2 trolleys): Trips 5, 6

---

## 4. Hour-by-Hour Operator Timeline Matrix (07:00 AM - 08:00 AM)

Below is the step-by-step physical breakdown of the operator's tasks to deliver all 22 trolleys across **8 trips** within the 60-minute window:

| Trip | Time Range | Destination | Batch Content (3 Trolleys Max) | Step-by-Step Activities & Durations | Total Trip Time |
|:---:|:---|:---:|:---|:---|:---:|
| **1** | **07:00 - 07:05 AM** | **PL-03 / PL-13** | **2x Frame** + **1x Wheel** | 1. **Pick & Couple**: Load 2x Frame (E10) + 1x Wheel (B15) (45s)<br>2. **Transit Out**: Drive loaded to PL-03 & PL-13 ($204\text{m} / 1.4\text{ m/s} \approx 146\text{s}$)<br>3. **Unload & Place**: Decouple fulls & dock to line racks (45s)<br>4. **Transit Return**: Empty return corridor ($204\text{m} / 2.2\text{ m/s} \approx 93\text{s}$)<br>5. **Buffer / Prep**: (10s) | **5 min 39 sec** |
| **2** | **07:06 - 07:11 AM** | **PL-03** | **2x Frame** + **1x Sub Frame** | 1. **Pick & Couple**: Load 2x Frame (E10) + 1x Sub Frame (E07) (45s)<br>2. **Transit Out**: Drive to PL-03 ($198\text{m} / 1.4\text{ m/s} \approx 141\text{s}$)<br>3. **Unload & Place**: Decouple & dock (45s)<br>4. **Transit Return**: Drive return ($198\text{m} / 2.2\text{ m/s} \approx 90\text{s}$)<br>5. **Buffer**: (10s) | **5 min 31 sec** |
| **3** | **07:12 - 07:17 AM** | **PL-03 / PL-13** | **2x Frame** + **1x Wheel** | 1. **Pick & Couple**: Load 2x Frame + 1x Wheel (45s)<br>2. **Transit Out**: Drive to PL-03 & PL-13 (146s)<br>3. **Unload**: Decouple & dock (45s)<br>4. **Transit Return**: Drive return (93s)<br>5. **Buffer**: (10s) | **5 min 39 sec** |
| **4** | **07:18 - 07:23 AM** | **PL-03 / PL-13** | **1x Frame** + **1x Swingarm** + **1x Wheel** | 1. **Pick & Couple**: Load at E10, E03, B15 (45s)<br>2. **Transit Out**: Drive to PL-03 & PL-13 (146s)<br>3. **Unload**: Decouple fulls (45s)<br>4. **Transit Return**: Return to store (93s)<br>5. **Buffer**: (10s) | **5 min 39 sec** |
| **5** | **07:24 - 07:30 AM** | **PL-03 / PL-13** | **1x Frame** + **1x Lower Brkt** + **1x Sub Frame** | 1. **Pick & Couple**: Load at E10, E05, E07 (45s)<br>2. **Transit Out**: Drive to PL-03 & PL-13 ($278\text{m} / 1.4\text{ m/s} \approx 199\text{s}$)<br>3. **Unload**: Decouple fulls (45s)<br>4. **Transit Return**: Return ($278\text{m} / 2.2\text{ m/s} \approx 126\text{s}$)<br>5. **Buffer**: (10s) | **7 min 05 sec** |
| **6** | **07:31 - 07:38 AM** | **PL-03 / PL-13** | **1x Frame** + **1x Wheel** + **1x Lower Brkt** | 1. **Pick & Couple**: Load at E10, B15, E05 (45s)<br>2. **Transit Out**: Drive to PL-13 ($278\text{m} / 1.4\text{ m/s} \approx 199\text{s}$)<br>3. **Unload**: Decouple fulls (45s)<br>4. **Transit Return**: Return (126s)<br>5. **Buffer**: (10s) | **7 min 05 sec** |
| **7** | **07:39 - 07:44 AM** | **PL-03** | **1x Frame** + **1x Sub Frame** + **1x Swingarm** | 1. **Pick & Couple**: Load at E10, E07, E03 (45s)<br>2. **Transit Out**: Drive to PL-03 ($198\text{m} / 1.4\text{ m/s} \approx 141\text{s}$)<br>3. **Unload**: Decouple fulls (45s)<br>4. **Transit Return**: Return (90s)<br>5. **Buffer**: (10s) | **5 min 31 sec** |
| **8** | **07:45 - 07:49 AM** | **PL-03** | **1x Frame** + *(2 Empty Slots)* | 1. **Pick & Couple**: Load final 1x Frame (15s)<br>2. **Transit Out**: Drive to PL-03 ($198\text{m} / 1.4\text{ m/s} \approx 141\text{s}$)<br>3. **Unload**: Decouple 1 trolley (15s)<br>4. **Transit Return**: Return (90s)<br>5. **Buffer**: (10s) | **4 min 31 sec** |

### Workload & Utilization Summary:
*   **Total Active Replenishment Time**: **46 minutes, 40 seconds**.
*   **Idle / Buffer Time (07:49 AM - 08:00 AM)**: **13 minutes, 20 seconds** (available for operator rest, housekeeping, and pre-shift checks).
*   **Operator Workload Efficiency ($\eta$)**: $\frac{46.67\text{ min}}{60.00\text{ min}} = \mathbf{77.8\%}$ (well within the ideal ergonomic ceiling of $\le 85\%$).

---

## 5. Demand Reconciliation Audit

| Part Number | Description | Required Trolleys / hr | Planned Delivered Trolleys | Reconciliation Status |
|:---|:---|:---:|:---:|:---:|
| **KE121530** | FRAME, SCOOTER COMP | **11** | **11** | ✅ 100% Demand Met |
| **KE110470** | WHEEL ASSY DISC TUBELESS | **4** | **4** | ✅ 100% Demand Met |
| **KE121500** | SUB FRAME COMP | **3** | **3** | ✅ 100% Demand Met |
| **KE090530** | SWINGARM SUB ASSY DRUM | **2** | **2** | ✅ 100% Demand Met |
| **K6100890** | LOWER BRKT COMP | **2** | **2** | ✅ 100% Demand Met |
| **TOTAL** | | **22** | **22** | **Zero Starvation / Zero Surplus** |

---

## 6. Line Stop Prevention Guardrails

1.  **Safety Stock Threshold**:
    Each POC holds an initial stock carryover (1 trolley for standard parts, 1 or 2 for Frame) at the start of the simulation (`07:00:00 AM`).
2.  **Minimum Coverage Time Scheduling**:
    $$T_{deplete} = \frac{\text{Current Line Qty}}{\text{Consumption Rate per Second}}$$
    The system dispatches trips proactively before $T_{deplete}$ reaches zero, ensuring continuous feed and 100% assembly line uptime.
