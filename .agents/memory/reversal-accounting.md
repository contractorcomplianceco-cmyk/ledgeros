---
name: Journal entry reversal posting date
description: Reversals must post into the current open period, not the original entry's (possibly locked) period.
---

# Reversal entries post into the current open period

When reversing a posted journal entry, the reversal entry's date must be the
**current open period (today)**, not the original entry's date. The lock check
must validate against the reversal date, not the original entry date.

**Why:** the whole point of "posted entries are immutable, correct via reversal"
is to fix mistakes in periods that are already closed/locked. If the reversal is
hard-coded to the original date and the lock is checked against that original
date, reversal of any locked-period entry is impossible — defeating the model.

**How to apply:** any double-entry ledger with period locking. Original posted
entry stays immutable (only its `reversedById`/status is updated); the reversal
is a new posted entry dated today with debit/credit swapped.
