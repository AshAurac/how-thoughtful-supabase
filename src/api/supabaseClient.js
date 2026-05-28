import { createClient } from '@supabase/supabase-js';
import { appParams } from '@/lib/app-params';

const SUPABASE_URL = appParams.supabaseUrl;
const SUPABASE_ANON_KEY = appParams.supabaseAnonKey;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined
  }
});

const entityTableMap = {
  UserProfile: 'user_profiles',
  Event: 'events',
  Gift: 'gifts',
  GiftHistory: 'gift_history',
  Recipient: 'recipients',
  SavedIdea: 'saved_ideas',
  SharedList: 'shared_lists',
  SharedListItem: 'shared_list_items',
  Wishlist: 'wishlists'
};

const applyFilters = (query, filters) => {
  if (!filters || typeof filters !== 'object') {
    return query;
  }

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      query = query.in(key, value);
    } else if (typeof value === 'object') {
      if (value?.gte !== undefined) query = query.gte(key, value.gte);
      else if (value?.lte !== undefined) query = query.lte(key, value.lte);
      else query = query.eq(key, value);
    } else {
      query = query.eq(key, value);
    }
  });

  return query;
};

const applyOrder = (query, orderBy) => {
  if (!orderBy) return query;
  const orderFields = Array.isArray(orderBy) ? orderBy : [orderBy];
  orderFields.forEach((field) => {
    if (!field) return;
    const ascending = !field.startsWith('-');
    const column = field.replace(/^-/, '');
    query = query.order(column, { ascending });
  });
  return query;
};

const getTableName = (entityName) => {
  const tableName = entityTableMap[entityName];
  if (!tableName) {
    throw new Error(`Unknown Supabase entity mapping for ${entityName}`);
  }
  return tableName;
};

const createEntityClient = (entityName) => {
  const tableName = getTableName(entityName);

  return {
    list: async (orderBy) => {
      let query = supabase.from(tableName).select('*');
      query = applyOrder(query, orderBy);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    filter: async (filters = {}, orderBy) => {
      let query = supabase.from(tableName).select('*');
      query = applyFilters(query, filters);
      query = applyOrder(query, orderBy);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    create: async (payload) => {
      const { data, error } = await supabase.from(tableName).insert([payload]);
      if (error) throw error;
      return data?.[0] || null;
    },
    bulkCreate: async (items) => {
      const { data, error } = await supabase.from(tableName).insert(items);
      if (error) throw error;
      return data || [];
    },
    update: async (id, payload) => {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id);
      if (error) throw error;
      return data?.[0] || null;
    },
    delete: async (id) => {
      const { data, error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      return data || [];
    }
  };
};

const entities = Object.keys(entityTableMap).reduce((acc, entityName) => {
  acc[entityName] = createEntityClient(entityName);
  return acc;
}, {});

const auth = {
  me: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data?.user) {
      throw { status: 401, message: 'Not authenticated' };
    }
    return {
      id: data.user.id,
      email: data.user.email,
      role: data.user.user_metadata?.role || null,
      ...data.user.user_metadata
    };
  },
  loginViaEmailPassword: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return {
      access_token: data.session?.access_token,
      user: data.user
    };
  },
  register: async ({ email, password }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  },
  resendVerificationEmail: async (email) => {
    const { data, error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    if (error) throw error;
    return data;
  },
  loginWithProvider: async (provider, fromUrl) => {
    const redirectTo = fromUrl && /^https?:\/\//i.test(fromUrl)
      ? fromUrl
      : `${window.location.origin}${fromUrl || '/'}`;

    return supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo
      }
    });
  },
  logout: async (redirectTo) => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    if (redirectTo) {
      window.location.href = redirectTo;
    }
  },
  isAuthenticated: async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) return false;
    return !!data?.session?.user;
  },
  redirectToLogin: (url) => {
    window.location.href = `/login?from_url=${encodeURIComponent(url || window.location.href)}`;
  }
};

const functions = {
  invoke: async (name, payload) => {
    const { data, error } = await supabase.functions.invoke(name, {
      body: payload ? JSON.stringify(payload) : undefined,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (error) {
      throw error;
    }

    return data;
  }
};

const integrations = {
  Core: {
    SendEmail: async () => {
      console.warn('SendEmail is not configured. Add a Supabase Edge Function or a third-party email provider to enable this feature.');
      return { success: false, message: 'SendEmail not configured' };
    },
    InvokeLLM: async (payload) => {
      return functions.invoke('invokeLLM', payload);
    }
  }
};

export const supabaseCompat = {
  auth,
  entities,
  functions,
  integrations
};
