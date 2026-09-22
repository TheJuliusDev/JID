import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { DEMO_USER_JULIUS, DEMO_USER_SELLER_PRAISE, DEMO_USER_ADMIN } from '../data/mockData';
import { supabase, hasSupabaseConfig, isDemoMode } from '../services/supabase';

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isDemoMode: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signup: (userData: { fullName: string; email: string; department: string; level: string; hallOrArea: string; password?: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  switchDemoUser: (role: 'julius' | 'praise' | 'admin') => void;
  updateProfile: (updates: Partial<UserProfile>) => void;
  upgradeToPremium: (plan: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USER_KEY = 'jid_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved user', e);
      }
    }
    // Default to Julius Adeyemi in demo mode
    return DEMO_USER_JULIUS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Synchronize state with Supabase or LocalStorage
  useEffect(() => {
    const client = supabase;
    if (hasSupabaseConfig && client) {
      // Listen to Supabase auth state changes
      client.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // Fetch profile
          client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data }) => {
              if (data) {
                const liveProfile: UserProfile = {
                  id: data.id,
                  email: session.user.email || '',
                  fullName: data.full_name,
                  matricNumber: data.matric_number,
                  department: data.department,
                  level: data.level,
                  hallOrArea: data.hall_or_area,
                  phoneNumber: data.phone_number,
                  whatsappNumber: data.whatsapp_number,
                  avatarUrl: data.avatar_url,
                  bio: data.bio,
                  isPremium: Boolean(data.is_premium),
                  isVerified: Boolean(data.is_verified),
                  role: data.role || 'student',
                  createdAt: data.created_at
                };
                setUser(liveProfile);
              }
              setIsLoading(false);
            });
        } else {
          setIsLoading(false);
        }
      });

      const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          // Fetch profile
          const { data } = await client.from('profiles').select('*').eq('id', session.user.id).single();
          if (data) {
            setUser({
              id: data.id,
              email: session.user.email || '',
              fullName: data.full_name,
              department: data.department,
              level: data.level,
              hallOrArea: data.hall_or_area,
              phoneNumber: data.phone_number,
              whatsappNumber: data.whatsapp_number,
              avatarUrl: data.avatar_url,
              bio: data.bio,
              isPremium: Boolean(data.is_premium),
              isVerified: Boolean(data.is_verified),
              role: data.role || 'student',
              createdAt: data.created_at
            });
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    } else {
      // In demo mode, load initial state quickly
      setIsLoading(false);
    }
  }, []);

  // Save demo user to local storage whenever changed
  useEffect(() => {
    if (user) {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }
  }, [user]);

  const login = async (email: string, password?: string): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (hasSupabaseConfig && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password: password || 'DefaultPassword123!'
        });
        if (error) throw error;
        return { success: true };
      } else {
        // Demo Mode login
        if (email.toLowerCase().includes('admin')) {
          setUser(DEMO_USER_ADMIN);
        } else if (email.toLowerCase().includes('praise')) {
          setUser(DEMO_USER_SELLER_PRAISE);
        } else {
          setUser({
            ...DEMO_USER_JULIUS,
            email: email.trim()
          });
        }
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Login failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (userData: {
    fullName: string;
    email: string;
    department: string;
    level: string;
    hallOrArea: string;
    password?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);
    try {
      if (hasSupabaseConfig && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: userData.email,
          password: userData.password || 'CampusPassword123!',
          options: {
            data: {
              full_name: userData.fullName,
              department: userData.department,
              level: userData.level,
              hall_or_area: userData.hallOrArea
            }
          }
        });
        if (error) throw error;
        return { success: true };
      } else {
        // Create new Demo Student profile
        const newDemoUser: UserProfile = {
          id: `user-${Date.now()}`,
          email: userData.email,
          fullName: userData.fullName,
          department: userData.department,
          level: userData.level,
          hallOrArea: userData.hallOrArea,
          avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80',
          bio: `Student at ${userData.department}. Staying at ${userData.hallOrArea}.`,
          isPremium: false,
          isVerified: false,
          role: 'student',
          createdAt: new Date().toISOString()
        };
        setUser(newDemoUser);
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || 'Signup failed' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (hasSupabaseConfig && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
  };

  const resetPassword = async (email: string): Promise<{ success: boolean; message: string }> => {
    if (hasSupabaseConfig && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) return { success: false, message: error.message };
      return { success: true, message: 'Password reset link sent to your email.' };
    }
    // Demo mode simulated response
    return {
      success: true,
      message: `Demo reset instructions simulated for ${email}. (In production, a secure Supabase recovery email is sent).`
    };
  };

  const switchDemoUser = (role: 'julius' | 'praise' | 'admin') => {
    if (role === 'julius') setUser(DEMO_USER_JULIUS);
    if (role === 'praise') setUser(DEMO_USER_SELLER_PRAISE);
    if (role === 'admin') setUser(DEMO_USER_ADMIN);
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  };

  const upgradeToPremium = (plan: string) => {
    const expires = new Date();
    expires.setMonth(expires.getMonth() + (plan === 'annual' ? 12 : plan === 'semester' ? 4 : 1));
    setUser(prev => prev ? {
      ...prev,
      isPremium: true,
      premiumUntil: expires.toISOString()
    } : null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: Boolean(user),
        isLoading,
        isDemoMode,
        login,
        signup,
        logout,
        resetPassword,
        switchDemoUser,
        updateProfile,
        upgradeToPremium
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
