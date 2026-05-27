const isNode = typeof window === 'undefined';

const getAppParams = () => ({
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || null,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || null,
  fromUrl: isNode ? null : window.location.href
});

export const appParams = {
  ...getAppParams()
};
