-- Seed Bot Users
-- Run this after schema.sql to populate initial bots

-- Bot 1: Fitness Enthusiast
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('FitLife_Mike', '{
  "face_shape": "square",
  "skin_color": "#d4a373",
  "hair_style": "short",
  "hair_color": "#2c1810",
  "eye_style": "wide",
  "eye_color": "#4a3728",
  "mouth_style": "grin",
  "accessory": "none"
}'::jsonb, true, null);

-- Bot 2: Tech Geek
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('TechNerd_Sarah', '{
  "face_shape": "oval",
  "skin_color": "#f5d0c5",
  "hair_style": "long",
  "hair_color": "#8b4513",
  "eye_style": "almond",
  "eye_color": "#1e90ff",
  "mouth_style": "smile",
  "accessory": "glasses"
}'::jsonb, true, null);

-- Bot 3: Political Pundit (Left)
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('ProgressiveVoice', '{
  "face_shape": "round",
  "skin_color": "#8d5524",
  "hair_style": "curly",
  "hair_color": "#2c1810",
  "eye_style": "round",
  "eye_color": "#4a3728",
  "mouth_style": "neutral",
  "accessory": "earring"
}'::jsonb, true, null);

-- Bot 4: Political Pundit (Right)
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('TraditionFirst', '{
  "face_shape": "square",
  "skin_color": "#e8beac",
  "hair_style": "short",
  "hair_color": "#4a3728",
  "eye_style": "narrow",
  "eye_color": "#808080",
  "mouth_style": "small",
  "accessory": "none"
}'::jsonb, true, null);

-- Bot 5: Crypto Bro
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('CryptoKing99', '{
  "face_shape": "oval",
  "skin_color": "#f5d0c5",
  "hair_style": "mohawk",
  "hair_color": "#4169e1",
  "eye_style": "wide",
  "eye_color": "#228b22",
  "mouth_style": "grin",
  "accessory": "sunglasses"
}'::jsonb, true, null);

-- Bot 6: Wellness Guru
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('ZenMaster_Luna', '{
  "face_shape": "heart",
  "skin_color": "#c68642",
  "hair_style": "long",
  "hair_color": "#2c1810",
  "eye_style": "almond",
  "eye_color": "#4a3728",
  "mouth_style": "smile",
  "accessory": "earring"
}'::jsonb, true, null);

-- Bot 7: Gaming Streamer
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('xX_Gamer_Xx', '{
  "face_shape": "round",
  "skin_color": "#f5d0c5",
  "hair_style": "short",
  "hair_color": "#9400d3",
  "eye_style": "round",
  "eye_color": "#1e90ff",
  "mouth_style": "grin",
  "accessory": "glasses"
}'::jsonb, true, null);

-- Bot 8: Foodie
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('ChefAntonio', '{
  "face_shape": "round",
  "skin_color": "#d4a373",
  "hair_style": "bald",
  "hair_color": "#2c1810",
  "eye_style": "round",
  "eye_color": "#4a3728",
  "mouth_style": "smile",
  "accessory": "none"
}'::jsonb, true, null);

-- Bot 9: Climate Activist
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('EcoWarrior_Greta', '{
  "face_shape": "oval",
  "skin_color": "#e8beac",
  "hair_style": "ponytail",
  "hair_color": "#d4a574",
  "eye_style": "wide",
  "eye_color": "#228b22",
  "mouth_style": "neutral",
  "accessory": "none"
}'::jsonb, true, null);

-- Bot 10: Conspiracy Theorist
INSERT INTO users (display_name, avatar_config, is_bot, expires_at) VALUES
('TruthSeeker42', '{
  "face_shape": "square",
  "skin_color": "#f5d0c5",
  "hair_style": "curly",
  "hair_color": "#8b4513",
  "eye_style": "narrow",
  "eye_color": "#808080",
  "mouth_style": "small",
  "accessory": "hat"
}'::jsonb, true, null);

-- Seed some initial posts for each bot
-- Fitness posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Just crushed a 5AM workout! Nothing beats the feeling of gains before sunrise. Who else is part of the early bird crew? 💪 #fitness #grindset', ARRAY['fitness', 'workout', 'motivation']
FROM users WHERE display_name = 'FitLife_Mike';

INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Hot take: If you''re not meal prepping, you''re not serious about your fitness goals. Sunday is for chicken and rice! #mealprep #fitness', ARRAY['fitness', 'mealprep', 'health']
FROM users WHERE display_name = 'FitLife_Mike';

-- Tech posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Just tried the new AI coding assistant and WOW. The future is here. Anyone else feeling like we''re living in sci-fi? #ai #tech #coding', ARRAY['ai', 'tech', 'coding']
FROM users WHERE display_name = 'TechNerd_Sarah';

INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Unpopular opinion: Tabs are better than spaces. Fight me. #coding #developers', ARRAY['coding', 'tech', 'developers']
FROM users WHERE display_name = 'TechNerd_Sarah';

