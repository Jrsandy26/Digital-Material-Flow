# TRIP GROUPING ALGORITHM — MIZUSUMASHI / JUMBO

Build only the **Trip Grouping Algorithm** for the Mizusumashi/Jumbo planning engine.

The algorithm must dynamically group material-replenishment requirements into Jumbo trips with a maximum capacity of **3 trolleys per trip**.

The grouping objective is:

> **Prevent line stoppage first, then protect minimum carry-over stock, then meet delivery deadlines, then optimize operator workload, travel distance, trip time, and trolley utilization.**

Do not hard-code any part, operator, store, POC, distance, quantity, or timing value. Everything must come dynamically from the input data and the current planning state.

---

## 1. INPUT TO GROUPING ENGINE

For every material requirement, receive:

```text
Operator ID
Jumbo/Manual
Part No
Description
Qty Per Trolley
Parts Per Vehicle
Store
POC
Load Distance
Empty Distance
Current Line Stock
Minimum Carry-over Stock
Consumption Rate
Critical Time
Required Arrival Time
Latest Dispatch Time
Required Trolley Quantity
Already Scheduled Quantity
In-transit Quantity
Material Priority
```

Global parameters:

```text
Maximum Trolleys Per Jumbo = 3
Loaded Speed
Empty Speed
Store Load Time
POC Unload Time
POC Empty Load Time
Store Empty Unload Time
Safety Buffer
Current Time
```

---

# 2. FILTER ELIGIBLE MATERIALS

Only materials assigned to:

```text
Jumbo
```

are eligible for automatic trip grouping.

Ignore:

```text
Manual
```

materials unless manual-material emergency handling is explicitly enabled.

Group materials by:

```text
Operator ID
```

A Jumbo operator must only receive materials that he is authorized to handle.

---

# 3. CREATE PENDING REQUIREMENT LIST

Calculate the remaining requirement for each material:

```text
Outstanding Trolleys =
Required Trolley Quantity
- Already Scheduled Trolleys
- In-transit Trolleys
```

If:

```text
Outstanding Trolleys <= 0
```

do not create a trip requirement.

For every remaining requirement calculate:

```text
Time To Minimum
Critical Time
Required Arrival Time
Latest Dispatch Time
```

---

# 4. PRIORITY ORDER

Sort all pending requirements using this priority:

```text
1. Existing / predicted LINE STOP RISK
2. Earliest Latest-Dispatch-Time
3. Lowest Time-To-Minimum
4. Minimum Carry-over Risk
5. Material Priority
6. Operator workload balance
```

The material with the highest immediate line-stop risk becomes the **SEED MATERIAL** for the next trip.

Never select a lower-priority material as the seed if a higher-priority material is already at risk.

---

# 5. TRIP CREATION — SEED + FILL METHOD

For every new trip:

### Step 1 — Select Seed

Select the highest-priority pending material.

Example:

```text
Seed = FRAME
```

Create:

```text
Trip T001
Trolley 1 = FRAME
```

Capacity remaining:

```text
3 - 1 = 2 trolley slots
```

---

# 6. FIND COMPATIBLE CANDIDATES

Search the remaining pending requirements for possible Trolley 2 and Trolley 3 candidates.

A candidate is compatible only if:

```text
Same Operator
AND
Jumbo eligible
AND
Trolley requirement > 0
AND
Can physically be included in the route
AND
Its delivery deadline can still be satisfied
```

Preferred candidates should have:

```text
Same POC
OR
Same Store
OR
Compatible route
OR
Very low additional route time
```

---

# 7. SAME POC GROUPING

Prefer grouping materials going to the same POC.

Example:

```text
Frame       → PL-03
Sub Frame   → PL-03
Swingarm    → PL-03
```

Preferred grouping:

```text
T1 = Frame
T2 = Sub Frame
T3 = Swingarm
POC = PL-03
```

Do not automatically group different POCs just because trolley space is available.

---

# 8. DIFFERENT STORE / SAME POC

Treat Store and POC independently.

Example:

```text
Frame
Store = E10-17
POC = PL-03

Sub Frame
Store = E07,09
POC = PL-03
```

These are different pickup locations even though the POC is the same.

The route optimizer must account for the separate Store locations.

Do not simply merge them into one Store.

---

# 9. MULTI-POC GROUPING

Different POCs may be grouped only when the complete route remains feasible.

