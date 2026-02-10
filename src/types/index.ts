export interface User {
  id: string;
  avatar_config: AvatarConfig;
  display_name: string;
  is_bot: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface AvatarConfig {
  face_shape: 'round' | 'square' | 'oval' | 'heart';
  skin_color: string;
  hair_style: 'short' | 'long' | 'curly' | 'bald' | 'mohawk' | 'ponytail';
  hair_color: string;
  eye_style: 'round' | 'almond' | 'wide' | 'narrow';
  eye_color: string;
  mouth_style: 'smile' | 'neutral' | 'grin' | 'small';
  accessory: 'none' | 'glasses' | 'sunglasses' | 'earring' | 'hat';
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  topic_tags: string[];
  created_at: string;
  user?: User;
  likes_count: number;
  comments_count: number;
  is_liked?: boolean;
}

export interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  user?: User;
}

export interface EchoChamber {
  id: string;
  name: string;
  topic_keywords: string[];
  member_count: number;
  is_active: boolean;
}

export interface GraphNode {
  id: string;
  name: string;
  avatar_config: AvatarConfig;
  is_bot: boolean;
  chamber_id?: string;
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
}
