# Capacity and growth

## What the current code does

`QC_APP.MAX_REPORT_ROWS` is 50,000. `qcFwReport_` checks the total event count in the active `ESP32_Log` before applying date/entity filters or using its report cache. When the count exceeds the limit, Dashboard and report requests return `REPORT_LIMIT`.

Device ingestion has a separate path and does not enforce this report limit. It searches existing Event_ID values to guard against duplicates and appends a new ledger row after validating the immutable job snapshot. It has no archive rotation or cross-workbook deduplication mechanism. If the workbook cannot grow, the save returns an error instead of a committed receipt. Existing records are not overwritten to make space.

Each raw event row contains 18 fields; `Report_Data` adds 14 derived reporting columns. Ten million event rows need 180 million raw-log cells alone, before derived data, blank allocated columns and other tabs. One spreadsheet is therefore unsuitable as the lifetime event store for that target.

## Planned Sheets upgrade

Rotate to a separate data workbook before the active report limit, using a configurable row threshold with headroom (for example, 40,000 rows) and a calendar boundary, whichever occurs first. Retain the accounts, registry, job history and configuration in a control workbook.

Maintain an archive registry and incremental summaries so historical dashboard totals do not require reading every raw event on every refresh. Read raw details only from relevant date ranges and page them on the server. Preserve Event_ID/hash uniqueness across every archive and acknowledge an event only after its durable save is confirmed. Rollover, interrupted writes, delayed offline replay and concurrent devices require explicit tests.

Do not manually delete or move raw ledger rows as a shortcut. The existing code ties totals, snapshots and duplicate checks to the current ledger; rotation requires coordinated code changes.

## Millions of lifetime events

Use an indexed database as the event store, keeping the existing dashboard interface. Preserve the firmware's assignment and receipt contract, add appropriate event ID/date/entity indexes, and use precomputed summary tables for charts. Choose and size the hosting based on device count, peak event rate, retention, backup requirements and measured query latency.

These changes are a plan. They are not part of v3.2.1.
