-- Add HCP-relevance flag to rounds
-- is_hcp_relevant = true  → round counts for WHS handicap index AND internal ranking
-- is_hcp_relevant = false → round counts for internal ranking ONLY (not handicap)

ALTER TABLE rounds
  ADD COLUMN IF NOT EXISTS is_hcp_relevant BOOLEAN NOT NULL DEFAULT true;
