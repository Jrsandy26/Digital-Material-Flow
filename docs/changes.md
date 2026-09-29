there is an new requirement for the user need the output he shift handover data should be like this format.

s.no	Model No	PART NO	Description	BIN/Trolley	Store	POC Point	Trip ID(8hrs)
1	IQube	KE090530	SWINGARM SUB ASSY DRUM	Trolley	E 03,04	PL-03	4,7
2	IQube	K6100890	LOWER BRKT COMP	Trolley	E 05,06	PL-13	5,6
3	IQube	KE121500	SUB FRAME COMP	Trolley	E 07,09	PL-03	2,7,
4	IQube	KE121530	FRAME, SCOOTER COMP	Trolley	E 10-17	PL-03	1 to 64
5	IQube	KE110470	WHEEL ASSY DISC  TUBELESS	Trolley	B 15,16	PL-13	1,3,4,6


Expected Output:

SWINGARM:4,7,12,15,20,23,28,31,36,39,44,47,52,55,60,63

LOWER BRKT: 5,6,13,14,21,22,29,30,37,38,45,46,53,54,61,62
SUB FRAME:2,5,7,10,13,15,18,21,23,26,29,31,34,37,39,42,45,47,50,53,55,58,61,63
FRAME:based on the requirequremt or takt time
WHEEL:1,3,4,6,9,11,12,14,17,19,20,22,25,27,28,30,33,35,36,38,41,43,44,46,49,51,52,54,57,59,60,62


note all trips or based on the takt time we need to deliver on the poc on time without line stoper occurs also we need to group and deliver parts  or refer the current grouping algorithm use this and run for one shoft completely the generate the output like the eg.