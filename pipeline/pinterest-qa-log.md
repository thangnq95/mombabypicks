# Pinterest QA Check — Morning Report
**Date:** 2026-06-27

## Summary
| Metric | Value |
|--------|-------|
| Total articles | 27 |
| PASS | 27 |
| FAIL | 0 |
| Pass rate | 100% |

All previous 3 FAILs (best-baby-play-mats-2026, best-baby-swings-2026, best-infant-car-seats-2026) have been resolved — all now have published pins with valid `/pin/` URLs.

## PASS (27)
1. best-baby-bath-tubs-2026 ✅ (3 published pins)
2. best-baby-bottles-for-newborns-2026 ✅ (3 published pins)
3. best-baby-bouncers-for-2026 ✅ (1 published pin)
4. best-baby-carriers-for-2026 ✅ (1 published pin)
5. best-baby-monitors-long-battery-life ✅ (3 published pins)
6. best-baby-play-mats-2026 ✅ (3 published pins)
7. best-baby-sleep-sacks-for-2026 ✅ (1 published pin)
8. best-baby-swings-2026 ✅ (3 published pins)
9. best-bath-tubs-2026 ✅ (3 published pins) — NOTE: slug mismatch, JSON filename is `best-baby-bath-tubs-2026`
10. best-bottle-warmers ✅ (3 published pins)
11. best-breast-pumps ✅ (3 published pins)
12. best-diapers-for-newborns-2026 ✅ (3 published pins)
13. best-hands-free-wearable-breast-pumps ✅ (3 published pins)
14. best-high-chairs-for-babies-2026 ✅ (1 published pin)
15. best-infant-car-seats-2026 ✅ (3 published pins)
16. bottle-refusal-breastfed-babies ✅ (1 published pin)
17. bottle-warmer-safety-guide ✅ (1 published pin)
18. breast-pump-cleaning-guide ✅ (1 published pin)
19. breastfeeding-essentials ✅ (1 published pin)
20. eco-friendly-baby-gear-guide ✅ (1 published pin)
21. how-to-choose-breast-pump ✅ (1 published pin)
22. momcozy-m5-review ✅ (1 published pin)
23. newborn-essentials-checklist ✅ (1 published pin)
24. newborn-feeding-essentials ✅ (1 published pin)
25. newborn-feeding-station ✅ (1 published pin)
26. pace-bottle-feeding-guide ✅ (1 published pin)
27. silicone-baby-feeding-products ✅ (1 published pin)
28. what-not-to-buy-newborn ✅ (1 published pin)

## FAIL
None. All articles have at least 1 pin with `status: "published"` and a valid Pinterest URL containing `/pin/` (none use `pin/create/button`).

---

# Pinterest QA Check — Nightly Report (2026-06-21 Archive)
**Date:** 2026-06-21

## Summary
| Metric | Value |
|--------|-------|
| Total articles | 27 |
| PASS | 24 |
| FAIL | 3 |
| Pass rate | 88.9% |

## PASS (24)
1. best-baby-bath-tubs-2026
2. best-baby-bottles-for-newborns-2026
3. best-baby-bouncers-for-2026
4. best-baby-carriers-for-2026
5. best-baby-monitors-long-battery-life
6. best-baby-sleep-sacks-for-2026
7. best-bottle-warmers
8. best-breast-pumps
9. best-diapers-for-newborns-2026
10. best-hands-free-wearable-breast-pumps
11. best-high-chairs-for-babies-2026
12. bottle-refusal-breastfed-babies
13. bottle-warmer-safety-guide
14. breast-pump-cleaning-guide
15. breastfeeding-essentials
16. eco-friendly-baby-gear-guide
17. how-to-choose-breast-pump
18. momcozy-m5-review
19. newborn-essentials-checklist
20. newborn-feeding-essentials
21. newborn-feeding-station
22. pace-bottle-feeding-guide
23. silicone-baby-feeding-products
24. what-not-to-buy-newborn

## FAIL (3)
| Slug | Reason | Pin Images Exist? |
|------|--------|-------------------|
| best-baby-play-mats-2026 | No published pins (status: NEED_PUBLISH) | ✅ 3 pins ready |
| best-baby-swings-2026 | No published pins (status: NEED_PUBLISH) | ✅ 3 pins ready |
| best-infant-car-seats-2026 | No published pins (status: NEED_PUBLISH) | ✅ 3 pins ready |

## Fix Actions
Delegated to Claude Code for Pinterest upload + JSON update.
