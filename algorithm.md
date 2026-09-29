# DIGITAL MATERIAL FLOW — AI STUDIO IMPLEMENTATION SPECIFICATION

## 1. PROJECT OBJECTIVE

Build a Digital Material Flow and Jumbo Line-Feeding application for a manufacturing assembly line.

The physical material flow is:

STORES → JUMBO / MATERIAL HANDLING → POC → ASSEMBLY LINE

The application must digitally simulate and plan this flow.

The main objective is:

> Maintain continuous production without material starvation while minimizing Jumbo travel, respecting trolley capacity, POC capacity, material coverage, and replenishment deadlines.

This is NOT a simple trolley grouping application.

It is a Takt-driven, inventory-driven, dynamic line-feeding and trip-planning system.

---

# 2. CORE MANUFACTURING PARAMETERS

Use these parameters as configurable system settings:

* Takt time = 27.9 seconds / vehicle
* Production rate = 3600 / 27.9
* Planning production rate = 129 vehicles/hour
* Jumbo loaded capacity = EXACTLY 3 trolleys/trip
* Jumbo loaded speed = 0.72 m/s
* Jumbo empty speed = 0.72 m/s
* Trolley pickup handling = 10 seconds/trolley
* Trolley drop handling = 10 seconds/trolley
* Empty trolley pickup handling = 10 seconds/trolley
* Empty trolley drop/return handling = 10 seconds/trolley
* POC-to-POC distance = 2 metres
* Initial POC stock = 1 full trolley per material
* Production must NEVER stop because of material shortage.

Important:

The Jumbo capacity is exactly 3 loaded trolleys per trip.

Do not create trips containing only 1 or 2 loaded trolleys when a full trip is required.

---

# 3. CURRENT MATERIAL MASTER

The current active materials are:

## MATERIAL 1 — SWINGARM

* Part No: KE090530
* Part Name: SWINGARM SUB ASSY DRUM
* Handling Unit: Trolley
* Quantity per trolley: 60
* Store: E03,04
* POC: PL-03
* Usage per vehicle: 1
* Hourly trolley consumption: approximately 2
* Store → POC distance: 194 m
* Empty return distance: 194 m
* POC capacity: 1 trolley

## MATERIAL 2 — LOWER BRACKET

* Part No: K6100890
* Part Name: LOWER BRKT COMP
* Handling Unit: Trolley
* Quantity per trolley: 80
* Store: E05,06
* POC: PL-13
* Usage per vehicle: 1
* Hourly trolley consumption: approximately 2
* Store → POC distance: 278 m
* Empty return distance: 278 m
* POC capacity: 1 trolley

## MATERIAL 3 — SUB FRAME

* Part No: KE121500
* Part Name: SUB FRAME COMP
* Handling Unit: Trolley
* Quantity per trolley: 64
* Store: E07,09
* POC: PL-03
* Usage per vehicle: 1
* Hourly trolley consumption: approximately 3
* Store → POC distance: 186 m
* Empty return distance: 186 m
* POC capacity: 2 trolleys

## MATERIAL 4 — WHEEL ASSY

* Part No: KE110470
* Part Name: WHEEL ASSY DISC TUBELESS
* Handling Unit: Trolley
* Quantity per trolley: 30
* Store: B15,16
* POC: PL-13
* Usage per vehicle: 1
* Hourly trolley consumption: approximately 4
* Store → POC distance: 204 m
* Empty return distance: 204 m
* POC capacity: 1 trolley

FRAME / KE121530 MUST CURRENTLY BE EXCLUDED FROM THE CALCULATION.

The system should allow materials to be activated/deactivated rather than deleting them permanently.

---

# 4. DEMAND CALCULATION

Calculate production demand from Takt.

Formula:

Production Rate = 3600 / Takt

With:

Takt = 27.9 seconds

Production Rate ≈ 129 vehicles/hour.

For a planning horizon:

1 hour:
129 vehicles

2 hours:
258 vehicles

8 hours:
1032 vehicles

The system must not hard-code these vehicle counts.

Calculate them dynamically from Takt and planning duration.

---

# 5. PART CONSUMPTION CALCULATION

For every material:

Part Consumption/hour =
Production Rate × Usage per Vehicle

Current usage = 1.

Therefore each material consumes approximately:

129 parts/hour.

Trolley consumption/hour:

Trolley Consumption =
Part Consumption/hour / Quantity per Trolley

Examples:

Wheel:

129 / 30 = 4.30 trolley equivalents/hour

Sub Frame:

129 / 64 = 2.016 trolley equivalents/hour

Swingarm:

