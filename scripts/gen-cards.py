"""Generates the dummy card catalog. Illustrative structures only — not any issuer's real terms."""
import yaml, os

STD_EXCL = [
    ("rent", "zero_earn"), ("fuel", "zero_earn"), ("wallet_load", "zero_earn"),
    ("government", "zero_earn"), ("insurance", "base_only"), ("jewellery", "base_only"),
]

def card(cid, name, issuer, network, tier_net, tier, min_age, max_age, emp, income,
         ppu, unit, currency, fee, joining, waiver, forex, accels, redemption,
         milestones=None, welcome=None, expiry=None, extra_excl=None, notes=None):
    excl = list(STD_EXCL) + (extra_excl or [])
    d = {
        "card_id": cid, "name": name, "issuer": issuer,
        "network": {"name": network, **({"tier": tier_net} if tier_net else {})},
        "tier": tier, "status": "active",
        "gates": {
            "min_age": min_age,
            **({"max_age": max_age} if max_age else {}),
            "allowed_employment": emp,
            "min_income": income,
        },
        "base": {"points_per_unit": ppu, "unit_inr": unit, "currency": currency},
        "fee": {"annual": fee, "joining": joining, **({"waiver_threshold": waiver} if waiver else {}), "gst_pct": 18},
        "forex_markup_pct": forex,
    }
    if welcome: d["welcome"] = welcome
    if expiry: d["points_expiry_months"] = expiry
    d["accelerators"] = [
        {"id": a[0], "scope": {"type": "category", "value": a[1]}, "multiplier": a[2],
         "basis": a[3], "cap": {"type": a[4], **({"value": a[5]} if a[5] else {}), "window": "statement_cycle"},
         "post_cap": a[6], "priority": 3, **({"notes": a[7]} if len(a) > 7 and a[7] else {})}
        for a in accels
    ]
    d["redemption"] = [
        {"channel": r[0], "inr_per_point": r[1], "min_points": r[2], "fee": 0,
         "is_default": r[3], **({"transfer_ratio": r[4]} if len(r) > 4 and r[4] else {})}
        for r in redemption
    ]
    d["milestones"] = [
        {"id": m[0], "threshold": m[1], "reward_type": m[2], "value_inr": m[3],
         "window": "annual", "cumulative": m[4], **({"notes": m[5]} if len(m) > 5 and m[5] else {})}
        for m in (milestones or [])
    ]
    d["exclusions"] = [{"category": c, "treatment": t} for c, t in excl]
    d["meta"] = {
        "terms_url": f"https://example.com/cards/{cid}",
        "effective_date": "2026-04-01", "last_verified": "2026-08-20",
        "owner": "ops@company.com", "confidence": "high",
    }
    d["notes"] = notes or "Illustrative structure for engine development. Not a real card."
    return d

SAL, SE, ST = "salaried", "self_employed", "student"

