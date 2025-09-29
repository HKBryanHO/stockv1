const SupabaseUserManager = require('./auth/supabaseUserManager');

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    const userManager = new SupabaseUserManager();
    
    // Test user authentication
    const user = await userManager.authenticateUser('admin');
    if (user) {
      console.log('✅ Supabase UserManager working correctly');
      console.log('User found:', user.username, 'Role:', user.role);
    } else {
      console.log('❌ User not found or authentication failed');
    }
    
    // Test user stats
    const stats = await userManager.getUserStats();
    console.log('User stats:', stats);
    
    console.log('✅ Supabase migration test completed successfully!');
    
  } catch (err) {
    console.log('❌ Supabase connection test failed:', err.message);
    console.error(err);
  }
}

testSupabaseConnection();