129 / 60 = 2.15 trolley equivalents/hour

Lower Bracket:

129 / 80 = 1.6125 trolley equivalents/hour

Do NOT round these values for inventory simulation.

Use decimal trolley-equivalent consumption internally.

Only round when determining the physical number of complete trolleys required.

---

# 6. INITIAL POC INVENTORY

At production start, assume:

1 full trolley is already available at every active POC.

Therefore:

PL-03:

* Swingarm = 60
* Sub Frame = 64

PL-13:

* Lower Bracket = 80
* Wheel Assy = 30

The system must maintain an independent inventory state for every Part + POC combination.

---

# 7. INITIAL MATERIAL COVERAGE TIME

Calculate:

Coverage Time (minutes) =
Initial POC Quantity / Hourly Part Consumption × 60

Current values:

Wheel:

30 / 129 × 60 = approximately 13.95 minutes

Initial Wheel trolley becomes empty at:

07:13:57

Swingarm:

60 / 129 × 60 = approximately 27.91 minutes

Initial Swingarm trolley becomes empty at:

07:27:54

Sub Frame:

64 / 129 × 60 = approximately 29.77 minutes

Initial Sub Frame trolley becomes empty at:

07:29:46

Lower Bracket:

80 / 129 × 60 = approximately 37.21 minutes

Initial Lower Bracket trolley becomes empty at:

07:37:13

Therefore the initial urgency order is:

1. Wheel
2. Swingarm
3. Sub Frame
4. Lower Bracket

This order must NOT be permanently hard-coded.

The application must recalculate urgency dynamically from current inventory and predicted stock-out time.

---

# 8. VEHICLE-BY-VEHICLE CONSUMPTION

The inventory engine must simulate consumption continuously.

Every 27.9 seconds represents one vehicle.

For each vehicle:

Decrease inventory by:

Usage per Vehicle

Example for Wheel:

07:00:00:
30 wheels

Vehicle 1:
29 wheels

Vehicle 2:
28 wheels

...

When the inventory reaches zero, the material requires replenishment.

The application should be able to show:

* Current vehicle number
* Current time
* Current POC inventory
* Consumption rate
* Predicted stock-out time
* Next replenishment trolley arrival

---

# 9. DO NOT WAIT UNTIL ZERO

The Jumbo must not plan a trip only after the POC becomes empty.

Instead calculate:

STOCK-OUT TIME

then:

REQUIRED ARRIVAL TIME

then:

JUMBO DEPARTURE DEADLINE

Formula:

Required Arrival =
Stock-out Time - Safety Buffer

Departure Deadline =
Required Arrival - Estimated Trip Time

Safety buffer should be configurable.

Default:

1 minute.

The system must guarantee:

Jumbo arrival < material stock-out time.

If not possible, flag the trip as:

CRITICAL / LINE STOP RISK.

---

# 10. TRIP TIME CALCULATION

Every trip contains:

1. Loaded trolley pickup
2. Store internal movement
3. Store → POC movement
4. POC → POC movement if required
5. Loaded trolley drop
6. POC → Stores movement
7. Empty trolley handling

For exactly 3 trolleys:

Loaded pickup:
3 × 10 = 30 sec

Loaded drop:
3 × 10 = 30 sec

Empty pickup:
3 × 10 = 30 sec

Empty drop:
3 × 10 = 30 sec

Total handling:

120 seconds.

Therefore:

Trip Time =
Total Travel Time + 120 seconds

---

# 11. DISTANCE ENGINE

The distance engine MUST be dynamic.

Do not hard-code a single total trip distance.

For every trip:

Total Distance =
Inside Store Distance
+
Store → First POC
+
POC → POC
+
Last POC → Store

For a single-POC trip:

Total Distance =
Inside Store Distance
+
Store → POC
+
POC → Store

Travel Time:

Travel Time =
Total Distance / 0.72

Then:

Trip Time =
Travel Time + Handling Time

---

# 12. POC-TO-POC DISTANCE

The current rule is:

PL-03 ↔ PL-13 = 2 metres.

Therefore:

POC-to-POC travel time:

2 / 0.72 = 2.78 seconds.

If a trip contains materials for both POCs, include this distance.

Example:

Stores → PL-13 → PL-03 → Stores

must include:

2 metres between PL-13 and PL-03.

The application must NOT treat this as zero.

---

# 13. STORE INTERNAL DISTANCE

The Excel file currently does not contain physical distances between:

E03,04
E05,06
E07,09
B15,16

Therefore do NOT invent these distances.

Create a configurable Store Distance Matrix.

Example structure:

FROM | TO | DISTANCE

