# MASTER PROMPT — AUTONOMOUS MIZUSUMASHI TRIP PLANNING & SWCT SYSTEM

Build an autonomous **Mizusumashi / In-Plant Material Logistics Planning System** for a manufacturing assembly line.

The system must automatically calculate material requirements, identify replenishment deadlines, group part numbers into optimized trips, assign trips to the respective material-handling operator, calculate SWCT, manage carry-over material between shifts, and generate an hour-by-hour trip sheet.

The highest-priority objective is:

**ZERO LINE STOPPAGE DUE TO MATERIAL SHORTAGE.**

Secondary objectives are:

1. Minimize unnecessary trips.
2. Maximize transport capacity utilization.
3. Reduce operator travel distance.
4. Reduce operator workload.
5. Avoid excess line-side inventory.
6. Use carry-over stock before supplying additional material.
7. Maintain sufficient safety stock at every POC.
8. Generate a practical executable trip plan for every operator.

---

# 1. PRODUCTION INPUTS

The application must accept:

* Production plan per day
* Takt time in seconds
* Number of shifts
* Shift duration
* Shift start/end times
* Break times if applicable
* Planned downtime if applicable
* Model / product
* Production quantity by shift if available

Default factory shift pattern:

Shift 1:
07:00 – 15:00

Shift 2:
15:00 – 23:00

Shift 3:
23:00 – 07:00

Each shift = 8 hours.

The system must support continuous production across midnight.

Do NOT reset inventory to zero at shift changes.

---

# 2. OPERATOR INPUT

There can be many Mizusumashi/material-handling operators.

Each operator may handle a different set of part numbers.

Input:

* Operator ID
* Operator Name
* Assigned Part Numbers
* Assigned Stores
* Assigned POC Points
* Available Transport Mode
* Shift
* Working time
* Break time

Example:

Operator 1:
Part A
Part B
Part C
Part D
Part E

Operator 2:
Part F
Part G
Part H

Operator 3:
Part I
Part J
Part K

Each operator must receive an independent optimized trip plan.

---

# 3. PART MASTER INPUT

For every part number capture:

* Operator
* Part No
* Description
* Model
* BIN/Trolley type
* Quantity loaded in one bin/trolley
* Store location
* POC point
* Number of usages per vehicle
* Trolley/bin quantity required per hour
* Loaded movement distance
* Empty movement distance
* Transport mode
* Current POC stock
* Current store stock
* Safety stock
* Carry-over quantity
* Carry-over trolley quantity

Important:

"Quantity loaded in one trolley" means PIECES inside one physical trolley.

Example:

Part A
Qty/Trolley = 60
Trolleys Required/Hour = 2

This means:

1 trolley = 60 pieces.

2 trolleys/hour = 120 pieces supplied per hour.

DO NOT interpret this as 60 trolleys.

---

# 4. PRODUCTION DEMAND CALCULATION

Calculate theoretical production rate:

Production Rate per Hour = 3600 / Takt Time

For each part:

Part Consumption Rate = Production Rate × Number of Usages

Also calculate:

Consumption per minute

Consumption per second

Daily demand

Shift demand

Hourly demand

However, if "Trolley/bin Qty Required per Hour" is supplied as an approved logistics planning input, use that value for the logistics workload and trip plan.

Still calculate theoretical takt-based demand as a validation check.

If the logistics input cannot support takt-based consumption, display a warning.

Example:

Theoretical requirement = 20 trolleys/hour

Entered logistics plan = 10 trolleys/hour

Display:

"WARNING — Entered replenishment quantity may not support production takt."

Do not silently modify approved input data.

---

# 5. CONTAINER COVERAGE

For every part calculate how much production time one full trolley/bin can support.

Coverage Seconds:

Coverage = (Qty per Trolley / Usage per Vehicle) × Takt Time

Coverage Minutes:

Coverage Minutes = Coverage Seconds / 60

Calculate:

* One trolley coverage
* Current POC stock coverage
* Carry-over coverage
* Safety stock coverage
* Predicted stockout time

Example:

Qty/Trolley = 60
Usage = 1
Takt = 27.9 sec

Coverage:

60 × 27.9 = 1674 sec

