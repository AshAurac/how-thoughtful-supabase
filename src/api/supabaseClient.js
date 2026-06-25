import { createClient } from '@supabase/supabase-js';
import { appParams } from '@/lib/app-params';

const SUPABASE_URL = appParams.supabaseUrl;
const SUPABASE_ANON_KEY = appParams.supabaseAnonKey;
const APP_URL = appParams.appUrl?.replace(/\/$/, '');

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
  PlanAction: 'plan_actions',
  Family: 'families',
  FamilyMember: 'family_members',
  FamilyManagedProfile: 'family_managed_profiles',
  SharedList: 'shared_lists',
  SharedListItem: 'shared_list_items',
  Wishlist: 'wishlists'
};

const createdByEntities = new Set(Object.keys(entityTableMap).filter(entityName => entityName !== 'FamilyMember'));

const normalizeRow = (row) => {
  if (!row || typeof row !== 'object') return row;
  return {
    ...row,
    created_date: row.created_date || row.created_at,
    updated_date: row.updated_date || row.updated_at
  };
};

const normalizeRows = (data) => Array.isArray(data) ? data.map(normalizeRow) : data;

const getCurrentUser = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user || null;
};

const getRedirectOrigin = () => {
  if (!APP_URL) return window.location.origin;

  const currentHost = window.location.hostname;
  if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
    return window.location.origin;
  }

  return APP_URL;
};

const toCanonicalUrl = (url = '/') => {
  const origin = getRedirectOrigin();
  const parsed = new URL(url, window.location.origin);
  return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
};

const addOwnership = async (entityName, payload) => {
  if (!createdByEntities.has(entityName) || !payload || payload.created_by) {
    return payload;
  }

  const user = await getCurrentUser();
  if (!user?.email) return payload;

  const next = { ...payload, created_by: user.email };
  if (entityName === 'UserProfile') {
    next.email = next.email || user.email;
    next.full_name = next.full_name || user.user_metadata?.full_name || user.user_metadata?.name || '';
  }
  return next;
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
    const rawColumn = field.replace(/^-/, '');
    const column = rawColumn === 'created_date'
      ? 'created_at'
      : rawColumn === 'updated_date'
        ? 'updated_at'
        : rawColumn;
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
      return normalizeRows(data || []);
    },
    filter: async (filters = {}, orderBy) => {
      let query = supabase.from(tableName).select('*');
      query = applyFilters(query, filters);
      query = applyOrder(query, orderBy);
      const { data, error } = await query;
      if (error) throw error;
      return normalizeRows(data || []);
    },
    create: async (payload) => {
      const ownedPayload = await addOwnership(entityName, payload);
      const { data, error } = await supabase.from(tableName).insert([ownedPayload]).select();
      if (error) throw error;
      return normalizeRow(data?.[0] || null);
    },
    bulkCreate: async (items) => {
      const ownedItems = await Promise.all((items || []).map(item => addOwnership(entityName, item)));
      const { data, error } = await supabase.from(tableName).insert(ownedItems).select();
      if (error) throw error;
      return normalizeRows(data || []);
    },
    update: async (id, payload) => {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select();
      if (error) throw error;
      return normalizeRow(data?.[0] || null);
    },
    delete: async (id) => {
      const { data, error } = await supabase.from(tableName).delete().eq('id', id).select();
      if (error) throw error;
      return normalizeRows(data || []);
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
      email_confirmed_at: data.user.email_confirmed_at,
      confirmed_at: data.user.confirmed_at,
      email_verified: data.user.user_metadata?.email_verified,
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
        emailRedirectTo: getRedirectOrigin()
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
        emailRedirectTo: getRedirectOrigin()
      }
    });
    if (error) throw error;
    return data;
  },
  loginWithProvider: async (provider, fromUrl) => {
    const redirectTo = toCanonicalUrl(fromUrl || '/');

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
    const loginUrl = `${getRedirectOrigin()}/login?from_url=${encodeURIComponent(toCanonicalUrl(url || window.location.href))}`;
    window.location.href = loginUrl;
  }
};

const functions = {
  invoke: async (name, payload) => {
    const { data, error } = await supabase.functions.invoke(name, {
      body: payload || undefined
    });

    if (error) {
      let message = error.message;
      try {
        const details = await error.context?.json?.();
        message = details?.error || details?.message || message;
      } catch {
        // Keep the original Supabase error when the function response is not JSON.
      }
      throw new Error(message);
    }

    return data;
  }
};

const integrations = {
  Core: {
    SendEmail: async (payload) => {
      return functions.invoke('sendContactEmail', payload);
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
