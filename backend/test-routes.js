const db = require('./db');

async function test() {
  try {
    console.log("🔍 Testing database queries...\n");
    
    // Test 1: Count users
    const [[userCount]] = await db.promise().query("SELECT COUNT(*) as count FROM users");
    console.log(`✅ Users in database: ${userCount.count}`);
    
    // Test 2: Get users with clubs
    const [users] = await db.promise().query(
      `SELECT u.id, u.username, u.email, u.role, c.name AS club_name
       FROM users u
       LEFT JOIN user_clubs uc ON u.id = uc.user_id AND uc.status = 'approved'
       LEFT JOIN clubs c ON uc.club_id = c.id
       LIMIT 5`
    );
    console.log(`✅ Sample users:`, users);
    
    // Test 3: Events
    const [[eventCount]] = await db.promise().query("SELECT COUNT(*) as count FROM events");
    console.log(`✅ Events in database: ${eventCount.count}`);
    
    // Test 4: Clubs
    const [clubs] = await db.promise().query("SELECT id, name FROM clubs");
    console.log(`✅ Clubs:`, clubs);
    
    // Test 5: Positions
    const [positions] = await db.promise().query("SELECT id, name FROM club_positions");
    console.log(`✅ Positions:`, positions);
    
    console.log("\n✅ All tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

test();