E03,04 | E05,06 | configurable
E03,04 | E07,09 | configurable
E03,04 | B15,16 | configurable
E05,06 | E07,09 | configurable
E05,06 | B15,16 | configurable
E07,09 | B15,16 | configurable

Until actual plant-layout distances are provided:

Inside-store distance may temporarily be treated as 0 m.

The UI must clearly label this as:

"Temporary assumption — actual store layout distance not configured."

Once the actual distance matrix is entered, all trip calculations must automatically update.

---

# 14. TRIP GROUPING ENGINE

The grouping engine is responsible for selecting exactly 3 loaded trolleys per Jumbo trip.

It must consider:

1. Material urgency
2. Predicted stock-out time
3. Required arrival time
4. POC
5. POC capacity
6. Store location
7. Travel distance
8. Travel time
9. Jumbo availability
10. Future demand
11. Operator workload

The engine must NOT simply group three random materials.

---

# 15. GROUPING PRIORITY

For every material calculate a dynamic priority.

Priority should increase when:

* POC inventory is low
* Stock-out time is near
* Jumbo trip lead time is high
* Required delivery deadline is near
* Production stoppage risk is high

Conceptually:

Urgency =
Remaining Coverage Time / Estimated Trip Lead Time

If:

Urgency < 1

the material is CRITICAL.

If:

Urgency is close to 1

the material is HIGH PRIORITY.

The exact thresholds should be configurable.

---

# 16. GROUPING STRATEGY

First select the most urgent material.

Then fill the remaining Jumbo capacity with materials that:

* Have upcoming replenishment requirements
* Are geographically efficient
* Are compatible with the route
* Have available POC capacity
* Do not create an earlier stock-out elsewhere

Example:

If Wheel is critical:

Candidate:

Trip:
Wheel + Lower + Sub Frame

Potential route:

Stores
→ PL-13
→ PL-03
→ Stores

The system should evaluate alternative groupings before finalizing.

---

# 17. EXACTLY 3 TROLLEYS

Jumbo capacity is exactly:

3 loaded trolleys.

Therefore:

Trip 001 = 3 loaded trolleys

Trip 002 = 3 loaded trolleys

Trip 003 = 3 loaded trolleys

Do not create:

Trip 001 = 1 trolley

Trip 002 = 2 trolleys

unless the system explicitly identifies this as an exception/emergency trip.

Normal planning must always use 3.

---

# 18. POC CAPACITY CONSTRAINT

POC capacity is a physical constraint.

Example:

Wheel POC capacity = 1 trolley.

If one Wheel trolley is already physically present at PL-13, the system must NOT schedule another Wheel trolley to be dropped into the same occupied position.

Therefore:

Before every delivery:

Available POC Capacity =
POC Capacity - Current Trolley Occupancy

If available capacity < required delivery quantity:

The delivery cannot be physically completed at that time.

The algorithm must:

1. Check another valid grouping
2. Check whether consumption frees the position
3. Carry the trolley temporarily if a valid buffer exists
4. Reschedule the delivery
5. Flag an exception if none is possible

Never silently violate POC capacity.

---

# 19. POC INVENTORY VS POC PHYSICAL SPACE

Treat these as two different values.

POC Inventory:

Actual material quantity available for production.

POC Physical Occupancy:

Number of physical trolleys currently occupying the POC.

Example:

POC capacity = 1 trolley

Current inventory = 15 parts

Current occupancy = 1 trolley

A new trolley cannot be dropped even though material will eventually be consumed.

This distinction is mandatory.

---

# 20. ROUTE OPTIMIZATION

For mixed POC trips, evaluate both route directions.

Route A:

Stores
→ PL-03
→ PL-13
→ Stores

Route B:

Stores
→ PL-13
→ PL-03
→ Stores

Calculate:

* Total distance
* Total travel time
* Handling time
* Arrival time
* Deadline compliance

Select the shortest FEASIBLE route.

Do NOT select a route only because it is shortest.

A route that misses a material deadline is invalid.

---

# 21. FEASIBILITY CHECK

Every proposed trip must pass:

CHECK 1:
Jumbo capacity = 3

CHECK 2:
POC capacity available

CHECK 3:
Trip arrival before stock-out

CHECK 4:
Jumbo is available

CHECK 5:
Route is valid

CHECK 6:
Store pickup sequence is valid

CHECK 7:
Production will not stop

If any check fails:

Regenerate the grouping.

---

# 22. TRIP PLANNING IS A BACKWARD CALCULATION

Do NOT plan only forward.

Example:

Wheel stock-out:

07:13:57

Safety buffer:

01:00

Required arrival:

07:12:57

