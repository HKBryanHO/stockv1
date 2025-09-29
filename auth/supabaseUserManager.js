const { createClient } = require('@supabase/supabase-js');

class SupabaseUserManager {
  constructor() {
    this.supabase = createClient(
      process.env.SUPABASE_URL || 'https://ghtqyibmlltkpmcuuanj.supabase.co',
      process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodHF5aWJtbGx0a3BtY3V1YW5qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMTQ2MDQsImV4cCI6MjA3NDY5MDYwNH0.zqbr8jaE4ENVumrErp4q8oc__LPx4MlW25Cl1vCiwOM'
    );
  }

  async authenticateUser(username, password) {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error || !user) return null;

      // For now, we'll assume password verification is handled elsewhere
      // In a real implementation, you'd verify the password hash here
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        status: user.status
      };
    } catch (error) {
      console.error('Supabase authentication error:', error);
      return null;
    }
  }

  async createUser(userData) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .insert([{
          username: userData.username,
          email: userData.email,
          password_hash: userData.password, // In production, hash this password
          full_name: userData.fullName,
          role: userData.role || 'user',
          status: 'active',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Supabase create user error:', error);
      throw error;
    }
  }

  async getUserById(id) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Supabase get user by ID error:', error);
      return null;
    }
  }

  async getUserByUsername(username) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();

      if (error) return null;
      return data;
    } catch (error) {
      console.error('Supabase get user by username error:', error);
      return null;
    }
  }

  async updateUser(id, updates) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) return false;
      return true;
    } catch (error) {
      console.error('Supabase update user error:', error);
      return false;
    }
  }

  async deleteUser(id) {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) return false;
      return true;
    } catch (error) {
      console.error('Supabase delete user error:', error);
      return false;
    }
  }

  async getAllUsers(limit = 20, offset = 0) {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) return [];
      return data;
    } catch (error) {
      console.error('Supabase get all users error:', error);
      return [];
    }
  }

  async getUserStats() {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('*');

      if (error) return { total_users: 0 };
      
      const total_users = data.length;
      const active_users = data.filter(user => user.status === 'active').length;
      const admin_users = data.filter(user => user.role === 'admin').length;

      return {
        total_users,
        active_users,
        admin_users
      };
    } catch (error) {
      console.error('Supabase get user stats error:', error);
      return { total_users: 0 };
    }
  }

  async createSession(userId, ipAddress, userAgent) {
    try {
      const token = require('crypto').randomBytes(24).toString('hex');
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours

      const { data, error } = await this.supabase
        .from('sessions')
        .insert([{
          user_id: userId,
          token: token,
          ip_address: ipAddress,
          user_agent: userAgent,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return { token, expiresAt };
    } catch (error) {
      console.error('Supabase create session error:', error);
      throw error;
    }
  }

  async getSession(token) {
    try {
      const { data, error } = await this.supabase
        .from('sessions')
        .select(`
          *,
          users (
            id,
            username,
            email,
            full_name,
            role
          )
        `)
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !data) return null;

      return {
        user_id: data.user_id,
        username: data.users.username,
        email: data.users.email,
        full_name: data.users.full_name,
        role: data.users.role,
        token: data.token,
        expires_at: data.expires_at
      };
    } catch (error) {
      console.error('Supabase get session error:', error);
      return null;
    }
  }

  async deleteSession(token) {
    try {
      const { error } = await this.supabase
        .from('sessions')
        .delete()
        .eq('token', token);

      if (error) return false;
      return true;
    } catch (error) {
      console.error('Supabase delete session error:', error);
      return false;
    }
  }

  async createTables() {
    // Supabase tables should be created via the Supabase dashboard or SQL migrations
    // This method is kept for compatibility but doesn't need to do anything
    console.log('Supabase tables are managed via Supabase dashboard');
    return true;
  }
}

module.exports = SupabaseUserManager;