CARDS = [
    card("starter-secured", "Starter Secured", "Example Bank", "rupay", None, "entry",
         18, 65, [SAL, SE, ST], {SAL: 0, SE: 0, ST: 0},
         1, 100, "points", 0, 0, None, 3.5,
         [("ss-utilities", "utilities", 2, "total", "spend", 5000, 1)],
         [("cashback", 0.20, 500, True), ("voucher", 0.25, 1000, False)],
         notes="Entry/secured card. The floor of the catalog — always eligible, always available."),

    card("everyday-cashback", "Everyday Cashback", "Example Bank", "visa", "platinum", "entry",
         18, 65, [SAL, SE, ST], {SAL: 300000, SE: 400000, ST: 0},
         1, 100, "cashback", 500, 0, 100000, 3.5,
         [("ec-online", "online_shopping", 5, "total", "spend", 10000, 1)],
         [("cashback", 1.00, 500, True)],
         welcome={"points": 500, "condition": "Spend ₹10,000 in the first 30 days"},
         notes="Flat cashback card. 1 point = ₹1, so the base rate is a true 1%."),

    card("dine-club", "Dine Club", "Example Bank", "mastercard", "world", "mid",
         21, 65, [SAL, SE], {SAL: 400000, SE: 600000},
         4, 150, "points", 1000, 500, 200000, 3.5,
         [("dc-dining", "dining", 5, "total", "points", 3000, 1, "Co-brand accelerator with Swiggy."),
          ("dc-entertainment", "entertainment", 3, "total", "spend", 5000, 1)],
         [("cashback", 0.25, 1000, False), ("voucher", 0.30, 1000, True), ("portal", 0.35, 2000, False)],
         welcome={"points": 2000, "condition": "Spend ₹25,000 in the first 60 days"}, expiry=24,
         notes="Dining-led co-brand. Deliberately close to grocery-max on NAV to exercise the tiebreak."),

    card("grocery-max", "Grocery Max", "Example Bank", "rupay", None, "mid",
         21, 70, [SAL, SE], {SAL: 400000, SE: 500000},
         2, 100, "points", 750, 0, 150000, 2.0,
         [("gm-groceries", "groceries", 5, "total", "spend", 15000, 1),
          ("gm-departmental", "departmental", 3, "total", "spend", 8000, 1)],
         [("cashback", 0.25, 500, True), ("voucher", 0.30, 1000, False)],
         notes="Groceries-led. Low forex to give the international-spend path something to differentiate."),

    card("rewards-multiplier", "Rewards Multiplier", "Example Bank", "mastercard", "world", "mid",
         21, 65, [SAL, SE], {SAL: 600000, SE: 800000},
         2, 150, "points", 2500, 500, 300000, 3.5,
         [("rm-dining", "dining", 10, "total", "points", 2500, 1, "Points cap, back-solved into qualifying spend."),
          ("rm-online", "online_shopping", 5, "total", "spend", 15000, 1)],
         [("cashback", 0.25, 1000, False), ("voucher", 0.35, 1000, True),
          ("portal", 0.50, 1000, False), ("airmiles", 0.85, 2000, False, "2:1")],
         welcome={"points": 5000, "condition": "Spend ₹50,000 in the first 90 days"}, expiry=36,
         notes="The workhorse mid-tier card. Redemption channel swings its value by ~3x."),

    card("axis-shop-plus", "Shop Plus", "Example Bank", "visa", "signature", "mid",
         21, 65, [SAL, SE], {SAL: 500000, SE: 700000},
         2, 100, "points", 1500, 500, 250000, 3.5,
         [("sp-online", "online_shopping", 10, "total", "points", 4000, 0,
           "post_cap 0 — stops earning entirely past the cap. The trap this field exists to catch."),
          ("sp-apparel", "apparel", 5, "total", "spend", 10000, 1),
          ("sp-electronics", "electronics", 5, "total", "spend", 10000, 1)],
         [("cashback", 0.25, 1000, False), ("voucher", 0.40, 1000, True), ("merchandise", 0.30, 2000, False)],
         welcome={"points": 3000, "condition": "Spend ₹30,000 in the first 60 days"},
         notes="Amazon co-brand. Demonstrates post_cap=0: earning stops dead past the cap."),

    card("commute-saver", "Commute Saver", "Example Bank", "rupay", None, "entry",
         18, 65, [SAL, SE, ST], {SAL: 200000, SE: 300000, ST: 0},
         1, 100, "points", 250, 0, 60000, 3.5,
         [("cs-transit", "cabs_transit", 5, "total", "spend", 4000, 1),
          ("cs-telecom", "telecom", 5, "total", "spend", 2000, 1),
          ("cs-utilities", "utilities", 3, "total", "spend", 3000, 1)],
         [("cashback", 0.50, 200, True), ("voucher", 0.55, 1000, False)],
         notes="Low-fee utility card with tight caps — exercises the cap-overflow path hard."),

    card("travel-elite", "Travel Elite", "Example Bank", "visa", "infinite", "premium",
         21, 65, [SAL, SE], {SAL: 1800000, SE: 2400000},
         2, 100, "points", 10000, 10000, 800000, 2.0,
         [("te-air", "travel_air", 5, "total", "spend", 50000, 1),
          ("te-hotel", "travel_hotel", 5, "total", "spend", 50000, 1),
          ("te-intl", "international", 3, "total", "none", None, 1,
           "Uncapped on international spend — rare, and worth double-checking in real terms.")],
         [("cashback", 0.30, 1000, False), ("voucher", 0.40, 1000, False),
          ("portal", 0.60, 1000, False), ("airmiles", 1.00, 1000, True, "1:1")],
         milestones=[("te-ms1", 400000, "voucher", 5000, True, "₹5,000 voucher at ₹4L annual spend"),
                     ("te-ms2", 800000, "voucher", 10000, True, "₹10,000 voucher at ₹8L annual spend")],
         welcome={"points": 15000, "condition": "Spend ₹1,00,000 in the first 90 days"},
         notes="Premium travel card. High fee gates it out unless the fee budget is raised."),

    card("apex-infinite", "Apex Infinite", "Example Bank", "amex", None, "super_premium",
         21, 70, [SAL, SE], {SAL: 3600000, SE: 4800000},
         3, 100, "points", 50000, 25000, 2000000, 1.5,
         [("ai-travel", "travel_air", 5, "total", "none", None, 1),
          ("ai-hotel", "travel_hotel", 5, "total", "none", None, 1),
          ("ai-dining", "dining", 3, "total", "none", None, 1)],
         [("cashback", 0.40, 1000, False), ("portal", 0.75, 1000, False), ("airmiles", 1.20, 1000, True, "1:1")],
         milestones=[("ai-ms1", 1500000, "voucher", 25000, True, "₹25,000 voucher at ₹15L annual spend")],
         welcome={"points": 40000, "condition": "Spend ₹3,00,000 in the first 90 days"},
         notes="Super-premium, uncapped accelerators. Only wins at very high spend — a useful ceiling test."),

    card("legacy-classic", "Legacy Classic", "Example Bank", "visa", None, "entry",
         18, 65, [SAL, SE], {SAL: 250000, SE: 350000},
         1, 150, "points", 300, 0, 50000, 3.5,
         [("lc-departmental", "departmental", 2, "total", "spend", 5000, 1)],
         [("cashback", 0.20, 1000, True)],
         notes="Discontinued — proves the STATUS gate hides it from results entirely."),
]
CARDS[-1]["status"] = "discontinued"

os.makedirs("catalog/cards", exist_ok=True)
for c in CARDS:
    with open(f"catalog/cards/{c['card_id']}.yaml", "w") as f:
        f.write(f"# {c['name']} — {c['issuer']}\n")
        f.write("# DUMMY DATA. Illustrative structure for engine development only.\n\n")
        yaml.safe_dump(c, f, sort_keys=False, allow_unicode=True, width=100)
print(f"wrote {len(CARDS)} cards")
