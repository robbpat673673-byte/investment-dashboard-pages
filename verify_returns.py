from decimal import Decimal, ROUND_HALF_UP

samples = {
    "ALI006": {
        "latest": Decimal("749.900000"),
        "baseline": [Decimal("773.580000"), Decimal("687.610000"), Decimal("710.630000"), Decimal("465.870000"), Decimal("258.420000"), Decimal("387.530000")],
        "db": [Decimal("-3.0611"), Decimal("9.0589"), Decimal("5.5261"), Decimal("60.9677"), Decimal("190.1865"), Decimal("93.5076")],
    },
    "4603": {
        "latest": Decimal("16.475300"),
        "baseline": [Decimal("16.385200"), Decimal("16.304900"), Decimal("16.359800"), Decimal("14.408500"), Decimal("12.454700"), Decimal("13.489600")],
        "db": [Decimal("0.5499"), Decimal("1.0451"), Decimal("0.7060"), Decimal("14.3443"), Decimal("32.2818"), Decimal("22.1333")],
    },
    "AU07": {
        "latest": Decimal("10.960000"),
        "baseline": [Decimal("10.980000"), Decimal("10.740000"), Decimal("10.860000"), Decimal("10.880000"), Decimal("10.340000"), Decimal("10.660000")],
        "db": [Decimal("-0.1821"), Decimal("2.0484"), Decimal("0.9208"), Decimal("0.7353"), Decimal("5.9961"), Decimal("2.8143")],
    },
    "NOM006": {
        "latest": Decimal("472.750000"),
        "baseline": [Decimal("466.410000"), Decimal("394.490000"), Decimal("412.190000"), Decimal("274.150000"), Decimal("161.990000"), Decimal("224.420000")],
        "db": [Decimal("1.3593"), Decimal("19.8383"), Decimal("14.6923"), Decimal("72.4421"), Decimal("191.8390"), Decimal("110.6541")],
    },
}
labels = ["week", "month", "quarter", "halfYear", "year", "ytd"]
quantum = Decimal("0.0001")
all_ok = True
for code, item in samples.items():
    print(code)
    for label, baseline, db_value in zip(labels, item["baseline"], item["db"]):
        calculated = ((item["latest"] / baseline) - Decimal(1)) * Decimal(100)
        rounded = calculated.quantize(quantum, rounding=ROUND_HALF_UP)
        ok = rounded == db_value
        all_ok = all_ok and ok
        print(f"  {label}: {rounded}% vs db {db_value}% -> {'OK' if ok else 'MISMATCH'}")
if not all_ok:
    raise SystemExit(1)
print("ALL_CHECKS_OK")
