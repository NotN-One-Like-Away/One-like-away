-- Echo Chamber Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name TEXT NOT NULL,
  avatar_config JSONB NOT NULL,
  is_bot BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  topic_tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes table
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Comments table
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Attractions table: stores behavioral drift for all agents
-- target_id can be either "topic:{canonical_topic}" or a user UUID
CREATE TABLE attractions (
  source_id UUID REFERENCES users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL,
  weight NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (source_id, target_id)
);

-- Indexes for performance
CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_likes_user_id ON likes(user_id);
CREATE INDEX idx_likes_post_id ON likes(post_id);
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_users_is_bot ON users(is_bot);
CREATE INDEX idx_users_expires_at ON users(expires_at);
CREATE INDEX idx_attractions_source_id ON attractions(source_id);
CREATE INDEX idx_attractions_target_id ON attractions(target_id);
CREATE INDEX idx_attractions_weight ON attractions(weight DESC);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attractions ENABLE ROW LEVEL SECURITY;

-- Policies: Allow all operations for now (hackathon mode)
-- In production, you'd want proper auth policies

CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on posts" ON posts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on likes" ON likes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on comments" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on attractions" ON attractions FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE posts;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE attractions;

-- Function to clean up expired users periodically (optional)
CREATE OR REPLACE FUNCTION cleanup_expired_users()
RETURNS void AS $$
BEGIN
  -- Don't actually delete, just mark as inactive
  -- This preserves the graph visualization
  UPDATE users
  SET display_name = display_name || ' (expired)'
  WHERE expires_at < NOW()
    AND is_bot = FALSE
    AND display_name NOT LIKE '% (expired)';
END;
$$ LANGUAGE plpgsql;