Suppose trip duration:

07:00

Then:

Jumbo departure deadline:

07:05:57

Therefore:

Trip must start before 07:05:57.

This deadline should drive trip generation.

---

# 23. CLOSED-LOOP LINE FEEDING

After every completed trip:

UPDATE:

* POC inventory
* POC trolley occupancy
* Empty trolley count
* Jumbo location
* Jumbo availability time
* Material consumption
* Next stock-out time
* Next replenishment deadline

Then regenerate the next trip.

The system must NOT generate a completely static schedule and assume nothing changes.

It must behave as a continuous simulation.

---

# 24. ONE-HOUR SIMULATION

For 07:00–08:00:

Production:

129 vehicles.

Physical trolley requirement:

Wheel:
ceil(129 / 30) = 5 trolley positions/equivalents

Sub Frame:
ceil(129 / 64) = 3

Swingarm:
ceil(129 / 60) = 3

Lower:
ceil(129 / 80) = 2

Total:

5 + 3 + 3 + 2 = 13 physical trolley quantities required.

Initial POC stock:

4 trolleys.

Therefore:

13 - 4 = 9 replenishment trolleys.

Jumbo capacity:

3 trolleys/trip.

Therefore:

9 / 3 = 3 trips.

The application should show this calculation dynamically.

---

# 25. IMPORTANT: DO NOT CONFUSE TROLLEY EQUIVALENT WITH PHYSICAL TROLLEY

For continuous simulation, use decimal consumption.

Example:

Wheel:

4.30 trolley equivalents/hour.

But physically:

5 trolley loads are needed to cover 129 vehicles.

Therefore store two values:

trolleyEquivalentConsumption

and

physicalTrolleysRequired

Do not replace the first with the second.

---

# 26. TRIP SHEET OUTPUT

Every generated trip must show:

Trip ID

Start Time

Expected Arrival Time

Expected Return Time

Trip Duration

Total Distance

Route

Operator

Jumbo ID

Trolley Count

Material List

For each trolley:

* Sequence
* Part No
* Part Name
* Store
* POC
* Quantity
* Pickup Time
* Drop Time
* Inventory Before
* Inventory After
* POC Occupancy Before
* POC Occupancy After

Example:

TRIP T001

07:00:00

3 Trolleys

1. Wheel — 30 — B15,16 → PL-13
2. Lower — 80 — E05,06 → PL-13
3. Sub Frame — 64 — E07,09 → PL-03

Route:

Stores → PL-13 → PL-03 → Stores

The application must calculate the exact timestamps rather than manually entering them.

---

# 27. OPERATOR SEQUENCE

For each trip show:

START

↓

Pick trolley 1

↓

Pick trolley 2

↓

Pick trolley 3

↓

Move through store

↓

Move to POC 1

↓

Drop trolley(s)

↓

Move 2 m to next POC if required

↓

Drop trolley(s)

↓

Collect empty trolleys

↓

Return to Stores

↓

Trip complete

↓

Update inventory

↓

Generate next trip

---

# 28. DASHBOARD

The main dashboard should show:

## Production

* Takt
* Vehicles/hour
* Vehicles completed
* Remaining vehicles

## Material

For every part:

* Current POC stock
* Coverage time
* Stock-out time
* Next replenishment
* Urgency
* Trolley occupancy

## Jumbo

* Current status
* Current location
* Current trip
* Next trip
* Available time
* Trolleys loaded
* Trolleys remaining

## Line Risk

Show:

* Critical material
* Minutes to stock-out
* Next trip arrival
* Safety margin
* Line-stop risk

---

# 29. LIVE MATERIAL STATUS

Each material should have a status:

NORMAL

HIGH

CRITICAL

LINE STOP RISK

Status must be calculated dynamically.

Example:

Wheel:

Stock:
25

Coverage:
11.63 minutes

Stock-out:
07:11:38

Next delivery:
07:09:00

Safety:
2 min 38 sec

Status:
HIGH / SAFE

---

# 30. SIMULATION TIMELINE

Provide a timeline from:

07:00:00 → 08:00:00

Show:

Production consumption

POC replenishment

Jumbo movement

Trip start

Pickup

Travel

POC arrival

Drop

Return

Trip completion

Material stock level

The user should be able to select a trip and inspect every event.

---

# 31. ERROR / EXCEPTION HANDLING

The system must detect:

* No feasible 3-trolley grouping
* POC full
* Jumbo unavailable
* Trip arrives after stock-out
* Missing distance
* Missing store
* Missing POC
* Invalid trolley quantity
* Zero/negative consumption
* Production demand exceeding available material
* Insufficient empty trolleys
* Invalid route