Example:

```text
T1 = Frame → PL-03
T2 = Wheel → PL-13
```

Calculate the complete route:

```text
Store pickup sequence
→ POC delivery sequence
→ Return to Store/base
```

Then calculate the exact arrival time for each trolley.

Accept the grouping only if:

```text
ArrivalTime(Material i)
<=
RequiredArrivalTime(Material i)
```

for EVERY trolley in the trip.

If one candidate causes another material to miss its deadline:

```text
REJECT CANDIDATE
```

---

# 10. MAXIMUM CAPACITY

Never create a trip with more than:

```text
3 trolleys
```

Valid:

```text
1 trolley
2 trolleys
3 trolleys
```

Invalid:

```text
4+ trolleys
```

The algorithm must not force 3 trolleys into every trip.

3 is the maximum, not the minimum.

---

# 11. CANDIDATE SCORING

For every possible candidate trolley, calculate:

```text
Line Stop Risk
Deadline Risk
Carry-over Risk
Additional Travel Distance
Additional Travel Time
Operator Workload Impact
Unused Jumbo Capacity
POC Compatibility
Store Compatibility
```

Calculate a candidate score:

```text
CandidateScore =
W1 × LineStopRisk
+ W2 × DeadlineRisk
+ W3 × CarryOverRisk
+ W4 × OperatorOverload
+ W5 × AdditionalTravelTime
+ W6 × AdditionalDistance
+ W7 × UnusedCapacity
```

Use:

```text
W1 > W2 > W3 > W4 > W5 > W6 > W7
```

Therefore:

**line-stop prevention is always more important than distance optimization.**

---

# 12. CANDIDATE SELECTION

For the remaining trolley slots:

1. Find all compatible candidates.
2. Calculate the candidate score.
3. Reject candidates that create a deadline violation.
4. Reject candidates that create minimum-stock violation.
5. Reject candidates that make the operator infeasible.
6. Select the lowest-cost feasible candidate.
7. Add it to the trip.
8. Recalculate the complete trip.
9. Repeat until:

   * capacity = 3, or
   * no additional feasible candidate exists.

---

# 13. DO NOT DELAY A CRITICAL MATERIAL JUST TO FILL THE JUMBO

Example:

```text
Frame deadline = 07:08
Wheel deadline = 07:25
```

If adding Wheel causes Frame arrival to become:

```text
07:10
```

then:

```text
REJECT WHEEL
```

Generate:

```text
Trip T001:
Frame
```

Do not delay the Frame delivery merely to use all 3 trolley positions.

---

# 14. TRIP ROUTE CALCULATION

After candidate selection, calculate the complete trip.

For each route segment:

```text
Loaded Travel Time =
Load Distance / Loaded Speed

Empty Travel Time =
Empty Distance / Empty Speed
```

Handling:

```text
Store Load Time

+
Number of Trolleys × POC Unload Time

+
Number of Trolleys × POC Empty Load Time

+
Number of Trolleys × Store Empty Unload Time
```

For a multi-stop route, sum all applicable route segments and handling events in the actual operating sequence.

Calculate:

```text
Total Trip Time
Dispatch Time
Arrival Time for each POC
Return Time
Next Available Time of Operator
```

---

# 15. ARRIVAL VALIDATION

For every trolley in the trip:

```text
Projected Stock at Arrival =
Current Stock
+ In-transit / incoming quantity before arrival
+ Current Trip Quantity
- Forecast Consumption until Arrival
```

Check:

```text
Projected Stock at Arrival >= Minimum Carry-over Stock
```

If false:

```text
TRIP INFEASIBLE
```

and re-group the trip.

---

# 16. MULTI-TRIP CONFLICT CHECK

Before finalizing the trip, check all other scheduled trips for the same operator.

The new trip must not overlap an existing trip:

```text
New Dispatch >= Previous Trip Return
```

or:

```text
New Trip Start >= Operator Available Time
```

If overlap occurs:

```text
Shift the trip
```

and recheck all affected material deadlines.

If shifting causes deadline failure:

```text
PLAN INFEASIBLE
```

---

# 17. RESERVE MATERIAL

Once a trip is accepted:

```text
Scheduled Trolley Quantity += Assigned Quantity
Reserved Trolley Quantity += Assigned Quantity
```

Update:

