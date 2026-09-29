# Mizusumashi Logistics Calculation & Execution Engine

This document details the industrial engineering formulas, parameter inputs, and system processing logic of the Mizusumashi (water carrier) replenishment model. It describes how parts are grouped, how operator cycle times are modeled against Takt Time, how POC space constraints are enforced, and how shift schedules are processed.

---

## 1. Fundamental Parameters & Takt-Based Ingestion

The Mizusumashi system is designed around a line-side pull mechanism linked directly to the assembly line's Takt Time.

### Core Variables

*   **Takt Time ($T_{\text{takt}}$):** $27.9\text{ seconds}$
*   **Vehicles Per Hour (VPH):** Target throughput per hour of effective runtime.
    $$\text{VPH} = \frac{3600\text{ seconds}}{T_{\text{takt}}} = \frac{3600}{27.9} \approx 129.03\text{ vehicles/hr}$$
    *(Our systems align with a target of **131 vehicles/hr** representing standard operational pacing).*
*   **Usage Per Vehicle ($U_p$):** Quantity of part $p$ required to build a single finished vehicle.
*   **Bin/Trolley Capacity ($C_{\text{bin}}$):** Standard unit pack container capacity for part $p$.

---

## 2. Material Consumption & Trolley Requirements

For each part $p$ in the master catalog, hourly and shift requirements are modeled as follows:

### Hourly Consumption
$$\text{Hourly Consumption } (Q_{\text{hr}}) = \text{VPH} \times U_p \text{ units/hour}$$

### Shift Consumption
For standard shifts with $8.0\text{ hours}$ of effective production work:
$$\text{Shift Consumption } (Q_{\text{shift}}) = \text{Shift Target Vehicles} \times U_p \text{ units/shift}$$

### Bins/Trolleys Required Per Hour
$$\text{Trolleys Required per Hour } (T_{\text{req\_hr}}) = \frac{Q_{\text{hr}}}{C_{\text{bin}}} \text{ trolleys/hour}$$
$$\text{Rounded Trolleys per Hour } (T_{\text{rounded\_hr}}) = \lceil T_{\text{req\_hr}} \rceil \text{ trolleys/hour}$$
$$\text{Rounded Quantity per Hour } (Q_{\text{rounded\_hr}}) = T_{\text{rounded\_hr}} \times C_{\text{bin}} \text{ units/hour}$$

### Net Shift Replenishment Required
The system evaluates the stock remaining from the previous shift to avoid redundant deliveries:
$$\text{Net Shift Units Required } (Q_{\text{net\_shift}}) = \max(0, Q_{\text{shift}} - \text{Initial POC Carryover Stock})$$
$$\text{Net Shift Trolleys Required } (T_{\text{net\_shift}}) = \frac{Q_{\text{net\_shift}}}{C_{\text{bin}}} \text{ trolleys/shift}$$

---

## 3. Shift Definitions & Break Deductions

The operations are modeled under a strict **2-shift framework** (eliminating Shift 3). Both shifts account for a 30-minute lunch break, resulting in an effective working time of **480 minutes** per shift.

| Parameter | Shift 1 (Day) | Shift 2 (Night) |
| :--- | :--- | :--- |
| **Active Hours** | 07:00 AM - 03:30 PM | 03:30 PM - 12:00 AM |
| **Gross Time** | 8.5 Hours ($510\text{ min}$) | 8.5 Hours ($510\text{ min}$) |
| **Lunch Break** | 11:45 AM - 12:15 PM ($30\text{ min}$) | 07:15 PM - 07:45 PM ($30\text{ min}$) |
| **Effective Working Time** | **480 Minutes** ($8.0\text{ hours}$) | **480 Minutes** ($8.0\text{ hours}$) |

*Note: All calculations for fleet sizes, delivery frequencies, and operator utilization are divided by the effective working time of $480\text{ minutes}$ rather than the gross $510\text{ minutes}$ to prevent operator fatigue and scheduling starvation.*

---

## 4. Combined Route Grouping (Milk Run Engine)

To optimize transport efficiency, the Mizusumashi system groups individual part deliveries into combined trips (Milk Runs).

### Grouping Rules
1.  **Shared Destination:** Materials must share a common line-side destination Point of Control (POC).
2.  **Compatible Transport Mode:** Materials must use the same type of vehicle (e.g., Jumbo Trolley vs. BOV).
3.  **Capacity Constraints:** The combined capacity of the grouped parts cannot exceed the physical carrying capacity of the vehicle:
    $$\sum_{i \in \text{Group}} \text{Trolleys Used}_i \le \text{Vehicle Carrying Capacity } (C_{\text{vehicle}})$$