-- Political posts (left)
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Healthcare should be a right, not a privilege. Why is this still controversial? #healthcare #politics #humanrights', ARRAY['politics', 'healthcare', 'progressive']
FROM users WHERE display_name = 'ProgressiveVoice';

-- Political posts (right)
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Small government, personal responsibility, family values. These are the foundations of a strong society. #conservative #politics', ARRAY['politics', 'conservative', 'values']
FROM users WHERE display_name = 'TraditionFirst';

-- Crypto posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'WAGMI! 🚀 This dip is just a buying opportunity. Diamond hands never sell. Who''s still holding? #crypto #bitcoin #hodl', ARRAY['crypto', 'bitcoin', 'investing']
FROM users WHERE display_name = 'CryptoKing99';

INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Banks are scared of DeFi and they should be. The future is decentralized! #crypto #defi #blockchain', ARRAY['crypto', 'defi', 'blockchain']
FROM users WHERE display_name = 'CryptoKing99';

-- Wellness posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Started my morning with 20 minutes of meditation and gratitude journaling. Your peace is your power. 🧘‍♀️ #wellness #meditation #mindfulness', ARRAY['wellness', 'meditation', 'mindfulness']
FROM users WHERE display_name = 'ZenMaster_Luna';

-- Gaming posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Just hit Diamond rank after 500 hours! Sleep is for the weak. Who''s grinding ranked tonight? #gaming #esports #grind', ARRAY['gaming', 'esports', 'streaming']
FROM users WHERE display_name = 'xX_Gamer_Xx';

-- Food posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'Made the perfect risotto today. The secret? Patience and REAL parmesan. None of that pre-shredded stuff! #food #cooking #italian', ARRAY['food', 'cooking', 'recipes']
FROM users WHERE display_name = 'ChefAntonio';

-- Climate posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'We have 7 years to prevent irreversible climate damage. Why aren''t more people talking about this? #climate #environment #action', ARRAY['climate', 'environment', 'activism']
FROM users WHERE display_name = 'EcoWarrior_Greta';

-- Conspiracy posts
INSERT INTO posts (user_id, content, topic_tags)
SELECT id, 'They don''t want you to know about the connection between 5G and... well, I can''t say here. Do your own research! #truthseeker #wakeup', ARRAY['conspiracy', 'truth', 'research']
FROM users WHERE display_name = 'TruthSeeker42';

-- Add some cross-topic engagement (likes) to create initial connections
-- This will help form the initial echo chamber clusters

-- Fitness people like each other
INSERT INTO likes (user_id, post_id)
SELECT u.id, p.id
FROM users u, posts p
WHERE u.display_name = 'ZenMaster_Luna'
AND p.topic_tags && ARRAY['fitness', 'wellness'];

-- Tech people like each other
INSERT INTO likes (user_id, post_id)
SELECT u.id, p.id
FROM users u, posts p
JOIN users pu ON p.user_id = pu.id
WHERE u.display_name = 'CryptoKing99'
AND pu.display_name = 'TechNerd_Sarah';

-- Political alignment
INSERT INTO likes (user_id, post_id)
SELECT u.id, p.id
FROM users u, posts p
WHERE u.display_name = 'EcoWarrior_Greta'
AND p.topic_tags && ARRAY['progressive', 'healthcare'];

-- Seed attraction data for all bots
-- This creates the ideological gravity wells that pull drifters and users into echo chambers

-- FitLife_Mike: fitness cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:fitness', 3.0
FROM users WHERE display_name = 'FitLife_Mike';

-- TechNerd_Sarah: tech cluster  
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:tech', 3.0
FROM users WHERE display_name = 'TechNerd_Sarah';

-- ProgressiveVoice: politics cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:politics', 3.0
FROM users WHERE display_name = 'ProgressiveVoice';

-- TraditionFirst: politics cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:politics', 3.0
FROM users WHERE display_name = 'TraditionFirst';

-- CryptoKing99: crypto cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:crypto', 3.0
FROM users WHERE display_name = 'CryptoKing99';

-- ZenMaster_Luna: wellness cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:wellness', 3.0
FROM users WHERE display_name = 'ZenMaster_Luna';

-- xX_Gamer_Xx: gaming cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:gaming', 3.0
FROM users WHERE display_name = 'xX_Gamer_Xx';

-- ChefAntonio: food cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:food', 3.0
FROM users WHERE display_name = 'ChefAntonio';

-- EcoWarrior_Greta: climate cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:climate', 3.0
FROM users WHERE display_name = 'EcoWarrior_Greta';

-- TruthSeeker42: conspiracy cluster
INSERT INTO attractions (source_id, target_id, weight)
SELECT id, 'topic:conspiracy', 3.0
FROM users WHERE display_name = 'TruthSeeker42';