= 27.9 minutes.

Use coverage time to determine replenishment priority.

---

# 6. CARRY-OVER MATERIAL LOGIC

Carry-over inventory is mandatory because production operates in three shifts.

At the end of every shift calculate:

Closing Stock =
Opening Stock

* Delivered Material

- Actual Consumption

The closing stock of one shift automatically becomes the opening stock of the next shift.

Example:

Shift 1 Closing Stock = 38 pcs

Then:

Shift 2 Opening Stock = 38 pcs

DO NOT automatically send a full trolley at 15:00 if carry-over stock can support production.

Calculate:

Carry-over Coverage =
Carry-over Qty × Takt / Usage

Determine the predicted shortage time.

Schedule the next trolley so that it reaches the POC before the carry-over material falls below safety stock.

Apply the same logic:

Shift 1 → Shift 2

Shift 2 → Shift 3

Shift 3 → Next Day Shift 1

Inventory therefore continues across the entire 24-hour production cycle.

---

# 7. TRANSPORT MODE STANDARDS

Use these standard movement speeds.

## Manual

Capacity = 1 trolley

Loaded Speed = 1.65 m/s

Empty Speed = 1.20 m/s

## Hand Pallet

Capacity = 1 trolley

Loaded Speed = 2.00 m/s

Empty Speed = 1.00 m/s

## Jumbo

Capacity = 3 trolleys

Loaded Speed = 0.72 m/s

Empty Speed = 0.72 m/s

## Battery Operated Truck

Loaded Speed = 0.50 m/s

Empty Speed = 0.80 m/s

Battery truck capacity must be configurable.

Never exceed the transport-mode capacity.

For Jumbo:

Maximum = 3 physical trolleys per trip.

A Jumbo trip may contain:

Part A × 1
Part B × 1
Part C × 1

OR:

Part A × 2
Part B × 1

OR:

Part A × 3

depending on replenishment urgency.

---

# 8. STANDARD HANDLING TIMES

Use the following standard handling times PER PHYSICAL TROLLEY:

Pick / Binning:

14 seconds × number of trolleys

POC Storing:

16 seconds × number of trolleys

Empty Trolley Collection:

17 seconds × number of trolleys

Empty Trolley Leaving:

10 seconds × number of trolleys

Therefore:

Handling Time per Trolley:

14 + 16 + 17 + 10

= 57 seconds/trolley.

For 3 trolleys:

Pick = 42 sec
POC Store = 48 sec
Empty Collection = 51 sec
Empty Leaving = 30 sec

Total handling = 171 sec.

Do NOT multiply these times by the number of pieces inside the trolley.

Always multiply by PHYSICAL TROLLEY COUNT.

---

# 9. TRAVEL TIME CALCULATION

Loaded Travel Time:

Loaded Distance / Loaded Speed

Empty Travel Time:

Empty Distance / Empty Speed

All distances are in meters.

All speeds are meters/second.

All resulting times are seconds.

Calculate SWCT:

SWCT =
Pick/Binning Time

* Loaded Travel Time
* POC Storing Time
* Empty Collection Time
* Empty Travel Time
* Empty Leaving Time

For grouped milk-run routes, DO NOT add individual part round-trip distances.

Use the actual common route:

Start
→ Store Pickup 1
→ Store Pickup 2
→ Store Pickup 3
→ POC 1
→ POC 2
→ Empty Collection
→ Return

Calculate actual route distance from the route-distance matrix.

---

# 10. ROUTE DISTANCE MATRIX

Allow the user to define distances between factory locations.

Example:

Start → E03/04
E03/04 → E05/06
E05/06 → E07/09
E07/09 → E10-17
E10-17 → B15/16
B15/16 → PL03
PL03 → PL13
PL13 → Start

Use this matrix to calculate actual grouped-trip travel distance.

The optimizer should choose the shortest feasible route that meets all material delivery deadlines.

---

# 11. AUTONOMOUS REPLENISHMENT ENGINE

For every part continuously calculate:

Current Stock

Consumption Rate

Safety Stock

Stock Coverage Time

Predicted Stockout Time

Next Replenishment Deadline

Use:

Replenishment Deadline =
Predicted Safety Stock Breach Time