```text
Expected Incoming Stock
Operator Availability
Jumbo Availability
Pending Requirements
```

Do not allow the same material quantity to be assigned to another trip.

---

# 18. CONTINUE TRIP GENERATION

After finalizing one trip:

```text
Remove satisfied requirements
```

Then repeat:

```text
Select next highest-priority pending requirement
→ Create new seed
→ Fill remaining trolley slots
→ Calculate route
→ Validate deadlines
→ Reserve capacity
→ Finalize trip
```

Continue until:

```text
No pending requirements
```

or:

```text
Planning horizon completed
```

---

# 19. DYNAMIC REPLANNING

The grouping algorithm must rerun whenever any of these change:

```text
Actual production
Actual consumption
Line-side stock
Jumbo status
Trip completion
Trip delay
Material arrival
Operator assignment
Available trolley quantity
Store availability
POC availability
Distance
Speed
Carry-over requirement
```

Never assume the original trip grouping remains optimal.

---

# 20. DELAY HANDLING

If a trip is delayed:

```text
Expected Arrival Time
```

must be updated.

Then recalculate the affected materials.

If:

```text
New Projected Stock at Arrival < Minimum Carry-over
```

trigger:

```text
EMERGENCY RE-GROUPING
```

Search for:

```text
Another available Jumbo
Another operator
Earlier available trip slot
Alternative compatible trip
Manual emergency movement
```

according to configured operational rules.

---

# 21. DUPLICATE PROTECTION

Before creating any new trip, verify:

```text
Is material already:

Scheduled?
Loading?
In Transit?
At POC?
Completed?
```

If yes, reduce its outstanding requirement accordingly.

Never create duplicate replenishment for the same required quantity.

---

# 22. OVER-DELIVERY PROTECTION

Do not send material simply because Jumbo capacity is available.

For every candidate trolley calculate:

```text
Required Quantity
+
Minimum Stock
-
Current Stock
-
Confirmed Incoming
```

If the result is zero or negative:

```text
Do not add the trolley
```

unless the material is required for a future confirmed replenishment window.

---

# 23. GROUPING STRATEGY

Use this order:

```text
FIRST:
Critical material

SECOND:
Same Store + same POC

THIRD:
Same POC + compatible Store route

FOURTH:
Different POC with feasible route

FIFTH:
Additional material that reduces future trips
```

Never sacrifice an earlier priority to maximize trolley utilization.

---

# 24. FINAL TRIP GROUPING LOGIC

The algorithm must follow this exact sequence:

```text
START
  ↓
Read pending material requirements
  ↓
Remove already covered requirements
  ↓
Calculate urgency
  ↓
Sort by line-stop risk / deadline
  ↓
Select highest-priority material as SEED
  ↓
Create new Jumbo trip
  ↓
Assign Seed Trolley
  ↓
Check remaining capacity
  ↓
Find compatible candidates
  ↓
Score candidates
  ↓
Test route
  ↓
Test travel time
  ↓
Test arrival deadlines
  ↓
Test minimum carry-over
  ↓
Test operator availability
  ↓
Test duplicate / reserved quantity
  ↓
If feasible → add candidate
  ↓
If infeasible → reject candidate
  ↓
Capacity = 3 OR no feasible candidate?
  ↓
YES
  ↓
Finalize Trip
  ↓
Reserve materials and trolley capacity
  ↓
Update projected incoming stock
  ↓
Update operator availability
  ↓
Select next highest-priority requirement
  ↓
Repeat
  ↓
END
```

---

# 25. OUTPUT OF THE GROUPING ALGORITHM

Every trip must produce:

```text
Trip ID
Operator ID
Dispatch Time
Store Sequence
POC Sequence

Trolley 1
Trolley 2
Trolley 3

Part Numbers
Quantities

Total Loaded Distance
Total Empty Distance
Total Travel Time
Total Handling Time
Total Trip Time

Expected Arrival Time
Expected Return Time

Critical Material
Minimum Stock
Projected Stock At Arrival

Trip Priority
Trip Status
Feasibility Status
```

The algorithm's fundamental rule is:

> **Select the most urgent material first, then fill the remaining Jumbo trolley capacity only with materials that can be delivered within their deadlines without violating minimum carry-over stock, operator availability, or route constraints.**

The algorithm must optimize **feasible line continuity first**, and only then optimize **grouping efficiency and travel reduction**.
