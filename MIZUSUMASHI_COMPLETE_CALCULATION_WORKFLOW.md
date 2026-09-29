# TVS MOTOR COMPANY — MIZUSUMASHI (WATER SPIDER) DIGITAL MATERIAL FLOW & LINE FEEDING SYSTEM
## Complete Architectural Specification, Calculation Engine, Formulas & End-to-End Workflow
### Special Operating Standard: 11 Frame Trolleys Required Per Hour (Operator Division & Line-Balancing Specification)

> **Target Audience / AI Persona:** Optimized for deep parsing by advanced LLMs (e.g., Anthropic Claude 3.5 / 3.7 Sonnet), manufacturing systems architects, industrial engineers, and full-stack software developers.  
> **Document Version:** 3.0.0 (Updated for 11 Frame Trolleys / Hour Standard)  
> **Scope:** Input schema, mathematical formulas, 11 Frame Trolley line-balancing rule, 22 Trolley total hourly demand, 8-Trip consolidated packing, 11-Trip takt-paced execution, multi-stop routing logic, Gantt dual-sublane visualization, and Excel reporting.

---

# Table of Contents
1. [Executive Summary & The 11 Frame Trolleys/Hour Standard](#1-executive-summary--the-11-frame-trolleyshour-standard)
2. [Domain Concepts & Standard Terminology](#2-domain-concepts--standard-terminology)
3. [Input Data Entities & System Schema](#3-input-data-entities--system-schema)
4. [Mathematical Formulation & Calculations (Step-by-Step)](#4-mathematical-formulation--calculations-step-by-step)
   - [4.1 Takt Time & Hourly Production Demand](#41-takt-time--hourly-production-demand)
   - [4.2 The 11 Frame Trolley Line-Balancing & Operator Division Rule](#42-the-11-frame-trolley-line-balancing--operator-division-rule)
   - [4.3 Part Consumption Rates & Effective Coverage Interval](#43-part-consumption-rates--effective-coverage-interval)
   - [4.4 Bin / Trolley Buffer Life & Coverage Times](#44-bin--trolley-buffer-life--coverage-times)
   - [4.5 Initial Line-Side Stock (POC) Depletion Lifecycle](#45-initial-line-side-stock-poc-depletion-lifecycle)
   - [4.6 Multi-Stop Routing & Inter-Station 2-Meter Spacing Rule](#46-multi-stop-routing--inter-station-2-meter-spacing-rule)
   - [4.7 Handling Steps & Total Cycle Time ($T_{\text{cycle}}$)](#47-handling-steps--total-cycle-time-t_textcycle)
   - [4.8 Lead Time to POC & Delivery Minute Calculation](#48-lead-time-to-poc--delivery-minute-calculation)
   - [4.9 Zero-Outage Takt-Paced Dispatch Scheduling](#49-zero-outage-takt-paced-dispatch-scheduling)
   - [4.10 Delivered Part Exhaustion / Stock-Out Minute ($T_{\text{empty}}$)](#410-delivered-part-exhaustion--stock-out-minute-t_textempty)
   - [4.11 Shift Demand, Fleet Sizing & Operator Utilization (MHF)](#411-shift-demand-fleet-sizing--operator-utilization-mhf)
5. [The 11 Frame Trolley Grouping & Bin-Packing Engine](#5-the-11-frame-trolley-grouping--bin-packing-engine)
   - [5.1 Model A: The 8-Trip Lean Consolidated Schedule (22 Trolleys / 8 Trips)](#51-model-a-the-8-trip-lean-consolidated-schedule-22-trolleys--8-trips)
   - [5.2 Model B: The 11-Trip Sequential Takt-Paced Schedule (1 Frame per Trip)](#52-model-b-the-11-trip-sequential-takt-paced-schedule-1-frame-per-trip)
6. [Standard Work Combination Table (SWCT) & Gantt Engine](#6-standard-work-combination-table-swct--gantt-engine)
   - [6.1 Step Duration Breakdown (Manual, Auto, Walking, Rest)](#61-step-duration-breakdown-manual-auto-walking-rest)
   - [6.2 Anti-Collision Dual-Sublane Inventory Visualization](#62-anti-collision-dual-sublane-inventory-visualization)
7. [Excel Export Format & Workbook Structure](#7-excel-export-format--workbook-structure)
8. [Concrete End-to-End Simulation Example (07:00 AM - 08:00 AM)](#8-concrete-end-to-end-simulation-example-0700-am---0800-am)
9. [Software Codebase Architecture & File Mapping](#9-software-codebase-architecture--file-mapping)

---

# 1. Executive Summary & The 11 Frame Trolleys/Hour Standard

The **Mizusumashi (水澄まし / "Water Spider")** system at TVS Motor Company is a Lean Material Handling Framework designed to feed automotive assembly lines (specifically high-speed two-wheeler lines such as TVS iQube, Jupiter, Apache) with precision, zero line stoppages, and minimal line-side clutter.

### The 11 Frame Trolleys / Hour Engineering Constraint:
At an assembly line target of **129 vehicles/hour** with a Frame bin capacity of **6 units/trolley**, the gross line consumption is:
$$\text{Gross Line Demand} = \frac{129 \text{ vehicles/hr}}{6 \text{ units/trolley}} = 21.5 \approx 22 \text{ Frame trolleys/hour}$$

Because of the physical size, weight, and ergonomic handling envelope of motorcycle frames, the plant logistics architecture enforces the **TVS Operator Division & Line-Balancing Rule**:
* **Frame Delivery is Split Evenly Between Two Synchronized Operators** (or two distinct line-side feed bays).
* **Target Operator Planned Requirement = Exactly 11 Frame Trolleys / Hour.**
* **Total Hourly Trolley Demand Across All Parts for this Operator = 22 Trolleys / Hour:**
  $$\mathbf{\text{Total Hourly Demand}} = 11 \text{ (Frame)} + 4 \text{ (Wheel)} + 3 \text{ (Sub Frame)} + 2 \text{ (Swingarm)} + 2 \text{ (Lower Brkt)} = \mathbf{22\text{ trolleys/hour}}$$
* **Required Jumbo Tugger Trips per Hour ($C_{\text{mode}} = 3$):**
  $$\mathbf{N_{\text{trips}}} = \left\lceil \frac{22 \text{ trolleys}}{3 \text{ capacity}} \right\rceil = \mathbf{8\text{ Trips/hour}}$$

---

# 2. Domain Concepts & Standard Terminology

| Acronym / Term | Japanese / Industrial Origin | Technical Definition |
| :--- | :--- | :--- |
| **Mizusumashi** | 水澄まし ("Whirligig beetle" / Water Spider) | A dedicated, highly trained logistics operator who performs standardized, repetitive milk-runs from the central store to assembly line stations. |
| **POC** | Point of Consumption | The specific station bin/chute alongside the moving conveyor where assembly operators take parts to fit onto the vehicle. |
| **SWCT** | Standard Work Combination Table | A standardized lean tool combining manual work, automated travel, walking, and waiting against takt time. |
| **Jumbo Trolley / Tugger** | Electric Tow Train | An electric tow vehicle that hitches up to 3 trolleys in a train to distribute materials across multiple POCs. |
| **Takt Time** | Taktzeit (German for "cycle/beat") | The maximum allowable time to assemble one vehicle in order to meet customer demand: $\frac{\text{Net Available Working Time}}{\text{Customer Demand}}$. |
| **MHF** | Material Handling Force | The number of operators required to handle logistics without exceeding 100% human utilization. |
| **Buffer Coverage** | Line Inventory Life | The duration (in minutes or seconds) that a quantity of parts can sustain continuous production without line stoppage. |
| **Initial POC Stock** | Opening Stock Carryover | Pre-staged stock already sitting at the POC at minute $0.0$ when the shift starts (typically 1 or 2 trolleys). |

---

# 3. Input Data Entities & System Schema

The following table lists the physical constraints, demand metrics, and layout distances for the active materials to be routed under the **11 Frame Trolleys / Hour** plan:

### Part Master Table (TVS iQube Line Feeding Benchmark):
| S.No | Part No | Description | Trolley Capacity ($C_{\text{bin}}$) | Store Loc | POC Point | Usages ($U_i$) | Required Trolleys / hr | Load Dist (m) | Return Dist (m) | POC Space Limit |
|:---:|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **1** | **KE121530** | **FRAME, SCOOTER COMP** | **6** | E 10-17 | PL-03 | 1 | **11** | 198 | 198 | 2 trolleys |
| **2** | **KE110470** | **WHEEL ASSY DISC TUBELESS** | **30** | B 15,16 | PL-13 | 1 | **4** | 204 | 204 | 1 trolley |
| **3** | **KE121500** | **SUB FRAME COMP** | **64** | E 07,09 | PL-03 | 1 | **3** | 186 | 186 | 2 trolleys |
| **4** | **KE090530** | **SWINGARM SUB ASSY DRUM** | **60** | E 03,04 | PL-03 | 1 | **2** | 194 | 194 | 1 trolley |
| **5** | **K6100890** | **LOWER BRKT COMP** | **80** | E 05,06 | PL-13 | 1 | **2** | 278 | 278 | 1 trolley |

---

# 4. Mathematical Formulation & Calculations (Step-by-Step)

## 4.1 Takt Time & Hourly Production Demand

$$VPH = \frac{\text{Daily Target}}{\text{Operating Hours}} = \frac{1032}{8} = 129.00 \text{ vehicles/hour}$$

$$T_{\text{takt}} = \frac{3600 \text{ seconds}}{VPH} = \frac{3600}{129} \approx 27.90697 \text{ seconds/vehicle}$$

---

## 4.2 The 11 Frame Trolley Line-Balancing & Operator Division Rule

1. **Total Gross Line Demand for Frames:**
   $$D_{\text{gross, frame}} = \frac{VPH \times U_{\text{frame}}}{C_{\text{bin, frame}}} = \frac{129 \times 1}{6} = 21.5 \text{ trolleys/hr}$$

2. **Operator Allocation:**
   Under plant standards, the line is divided into dual feeding loops (Operator 1 and Operator 2).
   $$\text{Planned Frames for Operator 1 } (T_{\text{frame}}) = \mathbf{11\text{ trolleys/hour}}$$
   *(Delivering $11 \times 6 = 66\text{ units/hour}$, feeding 50% of the line vehicles directly).*

3. **Effective Consumption Interval per Frame Trolley:**
   $$I_{\text{trolley, frame}} = \frac{60 \text{ minutes}}{11 \text{ trolleys}} \approx \mathbf{5.4545\text{ minutes/trolley}} \quad (327.27\text{ seconds})$$

   * **1 Frame Trolley provides:** $\mathbf{5.45\text{ minutes}}$ of single-operator feed coverage.
   * **2 Frame Trolleys provide:** $2 \times 5.4545 = \mathbf{10.91\text{ minutes}}$ ($654.5\text{s}$) of coverage.
   * **3 Frame Trolleys provide:** $3 \times 5.4545 = \mathbf{16.36\text{ minutes}}$ ($981.8\text{s}$) of coverage.

---

## 4.3 Part Consumption Rates & Effective Coverage Interval

| Part Description | Trolley Capacity ($C_{\text{bin}}$) | Hourly Trolleys Planned | Delivery Interval per Trolley | Consumption Rate ($R_{\text{min}}$) |
| :--- | :---: | :---: | :---: | :---: |
| **FRAME, SCOOTER COMP** | 6 units | **11** | **5.45 min** | 1.10 units/min (allocated) |
| **WHEEL ASSY DISC TUBELESS** | 30 units | **4** | **15.00 min** | 2.00 units/min |
| **SUB FRAME COMP** | 64 units | **3** | **20.00 min** | 3.20 units/min |
| **SWINGARM SUB ASSY DRUM** | 60 units | **2** | **30.00 min** | 2.00 units/min |
| **LOWER BRKT COMP** | 80 units | **2** | **30.00 min** | 2.67 units/min |

---

## 4.4 Bin / Trolley Buffer Life & Coverage Times

### Single Trolley Coverage ($T_{\text{cov, single}}$):
$$T_{\text{cov, single}} = \frac{C_{\text{bin}, i}}{R_{\text{min}, i}} \quad [\text{minutes}]$$

### Batch Coverage ($T_{\text{cov, batch}}$) for $N$ Trolleys:
$$T_{\text{cov, batch}} = N \times T_{\text{cov, single}} \quad [\text{minutes}]$$

---

## 4.5 Initial Line-Side Stock (POC) Depletion Lifecycle

At shift start ($t = 0.00\text{ min}$, `07:00:00 AM`), each POC station holds initial stock carryover $S_{0, i}$ (typically 1 trolley).

1. **Initial Quantity in Units ($S_{\text{init, units}}$):**
   $$S_{\text{init, units}} = S_{0, i} \times C_{\text{bin}, i}$$

2. **Initial Stock Coverage Time ($T_{\text{init\_cov}}$):**
   $$T_{\text{init\_cov}} = \frac{S_{\text{init, units}}}{R_{\text{min}, i}} \quad [\text{minutes}]$$

3. **Initial Stock Empty Clock Time:**
   $$\text{Initial Empty Time} = \text{Shift Start Hour} + T_{\text{init\_cov}}$$

*For Frame:* With 1 trolley initial stock ($6$ units) under the 11 trolleys/hr allocation ($5.45\text{ min/trolley}$):
$$T_{\text{init\_cov, frame}} = \mathbf{5.45\text{ minutes}} = 5\text{ minutes } 27\text{ seconds}$$
Started at `07:00:00 AM` $\to$ Initial Frame runs empty at **`07:05:27 AM`**.

---

## 4.6 Multi-Stop Routing & Inter-Station 2-Meter Spacing Rule

When a Jumbo Tugger trip delivers parts to multiple stations (e.g., Frame at `PL-03` and Wheel at `PL-13`):
1. Stations are sorted in physical line-flow sequence ($PL-03 \to PL-13$).
2. The loaded transit distance is the maximum store-to-POC distance along the consolidated corridor plus inter-station travel:
   $$D_{\text{load}} = \max(D_{\text{load}, i}) + D_{\text{inter}}$$
3. Return distance:
   $$D_{\text{return}} = \max(D_{\text{ret}, i})$$
4. Travel times with $v_{\text{load}} = 1.4\text{ m/s}$ ($0.714\text{ s/m}$) and $v_{\text{empty}} = 2.2\text{ m/s}$ ($0.455\text{ s/m}$):
   $$t_{\text{travel, loaded}} = \frac{D_{\text{load}}}{v_{\text{load}}} \quad [\text{seconds}]$$
   $$t_{\text{travel, return}} = \frac{D_{\text{return}}}{v_{\text{empty}}} \quad [\text{seconds}]$$

---

## 4.7 Handling Steps & Total Cycle Time ($T_{\text{cycle}}$)

Handling time per trip for $n$ loaded trolleys ($n \le 3$):
$$T_{\text{cycle}} = (n \times t_{\text{pick}}) + t_{\text{travel, load}} + (n \times t_{\text{unload}}) + (n \times t_{\text{emp\_pick}}) + t_{\text{travel, ret}} + t_{\text{buffer}}$$

| Step | Unit Time | 3-Trolley Trip Duration |
| :--- | :---: | :---: |
| **Pick & Hitch (Store)** | $15\text{ s/trolley}$ | $45\text{ s}$ |
| **Loaded Transit Out** | $1.4\text{ m/s}$ | $\approx 137\text{ s}$ ($192\text{m}$) |
| **Unload & Place (POC)** | $15\text{ s/trolley}$ | $45\text{ s}$ |
| **Empty Transit Return** | $2.2\text{ m/s}$ | $\approx 87\text{ s}$ ($192\text{m}$) |
| **Tugger Re-alignment / Buffer** | $10\text{ s}$ | $10\text{ s}$ |
| **Total Cycle Time ($T_{\text{cycle}}$)** | | **$324\text{ s}$ ($5\text{ min } 24\text{ s}$)** |

---

## 4.8 Lead Time to POC & Delivery Minute Calculation

$$T_{\text{lead\_sec}} = (n \times t_{\text{pick}}) + t_{\text{travel, load}} + (n \times t_{\text{unload}})$$

$$T_{\text{lead\_min}} = \frac{T_{\text{lead\_sec}}}{60} \quad [\text{minutes}]$$

$$\mathbf{T_{\text{delivery}}} = T_{\text{dispatch}} + T_{\text{lead\_min}} \quad [\text{relative minute}]$$

$$\text{Delivery Clock Time} = \text{Shift Start Time} + T_{\text{delivery}}$$

---

## 4.9 Zero-Outage Takt-Paced Dispatch Scheduling

$$T_{\text{target\_arrival}} = \text{Current Line Stock Depletion Minute} - \Delta_{\text{tol}} \quad (\Delta_{\text{tol}} = 2.0\text{ min})$$

$$T_{\text{dispatch}} = \max\left( T_{\text{prev\_trip\_finish}}, \; T_{\text{target\_arrival}} - T_{\text{lead\_min}} \right)$$

---

## 4.10 Delivered Part Exhaustion / Stock-Out Minute ($T_{\text{empty}}$)

$$\mathbf{T_{\text{empty}}} = T_{\text{delivery}} + T_{\text{cov, batch}} \quad [\text{relative minute}]$$

$$\text{Empty Clock Time} = \text{Shift Start Time} + T_{\text{empty}}$$

---

## 4.11 Shift Demand, Fleet Sizing & Operator Utilization (MHF)

Under the 11 Frame Trolleys / Hour plan:
* **Hourly Demand:** $22\text{ trolleys/hour}$.
* **Shift Demand (8.0 Operating Hours):**
  $$D_{\text{shift}} = 22 \times 8 = \mathbf{176\text{ trolleys / shift}}$$
  *(Frames = $11 \times 8 = 88\text{ trolleys}$; Others = $11 \times 8 = 88\text{ trolleys}$).*
* **Total Trips per Shift:**
  $$N_{\text{trips, shift}} = 8 \text{ trips/hr} \times 8 = \mathbf{64\text{ trips / shift}}$$
* **Operator Shift Workload:**
  $$W_{\text{shift}} = 64 \text{ trips} \times 5.4 \text{ min/trip} \approx \mathbf{345.6\text{ minutes}}$$
* **Operator Utilization ($\eta$):**
  $$\eta = \left( \frac{345.6\text{ min}}{480\text{ min}} \right) \times 100\% = \mathbf{72.0\%}$$
* **MHF Required:**
  $$\text{MHF} = \frac{345.6}{480} = \mathbf{0.72\text{ Operators}} \quad (\le 1.00 \implies \mathbf{\text{Exactly 1 Operator Needed}})$$

---

# 5. The 11 Frame Trolley Grouping & Bin-Packing Engine

The application supports two complementary operational models for the 11 Frame Trolley requirement:

---

## 5.1 Model A: The 8-Trip Lean Consolidated Schedule (22 Trolleys / 8 Trips)
*(Standard Factory Benchmark as documented in `/docs/tripcalc.md`)*

### 1. Frame Allocation Across 8 Trips:
With 11 Frame trolleys to allocate across 8 trips:
* **Base Allocation:** 1 Frame trolley in all 8 trips ($8 \times 1 = 8\text{ trolleys}$).
* **Residual Allocation:** Distribute the remaining $11 - 8 = 3$ Frame trolleys to the earliest trips (Trips 1, 2, 3).
* **Frame Distribution:**
  * **Trip 1, 2, 3:** **2 Frames each** ($3 \times 2 = 6\text{ frames}$)
  * **Trip 4, 5, 6, 7, 8:** **1 Frame each** ($5 \times 1 = 5\text{ frames}$)
  * **Total Frames Delivered:** $6 + 5 = \mathbf{11\text{ Frame Trolleys}}$.

### 2. Remaining Part Slot Filling (Greedy Bin-Packing):
* **Trip 1 (2 Frames):** $+1\text{ Wheel}$ (Slot 3) $\to$ 3 trolleys.
* **Trip 2 (2 Frames):** $+1\text{ Sub Frame}$ (Slot 3) $\to$ 3 trolleys.
* **Trip 3 (2 Frames):** $+1\text{ Wheel}$ (Slot 3) $\to$ 3 trolleys.
* **Trip 4 (1 Frame):** $+1\text{ Swingarm} + 1\text{ Wheel}$ $\to$ 3 trolleys.
* **Trip 5 (1 Frame):** $+1\text{ Lower Brkt} + 1\text{ Sub Frame}$ $\to$ 3 trolleys.
* **Trip 6 (1 Frame):** $+1\text{ Wheel} + 1\text{ Lower Brkt}$ $\to$ 3 trolleys.
* **Trip 7 (1 Frame):** $+1\text{ Sub Frame} + 1\text{ Swingarm}$ $\to$ 3 trolleys.
* **Trip 8 (1 Frame):** Remaining demands are 0. Remaining 2 slots are **Empty Buffer**.

### Master 8-Trip Execution Table:
| Trip S.No | Slot 1 | Slot 2 | Slot 3 | Frames | Co-Loaded Part(s) | Total Trolleys | One-Way Dist (m) | Round-Trip Dist (m) |
|:---:|:---|:---|:---|:---:|:---|:---:|:---:|:---:|
| **Trip 1** | KE121530 (Frame) | KE121530 (Frame) | KE110470 (Wheel) | **2** | 1x Wheel | 3 | 204 | 408 |
| **Trip 2** | KE121530 (Frame) | KE121530 (Frame) | KE121500 (Sub Frame) | **2** | 1x Sub Frame | 3 | 198 | 396 |
| **Trip 3** | KE121530 (Frame) | KE121530 (Frame) | KE110470 (Wheel) | **2** | 1x Wheel | 3 | 204 | 408 |
| **Trip 4** | KE121530 (Frame) | KE090530 (Swingarm) | KE110470 (Wheel) | **1** | 1x Swingarm, 1x Wheel | 3 | 204 | 408 |
| **Trip 5** | KE121530 (Frame) | K6100890 (Lower Brkt) | KE121500 (Sub Frame) | **1** | 1x Lower Brkt, 1x Sub Frame | 3 | 278 | 556 |
| **Trip 6** | KE121530 (Frame) | KE110470 (Wheel) | K6100890 (Lower Brkt) | **1** | 1x Wheel, 1x Lower Brkt | 3 | 278 | 556 |
| **Trip 7** | KE121530 (Frame) | KE121500 (Sub Frame) | KE090530 (Swingarm) | **1** | 1x Sub Frame, 1x Swingarm | 3 | 198 | 396 |
| **Trip 8** | KE121530 (Frame) | *Empty* | *Empty* | **1** | *Empty Buffer* | 1 | 198 | 396 |
| **TOTAL** | | | | **11** | **11** | **22** | **1,766 m** | **3,532 m** |

### Demand Reconciliation Audit:
| Part Number | Description | Required Trolleys / hr | Planned Trolleys / hr | Reconciliation Status |
|:---|:---|:---:|:---:|:---:|
| **KE121530** | FRAME, SCOOTER COMP | **11** | **11** | ✅ Perfectly Balanced |
| **KE110470** | WHEEL ASSY DISC TUBELESS | **4** | **4** | ✅ Perfectly Balanced |
| **KE121500** | SUB FRAME COMP | **3** | **3** | ✅ Perfectly Balanced |
| **KE090530** | SWINGARM SUB ASSY DRUM | **2** | **2** | ✅ Perfectly Balanced |
| **K6100890** | LOWER BRKT COMP | **2** | **2** | ✅ Perfectly Balanced |
| **TOTAL** | | **22** | **22** | **100% Demand Met** |

---

## 5.2 Model B: The 11-Trip Sequential Takt-Paced Schedule (1 Frame per Trip)

When operating under continuous takt-paced flow, 11 trips are executed per hour—with **exactly 1 Frame trolley delivered on every single trip** ($11 \times 1 = 11\text{ Frames}$):

| Seq | Trip Description | Frame Trolleys | Co-Loaded Part | Frame Buffer Added | Co-Load Buffer Added | Total Step (s) |
|:---:|:---|:---:|:---|:---:|:---:|:---:|
| **1** | FRAME (1) & WHEEL ASSY (1) | **1** | Wheel (1) | $5.45\text{ m}$ | $15.00\text{ m}$ | 390s |
| **2** | FRAME (1) & WHEEL ASSY (1) | **1** | Wheel (1) | $5.45\text{ m}$ | $15.00\text{ m}$ | 390s |
| **3** | FRAME (1) & SWINGARM (1) | **1** | Swingarm (1) | $5.45\text{ m}$ | $30.00\text{ m}$ | 385s |
| **4** | FRAME (1) & WHEEL ASSY (1) | **1** | Wheel (1) | $5.45\text{ m}$ | $15.00\text{ m}$ | 390s |
| **5** | FRAME (1) & SUB FRAME (1) | **1** | Sub Frame (1) | $5.45\text{ m}$ | $20.00\text{ m}$ | 380s |
| **6** | FRAME (1) & WHEEL ASSY (1) | **1** | Wheel (1) | $5.45\text{ m}$ | $15.00\text{ m}$ | 390s |
| **7** | FRAME (1) & LOWER BRKT (1) | **1** | Lower Brkt (1) | $5.45\text{ m}$ | $30.00\text{ m}$ | 435s |
| **8** | FRAME (1) & SWINGARM (1) | **1** | Swingarm (1) | $5.45\text{ m}$ | $30.00\text{ m}$ | 385s |
| **9** | FRAME (1) & SUB FRAME (1) | **1** | Sub Frame (1) | $5.45\text{ m}$ | $20.00\text{ m}$ | 380s |
| **10** | FRAME (1) & LOWER BRKT (1) | **1** | Lower Brkt (1) | $5.45\text{ m}$ | $30.00\text{ m}$ | 435s |
| **11** | FRAME (1) & SUB FRAME (1) | **1** | Sub Frame (1) | $5.45\text{ m}$ | $20.00\text{ m}$ | 380s |
| **SUM** | **11 Trips** | **11** | **11** | **Total: 11 Frames** | **Total: 11 Co-loads** | **22 Trolleys** |

---

# 6. Standard Work Combination Table (SWCT) & Gantt Engine

## 6.1 Step Duration Breakdown

* **Manual Work (Red):** Picking/Hitching at Store ($t_{\text{pick}}$) and Unloading at POC ($t_{\text{unload}}$).
* **Auto / Machine (Blue):** Powered electric transit loaded ($t_{\text{travel, load}}$) and return ($t_{\text{travel, ret}}$).
* **Walking (Green):** Operator stepping between stations and inspecting coupling pins.
* **Waiting / Idle (Yellow/Dashed):** Time remaining before the next cycle must be dispatched to meet takt time.

---

## 6.2 Anti-Collision Dual-Sublane Inventory Visualization

In `MisuzumashiChart.tsx`, each part row uses a dedicated vertical step of **$32\text{px}$** with mathematical sub-lane offsets:
* **Initial Stock Sub-Lane:**
  $$\text{Top Offset} = \text{trackYPx} - 8\text{px}$$
  * Rendered as an **Amber/Orange dashed line (`#f59e0b`)** with an amber end-tick.
  * Tagged with an amber status pill: `Init: 1 Trolley (5.5m)`.
* **Delivered Replenishment Sub-Lane:**
  $$\text{Top Offset} = \text{trackYPx} + 10\text{px}$$
  * Rendered as a **Red dashed line (`#ef4444`)** with a red end-tick.
  * Tagged with a high-contrast badge: `Part Name: X.Xm (Until HH:MM:SS)`.

---

# 7. Excel Export Format & Workbook Structure

When the operator clicks **Download Excel** in the SWCT dashboard, a multi-sheet `.xlsx` file is generated:

### Sheet 1: `Summary`
* Executive KPIs: Target Units ($1,032$), Takt Time ($27.91\text{s}$), Operating Hours ($8.0\text{h}$), Total Hourly Trolleys ($22$), Planned Frame Trolleys ($11$).
* Shift Movement Distance (km) and Total Trips.
* Overview table of all parts, initial trolleys, hourly consumption, and coverage minutes.

### Sheet 2: `SWCT Table`
* **Section 1: Initial POC Buffer Stocks (Start of Hour)**
  * Columns: `Part Number`, `Part Description`, `Initial Qty (Trolleys)`, `Initial Qty (Units)`, `Hourly Cons. Rate`, `Buffer Start Time` (`07:00:00 AM`), `Buffer Empty Minute` (`5.45m`), `Buffer Empty Clock Time` (`07:05:27 AM`), `Status`.
* **Section 2: Sequential Milk-Run Trips & Part-Level Delivery Schedule**
  * Columns:
    1. `Seq / Trip ID` (e.g. `Trip 1`, `Trip 2`)
    2. `Part Number & Description`
    3. `Qty Carried (Trolleys)` (1 or 2 for Frame, 1 for co-load)
    4. `Pick & Loading (s)`
    5. `Travel Lead Time to POC`
    6. `Delivery Minute (Rel. Min)`
    7. `Delivery Clock Time`
    8. `Buffer Consumption Life (m)`
    9. `Buffer Empty Minute`
    10. `Buffer Empty Clock Time`
    11. `Unload & Return Time (s)`
    12. `Total Cycle Step Time (s)`

### Sheet 3: `Initial Stock Coverage`
* Standalone audit matrix of all parts showing bin capacities, safety coverage thresholds, and line-side stockout limits.

---

# 8. Concrete End-to-End Simulation Example (07:00 AM - 08:00 AM)

### Initial Stock State at 07:00:00 AM:
* **Frame (1 Trolley = 6 units):** Empty at **`07:05:27 AM`** ($5.45\text{m}$).
* **Wheel (1 Trolley = 30 units):** Empty at **`07:15:00 AM`** ($15.00\text{m}$).
* **Swingarm (1 Trolley = 60 units):** Empty at **`07:30:00 AM`** ($30.00\text{m}$).
* **Sub Frame (1 Trolley = 64 units):** Empty at **`07:20:00 AM`** ($20.00\text{m}$).
* **Lower Brkt (1 Trolley = 80 units):** Empty at **`07:30:00 AM`** ($30.00\text{m}$).

### Trip 1 Execution (07:00:00 AM):
* **Load:** 2 Trolleys Frame (12 units) + 1 Trolley Wheel (30 units)
* **Lead Time:** $2.44\text{m}$ ($146.4\text{s}$)
* **Delivered at POC:** **`07:02:26 AM`** ($2.44\text{m}$) $\to$ *Arrives 3 minutes before initial Frame stock empties!*
* **Buffer Added:**
  * Frame: $+10.91\text{m} \to$ Extends Frame supply until **`07:16:21 AM`** ($16.36\text{m}$).
  * Wheel: $+15.00\text{m} \to$ Extends Wheel supply until **`07:30:00 AM`** ($30.00\text{m}$).

---

# 9. Software Codebase Architecture & File Mapping

```
/src
├── types/
│   └── manufacturing.ts         # Central TypeScript interfaces & domain models
├── context/
│   └── MaterialFlowContext.tsx  # React context: Global state for production, parts, & shifts
├── utils/
│   ├── calculations.ts          # Core math: 11-Frame logic, feeding schedules, MHF, KPIs
│   ├── excelParser.ts           # Excel import & multi-sheet production report generator
│   └── pocSorter.ts             # Line station sequence sorter & 2m distance calculator
└── components/
    └── features/
        ├── swct/
        │   ├── SWCTDashboard.tsx    # Primary controller, dispatch engine & Excel exporter
        │   ├── MisuzumashiChart.tsx # SVG/Canvas Gantt chart with dual-sublane rendering
        │   └── SWCTDiagnosticModal.tsx # Step-by-step diagnostic audit modal
        ├── operators/
        │   └── OperatorManagement.tsx # Operator roster, assignment & shift matrix
        └── routes/
            └── RouteMaster.tsx      # Milk-run route sequencing & stop verification
```

---
*Document compiled and verified for production compliance under TVS Motor Company Digital Manufacturing Guidelines.*