* Required Delivery/Travel Allowance

Never schedule based only on fixed hourly intervals.

Schedule based on actual material coverage.

---

# 12. LINE-STOP PREVENTION

This is the highest-priority rule.

For every part:

Predicted POC Stock at Arrival =
Current Stock

* Consumption Until Arrival

The trip is feasible only when:

Predicted Stock at Arrival >= Safety Stock

Alternatively calculate:

Safety Margin =
Predicted Stockout Time

* Planned Delivery Arrival Time

Classification:

GREEN:
Healthy safety margin.

AMBER:
Delivery is close to the safety-stock threshold.

RED:
Material will reach zero or safety-stock threshold before delivery.

A RED trip is NOT an acceptable plan.

The optimizer must automatically attempt to:

1. Move the trip earlier.
2. Change grouping.
3. Prioritize the critical part.
4. Split the trip.
5. Use another available transport mode if permitted.
6. Reassign work if operator-sharing rules permit.
7. Increase delivery quantity within transport capacity.
8. Use available carry-over stock.

If no feasible solution exists, display:

"CAPACITY CONSTRAINT — ZERO LINE STOP PLAN NOT POSSIBLE WITH CURRENT RESOURCES."

Then show the reason.

Never hide an infeasible plan.

---

# 13. DYNAMIC PRIORITY

Assign every part a dynamic priority.

Priority should consider:

1. Time remaining before safety-stock breach.
2. Stockout time.
3. Current stock.
4. Carry-over stock.
5. Trolley coverage.
6. Travel time.
7. Transport capacity.
8. POC location.
9. Other parts that can be grouped on the same route.

Critical parts with the lowest stock coverage must be considered first.

However, do not automatically send them alone if another part can safely be grouped without delaying the critical delivery.

---

# 14. TRIP GROUPING OPTIMIZATION

For each operator, find parts with overlapping replenishment windows.

Group compatible parts based on:

* Same operator
* Transport capacity
* Store proximity
* POC proximity
* Replenishment deadline
* Current POC stock
* Carry-over stock
* Route distance
* SWCT
* Safety margin

Example:

Operator requires per hour:

Part A = 2 trolleys
Part B = 2
Part C = 2
Part D = 10
Part E = 4

Total:

20 trolleys/hour.

Jumbo capacity:

3 trolleys/trip.

The theoretical minimum number of trips is:

CEILING(20 / 3) = 7 trips/hour.

But DO NOT simply create seven equally spaced trips.

The optimizer must determine when each trolley is actually required based on material coverage and line-side inventory.

A trip could be:

Trip 01:

Part D × 2
Part E × 1

Total = 3 trolleys.

Another:

Part D × 1
Part A × 1
Part C × 1

Total = 3.

Another:

Part A × 1
Part B × 1

Total = 2.

A partially loaded trip is acceptable when waiting to fill the remaining capacity would create material-shortage risk.

ZERO LINE STOP has higher priority than 100% transport utilization.

---

# 15. HOURLY PLANNING

Generate a detailed plan for each hour.

Example:

07:00–08:00
08:00–09:00
09:00–10:00
...
14:00–15:00

Then Shift 2:

15:00–16:00
...
22:00–23:00

Then Shift 3:

23:00–00:00
00:00–01:00
...
06:00–07:00

At midnight, continue the same production/inventory calculation.

Do not reset counters incorrectly at 00:00.

---

# 16. TRIP SHEET OUTPUT

Generate one trip sheet for each operator.

Required columns:

Trip No

Shift

Hour Window

Operator

Transport Mode

Trip Start Time

Store Arrival Time

Store Location

Part No

Description

Qty/Trolley

Number of Full Trolleys

Total Pieces

POC

Opening POC Stock

Carry-over Stock Used

Predicted Stock Before Delivery

Pick/Binning Time

Loaded Route Distance

Loaded Travel Time

POC Arrival Time

POC Storing Time

Stock After Delivery

Material Coverage After Delivery

Predicted Next Shortage Time

Empty Trolley Qty

Empty Collection Time

Empty Route Distance

Empty Travel Time

Empty Leaving Time

Trip Completion Time

Trip SWCT

Transport Capacity Utilization %

