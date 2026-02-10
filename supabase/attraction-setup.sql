-- Attraction scoring table: materializes implicit behavioral patterns
-- Source can be any user, target can be a topic or another user
CREATE TABLE IF NOT EXISTS attraction (
  source_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id text NOT NULL, -- 'topic:fitness' or 'user:abc-123'
  weight float NOT NULL DEFAULT 0,
  updated_at timestamp DEFAULT now(),
  PRIMARY KEY (source_id, target_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_attraction_source ON attraction(source_id);
CREATE INDEX IF NOT EXISTS idx_attraction_target ON attraction(target_id);
CREATE INDEX IF NOT EXISTS idx_attraction_weight ON attraction(weight DESC);

-- RPC function to atomically update attraction scores
CREATE OR REPLACE FUNCTION increment_attraction(
  p_source_id uuid,
  p_target_id text,
  p_delta float
) RETURNS void AS $$
BEGIN
  INSERT INTO attraction (source_id, target_id, weight, updated_at)
  VALUES (p_source_id, p_target_id, p_delta, now())
  ON CONFLICT (source_id, target_id)
  DO UPDATE SET
    weight = attraction.weight + p_delta,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Optional: Function to get top attractions for visualization
CREATE OR REPLACE FUNCTION get_top_attractions(
  p_limit int DEFAULT 100
) RETURNS TABLE (
  source_id uuid,
  target_id text,
  weight float
) AS $$
BEGIN
  RETURN QUERY
  SELECT a.source_id, a.target_id, a.weight
  FROM attraction a
  WHERE a.weight > 0.1
  ORDER BY a.weight DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
