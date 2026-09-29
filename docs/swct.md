A PERSON TAKES 2 FRAME AND 1 WHEEL AT A TIME
Copilot said:
If the operator can carry 2 Frames + 1 Wheel in one Jumbo trip, then you should treat this as one combined delivery cycle, not two separate trips.

Using your distances:

Stores → PL-03 (Frame) = 198 m
Stores → PL-13 (Wheel) = 204 m
Jumbo speed (loaded) = 0.72 sec per meter
Jumbo speed (empty) = 0.72 sec per meter

Loading = 10 sec per trolley
Unloading = 10 sec per trolley
Empty trolley pickup = 10 sec per trolley
Empty trolley drop 10 sec per trolley

Route

Plain Text
Stores
  ↓
Load 2 Frame + 1 Wheel
  ↓
PL-03
  ↓
Unload Frame trolley
Pick 2 Empty trolleys
  ↓
PL-13
  ↓
Unload Wheel trolley
Pick 1 Empty trolley
  ↓
Stores

Show more lines
Time Calculation
1. Load at Stores
2. Travel Stores → PL-03



Plain Text
198 / 0.72 = 275 sec
3. PL-03 Activity



Plain Text
Unload Frame trolley = 10 sec
Pick 2 empty trolleys = 20 sec
 
Total = 30 sec
``
4. Travel PL-03 → PL-13
From your layout, PL-03 and PL-13 are on the same line and very close.

Approximate distance:




Plain Text
25 m
Time:

5. PL-13 Activity



Plain Text
Unload Wheel trolley = 10 sec
Pick 1 empty trolley = 10 sec
 
Total = 20 sec
6. Return PL-13 → Stores



Plain Text
204 / 0.72 = 283 sec
SWCT Data
Step	Activity	Type	Time (sec)
1	Load 2 Frame + 1 Wheel	Manual	10
2	Move Stores → PL-03	Moving	275
3	Unload Frame Trolley	Manual	10
4	Pick 2 Empty Trolleys	Manual	20
5	Move PL-03 → PL-13	Moving	35
6	Unload Wheel Trolley	Manual	10
7	Pick 1 Empty Trolley	Manual	10
8	Return PL-13 → Stores	Moving	283
Totals
Manual Time



Plain Text
10 + 10 + 20 + 10 + 10
= 60 sec
Moving Time



Plain Text
275 + 35 + 283
= 593 sec
``
Total Cycle Time



Plain Text
653 sec = 10.88 min
SWCT Timeline



Plain Text
0s                                                             653s
│
├─ Load (10s)
├──────────────── Move to PL-03 (275s) ────────────────┐
│                                                      │
├─ Unload Frame (10s)                                  │
├─ Pick 2 Empty Trolley (20s)                          │
├──── Move PL-03 → PL-13 (35s) ────┐                  │
│                                  │                  │
├─ Unload Wheel (10s)              │                  │
├─ Pick Empty Trolley (10s)        │                  │
├──────── Return to Stores (283s) ────────────────────┘
│
End Cycle = 653 sec (10.88 min)
For your SWCT Excel, I would use:

Picking/Loading = 10 s
Moving = 593 s
Unloading/Empty Handling = 50 s
Total Cycle = 653 s (10.88 min)
This will produce a clean Toyota-style SWCT row for "2 Frames + 1 Wheel delivered in one Jumbo cycle."






