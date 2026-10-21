-- Anonymous aggregate analytics only: NO addresses, seeds, keys or IPs.
CREATE TABLE IF NOT EXISTS scan_daily (
  day TEXT NOT NULL,
  chain TEXT NOT NULL CHECK(chain IN ('BTC','ETH')),
  total_scans INTEGER NOT NULL DEFAULT 0,
  successful_scans INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, chain)
);
-- Billing, user accounts and reports are deliberately NOT enabled in MVP.