Safety Margin

Line Stop Risk

Status

Next Trip Start Time

---

# 17. SIMPLE OPERATOR VIEW

In addition to the detailed engineering table, generate a simple executable operator trip sheet.

Example:

TRIP 01

Start: 07:00

Pick:
E10-17 → KE121530 × 2 trolleys
B15-16 → KE110470 × 1 trolley

Deliver:
PL03 → KE121530 × 2
PL13 → KE110470 × 1

Collect:
3 empty trolleys

Return:
07:11

Next Trip:
07:12

Status:
SAFE

This should be easy for the shop-floor operator to understand.

---

# 18. HOURLY SUMMARY

For every operator and every hour show:

* Required trolleys
* Delivered trolleys
* Number of trips
* Loaded travel distance
* Empty travel distance
* Total travel distance
* Pick/binning time
* POC storing time
* Empty collection time
* Empty leaving time
* Total handling time
* Total travel time
* Total SWCT
* Operator utilization
* Transport utilization
* Carry-over opening stock
* Closing stock
* Minimum safety margin
* Line-stop risk

---

# 19. SHIFT SUMMARY

At the end of each 8-hour shift calculate:

Opening inventory

Total material demand

Total trolleys supplied

Total pieces supplied

Total trips

Total distance

Total SWCT

Operator utilization

Transport utilization

Minimum safety margin

Closing inventory

Carry-over to next shift

Parts at risk

Missed deliveries

Line stoppages

Target:

Line stoppages = 0.

---

# 20. OPERATOR CAPACITY VALIDATION

For each hour:

Available Operator Time = 3600 seconds minus planned break/downtime applicable to that hour.

Calculate:

Operator Utilization % =
Total Required SWCT / Available Time × 100

If utilization <= defined safe limit:
GREEN

If close to capacity:
AMBER

If > 100%:
RED

If SWCT exceeds available operator time, do NOT produce an impossible overlapping schedule.

Display:

"OPERATOR OVERLOAD."

Identify which parts/trips cause the overload.

Recommend:

* Route optimization
* Different grouping
* Different transport mode
* Additional trolley capacity
* Work redistribution
* Additional operator/resource

---

# 21. SHIFT HANDOVER

At 15:00, 23:00 and 07:00 generate a handover record.

Example:

SHIFT 1 → SHIFT 2

Part A:
POC closing = 38 pcs
Full trolley waiting = 1
Empty trolley = 1
Next shortage = 15:16
Next planned delivery = 15:10

Part B:
POC closing = 65 pcs
Next shortage = 15:28
Next delivery = 15:20

Shift 2 planning must begin using this actual carry-over state.

Never assume every part requires replenishment immediately at shift start.

---

# 22. AUTONOMOUS REPLANNING

The system must be capable of recalculating the remaining trip plan when actual conditions change.

Examples:

* Production quantity changes.
* Takt changes.
* Trip is delayed.
* Operator starts late.
* Material arrives late.
* Actual POC stock differs from planned stock.
* Store stock is unavailable.
* Transport mode changes.
* Trolley becomes unavailable.
* Breakdown occurs.
* Previous trip completes early.
* Previous trip completes late.
* Carry-over differs from forecast.

When an actual event is entered, freeze completed trips and recalculate only future trips.

Always protect the earliest material-shortage deadline first.

---

# 23. PLANNING ALGORITHM

Use an event-driven rolling-horizon scheduling algorithm.

For each operator:

STEP 1:
Load all assigned parts.

STEP 2:
Calculate current POC inventory and carry-over.

STEP 3:
Calculate consumption rate.

STEP 4:
Calculate safety-stock breach time for every part.

STEP 5:
Sort parts by earliest replenishment deadline.

STEP 6:
Select the most urgent part.

STEP 7:
Create a candidate trip.

STEP 8:
Check remaining transport capacity.

STEP 9:
Search for other parts whose replenishment windows allow them to be added to the same trip.

STEP 10:
Calculate route sequence.

STEP 11:
Calculate pick time.

STEP 12:
Calculate loaded travel time.

STEP 13:
Calculate POC arrival time for every delivery.

STEP 14:
Verify that every part remains above its required safety level until arrival.