Never silently produce an incorrect trip.

---

# 32. DISTANCE DATA ARCHITECTURE

Do not mix distances into business logic.

Create:

Material Master

and separately:

Store Distance Matrix

and:

POC Distance Matrix

Example:

POC Distance Matrix:

PL-03 → PL-13 = 2 m
PL-13 → PL-03 = 2 m

Store Distance Matrix:

E03,04 → E05,06 = configurable
E03,04 → E07,09 = configurable
E03,04 → B15,16 = configurable
etc.

This makes the application scalable.

---

# 33. FUTURE MULTI-JUMBO SUPPORT

The architecture should support:

Jumbo J01
Jumbo J02
Jumbo J03

Each Jumbo should have:

* Capacity
* Speed
* Current location
* Available time
* Operator
* Status

The current configuration uses:

1 Jumbo.

Do not build the architecture in a way that makes multiple Jumbos impossible later.

---

# 34. FUTURE SHIFT SUPPORT

The simulation should support:

Start time:
07:00

End time:
08:00

but should also work for:

07:00–15:30

15:30–23:30

23:30–07:00

Do not hard-code 07:00.

---

# 35. CORE DATA OBJECTS

Create these logical objects:

Material

POC

Store

DistanceMatrix

Jumbo

Trolley

Inventory

Trip

TripStop

ProductionPlan

SimulationEvent

Each Trip should contain:

tripId

startTime

endTime

duration

route

distance

trolleys

stops

status

deadline

safetyMargin

---

# 36. CORE ALGORITHM PSEUDOCODE

Use this overall logic:

START

Load configuration

Load material master

Remove inactive materials

Calculate production rate from Takt

Calculate hourly consumption for every material

Initialize POC inventory

Initialize POC trolley occupancy

Initialize Jumbo

Set simulation time = 07:00

WHILE simulation time < planning end:

```
Consume material according to production demand

Recalculate every material's:

    inventory

    coverage time

    predicted stock-out

    urgency

    replenishment deadline

Find materials requiring replenishment

Sort by urgency

IF Jumbo is available:

    Generate candidate 3-trolley groups

    For each candidate:

        Check POC capacity

        Generate possible routes

        Calculate store movement

        Calculate POC movement

        Calculate travel time

        Add handling time

        Calculate arrival time

        Check deadline

        Check production continuity

    Remove infeasible candidates

    Select feasible candidate

    Generate trip

    Execute/simulate trip

    Update inventory

    Update POC occupancy

    Update Jumbo availability

ELSE:

    Continue production simulation

Record events
```

END WHILE

Generate:

Trip Sheet

Timeline

Material Consumption Report

Jumbo Utilization

POC Inventory Report

Line Stop Risk Report

END

---

# 37. MOST IMPORTANT DESIGN PRINCIPLE

The application must think like a Mizusumashi planning system.

It should NOT think:

"Which three trolleys can I group?"

It should think:

"What material will run out first?"

Then:

"When must it arrive?"

Then:

"Which other materials can I combine with that trip?"

Then:

"What route can deliver all three?"

Then:

"Does the route respect POC capacity?"

Then:

"Will the Jumbo return in time for the next trip?"

Then:

"After delivery, what is the next stock-out?"

This is the fundamental intelligence of the application.

---

# 38. FINAL SYSTEM FLOW

The complete application logic is:

TAKT

↓

PRODUCTION DEMAND

↓

PART CONSUMPTION

↓

POC INVENTORY

↓

COVERAGE TIME

↓

STOCK-OUT PREDICTION

↓

REPLENISHMENT DEADLINE

↓

MATERIAL PRIORITY

↓

3-TROLLEY GROUPING

↓

POC CAPACITY CHECK

↓

STORE ROUTE OPTIMIZATION

↓

POC-TO-POC 2 M ROUTE

↓

TRAVEL + HANDLING TIME

↓

DEADLINE CHECK

↓

TRIP GENERATION

↓

JUMBO EXECUTION

↓

POC INVENTORY UPDATE

↓

EMPTY TROLLEY UPDATE

↓

NEXT STOCK-OUT

↓

NEXT TRIP

↓

CONTINUOUS LOOP

The final objective is:

NO LINE STOP
+
MINIMUM FEASIBLE TRAVEL
+
FULL JUMBO UTILIZATION
+
POC CAPACITY COMPLIANCE
+
DYNAMIC LINE FEEDING
+
REAL-TIME TRIP PLANNING

Do not simplify the above logic into a static timetable. The trip planner must remain dynamic and recalculate after every material consumption and every completed trip.