### Dynamic Transit Routes
The dynamic travel path is calculated as:
$$\text{Store Main} \rightarrow \text{Unique Pick Stores} \rightarrow \text{Destination POC} \rightarrow \text{Empty Return Area} \rightarrow \text{Store Main}$$

---

## 5. Standardized Cycle Time & Workload Modeling

Mizusumashi operator times are determined using exact industrial standards scaled by the number of physical trolleys handled per trip ($U_{\text{capacity}}$):

### Element-Level Standard Times
1.  **Pick & Binning Loading Time:** $14\text{ seconds}$ per trolley.
    $$T_{\text{pick}} = 14 \times U_{\text{capacity}} \text{ seconds}$$
2.  **POC Unloading & Rack Feeding Time:** $16\text{ seconds}$ per trolley.
    $$T_{\text{unload}} = 16 \times U_{\text{capacity}} \text{ seconds}$$
3.  **Empty Trolley Collection Time:** $17\text{ seconds}$ per trolley.
    $$T_{\text{empty\_collect}} = 17 \times U_{\text{capacity}} \text{ seconds}$$
4.  **Empty Trolley Return Staging Time:** $10\text{ seconds}$ per trolley.
    $$T_{\text{empty\_leave}} = 10 \times U_{\text{capacity}} \text{ seconds}$$

### Corridor Travel Times
Corridor transit times are calculated using part distances ($D_{\text{loaded}}$ and $D_{\text{return}}$) and transit speeds ($S_{\text{loaded}}$ and $S_{\text{empty}}$):
$$T_{\text{loaded\_travel}} = \frac{D_{\text{loaded}}}{S_{\text{loaded}}} \text{ seconds}$$
$$T_{\text{empty\_travel}} = \frac{D_{\text{return}}}{S_{\text{empty}}} \text{ seconds}$$

### Total Standard Cycle Time per Trip ($C_t$)
$$C_t = T_{\text{loaded\_travel}} + T_{\text{empty\_travel}} + T_{\text{pick}} + T_{\text{unload}} + T_{\text{empty\_collect}} + T_{\text{empty\_leave}} \text{ seconds}$$

### Fleet Productivity Metrics
*   **Trips Per Hour:**
    $$\text{Trips per Hour} = \frac{3600\text{ seconds}}{C_t \text{ seconds}}$$
*   **Operator Workload / Shift:**
    $$\text{Operator Workload} = \text{Trips per Shift} \times C_t \text{ seconds}$$
*   **Operator Utilization Rate ($U_{\text{op}}$):**
    $$U_{\text{op}} = \frac{\text{Operator Workload}}{480\text{ minutes} \times 60\text{ seconds}} \times 100\%$$
*   **Multi-Handling Fleet Requirement (MHF):**
    $$\text{MHF} = \frac{\text{Operator Workload (Minutes)}}{480\text{ minutes}}$$

---

## 6. Point of Control (POC) Space Constraints

To prevent cluttering at the assembly line side, strict trolley storage limits are enforced at each POC.

### Default Constraint Logic
If a custom `pocSpaceTrolleysMax` limit is not uploaded via the Excel template:
*   **Frame Components:** Defaults to **2 trolleys** (if the description or part number contains the substring `"frame"` case-insensitively).
*   **Standard Parts:** Defaults to **1 trolley** otherwise.

### Space Violation Warning
A space violation is triggered if the peak stock at the POC (opening stock + delivered trolleys) exceeds the physical limit:
$$\text{Peak Stock Trolleys} = T_{\text{opening}} + T_{\text{delivered}} > \text{POC Space Max}$$

When a space violation occurs:
1.  A **warning banner (⚠️ POC Space Violation)** is displayed next to the part in the SWCT view.
2.  The **Trip Planning Sheet** flags the step as a space violation.
3.  The simulation engine displays warning flags in the live analytics dashboard to alert logistics planners.

---

## 7. Hourly Carryover Simulation Flow

The system simulates part coverage hour-by-hour using a carryover replenishment state machine:

```
[Opening Stock] ---> [Check Safety Buffer (< 0.5hr)] ---> [Replenish Batch if needed]
       |
       v
[Deduct Consumption (VPH * Factor)] ---> [Update Ending Stock & Coverage] ---> [Check POC Space Limit]
```

### Safety Buffer Replenishment Rule
If the predicted stock at the start of any hour $h$ minus consumption falls below a 30-minute safety buffer:
$$\text{Deficit} = (Q_{\text{hr\_consumption}} + Q_{\text{safety\_buffer}}) - Q_{\text{opening}}$$
$$\text{Replenishment Bins} = \left\lceil \frac{\text{Deficit}}{\text{Vehicle Carrying Capacity} \times C_{\text{bin}}} \right\rceil \times \text{Vehicle Carrying Capacity}$$

This mathematical engine guarantees line-feeding operations run under standard industrial guidelines with zero part starvation.