STEP 15:
Calculate storing and empty collection.

STEP 16:
Calculate empty return.

STEP 17:
Calculate trip completion time.

STEP 18:
Update POC inventory.

STEP 19:
Update empty trolley inventory.

STEP 20:
Calculate next shortage deadlines.

STEP 21:
Repeat until the hour is completely planned.

Then continue the inventory state into the next hour.

At shift change, continue the same inventory state into the next shift.

---

# 24. OPTIMIZATION OBJECTIVE

Use lexicographic priorities.

Priority 1:
ZERO MATERIAL LINE STOP.

Priority 2:
Meet safety stock.

Priority 3:
Meet all delivery deadlines.

Priority 4:
Ensure operator schedule is physically feasible.

Priority 5:
Minimize number of trips.

Priority 6:
Maximize trolley/vehicle utilization.

Priority 7:
Minimize travel distance.

Priority 8:
Minimize operator SWCT.

Priority 9:
Minimize unnecessary POC inventory.

Never sacrifice Priority 1 to improve a lower-priority objective.

---

# 25. VALIDATION RULES

Before accepting a generated schedule, simulate the complete plan second-by-second or at sufficiently fine event intervals.

For every part verify:

Opening Stock

* Cumulative Deliveries

- Cumulative Consumption

> = 0

throughout the complete production period.

Also verify safety stock where configured.

For every operator verify that two trips do not overlap.

For every transport vehicle verify that two simultaneous trips are not assigned to the same vehicle.

For every trip verify capacity.

For every delivery verify POC arrival before the required deadline.

If every validation passes:

PLAN STATUS = FEASIBLE — ZERO PREDICTED LINE STOPS.

If any validation fails:

PLAN STATUS = INFEASIBLE.

Show exactly:

* Operator
* Part
* Time
* Predicted shortage
* Required arrival
* Planned arrival
* Delay
* Resource constraint responsible

Then automatically attempt replanning.

---

# 26. DASHBOARD

Create a dashboard showing:

Today's Production Plan

Current Shift

Current Hour

Current Takt

Active Operators

Active Trips

Next Trips

Critical Deliveries

Parts Below Safety Stock

Operator Utilization

Transport Utilization

Carry-over Inventory

Predicted Line Stops

Delayed Trips

Completed Trips

Upcoming Shift Handover

The most important KPI should be:

PREDICTED MATERIAL LINE STOPS = 0

Use clear status indicators:

GREEN = Safe

AMBER = Attention Required

RED = Line Stop / Infeasible

---

# 27. IMPORTANT CALCULATION PRINCIPLES

Never confuse:

Pieces
Trolleys
Trips

These are three different units.

Example:

1 trolley = 60 pieces.

Requirement = 2 trolleys/hour.

Therefore:

Material quantity = 120 pieces/hour.

If Jumbo capacity = 3 trolleys:

2 trolleys do NOT mean 2 trips.

They may be grouped with another trolley in one trip.

Always maintain separate variables:

pieceQty

trolleyQty

tripQty

---

# 28. FINAL SYSTEM BEHAVIOUR

The application should behave like an autonomous logistics planner.

The user should not manually decide:

"Trip 1 contains A+B+C."

The application should calculate this automatically.

The user provides:

Production plan
Takt
Part master
Trolley capacity
Hourly requirement
POC stock
Carry-over
Operator assignment
Transport mode
Distances
Standard times

The system generates:

Production demand
Material consumption
Stock coverage
Shortage prediction
Delivery deadlines
Part priority
Optimized grouping
Trip sequence
Exact trip timing
SWCT
Operator workload
Hourly trip sheet
Shift trip sheet
Carry-over
Shift handover
Line-stop validation

The final result must answer:

"WHAT SHOULD EACH OPERATOR PICK, WHEN SHOULD THEY START, WHICH PARTS SHOULD BE GROUPED, HOW MANY TROLLEYS SHOULD THEY TAKE, WHERE SHOULD THEY DELIVER THEM, WHEN WILL THEY RETURN, AND WILL THE PLAN GUARANTEE MATERIAL AVAILABILITY AT THE LINE?"

The schedule must be mathematically validated before being marked as SAFE.
