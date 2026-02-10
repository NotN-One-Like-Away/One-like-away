import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AvatarConfig } from '../types';
import { supabase } from '../lib/supabase';

const DEFAULT_AVATAR: AvatarConfig = {
  face_shape: 'round',
  skin_color: '#f5d0c5',
  hair_style: 'short',
  hair_color: '#2c1810',
  eye_style: 'round',
  eye_color: '#4a3728',
  mouth_style: 'smile',
  accessory: 'none',
};

interface UserStore {
  user: User | null;
  timeRemaining: number;
  isExpired: boolean;
  setUser: (user: User | null) => void;
  createSession: (avatarConfig: AvatarConfig, displayName: string) => Promise<User | null>;
  promoteToRealUser: () => Promise<boolean>;
  updateTimeRemaining: (seconds: number) => void;
  setExpired: () => void;
  clearSession: () => void;
}

const SESSION_DURATION_MS = 3 * 60 * 1000; // 3 minutes

// Check if Supabase is properly configured
const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url && !url.includes('placeholder');
};

// Check if a user ID is a valid UUID (not a demo ID)
const isValidUUID = (id: string) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      user: null,
      timeRemaining: SESSION_DURATION_MS / 1000,
      isExpired: false,

      setUser: (user) => set({ user }),

      promoteToRealUser: async () => {
        const currentUser = get().user;
        if (!currentUser || isValidUUID(currentUser.id)) {
          return true; // Already real or no user
        }

        if (!isSupabaseConfigured()) {
          console.warn('Cannot promote demo user: Supabase not configured');
          return false;
        }

        // Create real Supabase user with same data
        const { data, error } = await supabase
          .from('users')
          .insert({
            avatar_config: currentUser.avatar_config,
            display_name: currentUser.display_name,
            is_bot: false,
            expires_at: currentUser.expires_at,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to promote demo user:', error);
          return false;
        }

        // Replace demo user with real user
        console.log(`Promoted demo user "${currentUser.display_name}" → real user (${data.id})`);
        set({ user: data });
        return true;
      },

      createSession: async (avatarConfig, displayName) => {
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString();

        // If Supabase isn't configured, create a local demo session
        if (!isSupabaseConfigured()) {
          console.log('Demo mode: Creating local session (Supabase not configured)');
          const demoUser: User = {
            id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            avatar_config: avatarConfig,
            display_name: displayName,
            is_bot: false,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          };

          set({
            user: demoUser,
            timeRemaining: SESSION_DURATION_MS / 1000,
            isExpired: false
          });
          
          return demoUser;
        }

        // Normal Supabase flow
        const { data, error } = await supabase
          .from('users')
          .insert({
            avatar_config: avatarConfig,
            display_name: displayName,
            is_bot: false,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (error) {
          console.error('Failed to create session:', error);
          // Fallback to demo mode on error
          const demoUser: User = {
            id: `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            avatar_config: avatarConfig,
            display_name: displayName,
            is_bot: false,
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
          };

          set({
            user: demoUser,
            timeRemaining: SESSION_DURATION_MS / 1000,
            isExpired: false
          });
          return demoUser;
        }

        set({
          user: data,
          timeRemaining: SESSION_DURATION_MS / 1000,
          isExpired: false
        });
        
        return data;
      },

      updateTimeRemaining: (seconds) => {
        set({ timeRemaining: seconds });
        if (seconds <= 0) {
          get().setExpired();
        }
      },

      setExpired: () => set({ isExpired: true }),

      clearSession: () => set({
        user: null,
        timeRemaining: SESSION_DURATION_MS / 1000,
        isExpired: false
      }),
    }),
    {
      name: 'echo-chamber-user',
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => (state) => {
        // Clear demo sessions when Supabase is configured
        if (state?.user && isSupabaseConfigured() && !isValidUUID(state.user.id)) {
          console.log('Clearing invalid demo session');
          state.clearSession();
        }
      },
    }
  )
);

export { DEFAULT_AVATAR };
