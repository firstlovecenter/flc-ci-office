/**
 * Test script for FLASHSMS API
 * Run with: npx tsx scripts/test-sms.ts
 */

import 'dotenv/config';

const FLASHSMS_BASE_URL = process.env.FLASHSMS_BASE_URL;

async function testSmsApi() {
  console.log('🔧 Testing FLASHSMS API...\n');

  const apiKey = process.env.FLASHSMS_API_KEY;
  const senderId = process.env.FLASHSMS_SENDER_ID;

  // Check configuration
  console.log('📋 Configuration:');
  console.log(`   API Key: ${apiKey ? apiKey.substring(0, 20) + '...' : 'NOT SET'}`);
  console.log(`   Sender ID: ${senderId || 'NOT SET'}`);
  console.log(`   Base URL: ${FLASHSMS_BASE_URL || 'NOT SET'}`);
  console.log('');

  if (!apiKey || !FLASHSMS_BASE_URL || !senderId) {
    console.error('❌ FLASHSMS_API_KEY, FLASHSMS_BASE_URL, or FLASHSMS_SENDER_ID is not configured!');
    return;
  }

  // Test 1: Check balance
  console.log('📊 Test 1: Checking SMS credit balance...');
  try {
    const balanceResponse = await fetch(`${FLASHSMS_BASE_URL}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    console.log(`   HTTP Status: ${balanceResponse.status} ${balanceResponse.statusText}`);
    
    const responseText = await balanceResponse.text();
    
    // Check if it's JSON or HTML
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
      console.log(`   ⚠️ API returned HTML (possibly an error page or redirect)`);
      console.log(`   First 200 chars: ${responseText.substring(0, 200)}...`);
    } else {
      try {
        const balanceData = JSON.parse(responseText);
        console.log('   Response:', JSON.stringify(balanceData, null, 2));

        if (balanceData.success && balanceData.data) {
          console.log(`   ✅ Balance: ${balanceData.data.balance} credits`);
        } else {
          console.log(`   ⚠️ Balance check issue: ${balanceData.error || 'Unknown'}`);
        }
      } catch {
        console.log(`   ❌ Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
    }
  } catch (error: any) {
    console.log(`   ❌ Balance check failed: ${error.message}`);
  }

  console.log('');

  // Test 2: Send a test SMS (uncomment to actually send)
  console.log('📤 Test 2: Send test SMS');
  
  // UNCOMMENT THE FOLLOWING BLOCK TO SEND A TEST SMS:
  // Replace the phone number with an actual test number
  
  const testPhone = '0557382057'; // Replace with actual phone number
  const testMessage = 'Test message from CI Office system. Time: ' + new Date().toISOString();
  
  try {
    console.log(`   Sending to: ${testPhone}`);
    console.log(`   Message: ${testMessage}`);
    
    const sendResponse = await fetch(`${FLASHSMS_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipients: [testPhone],
        message: testMessage,
        senderId: senderId,
      }),
    });

    console.log(`   HTTP Status: ${sendResponse.status} ${sendResponse.statusText}`);
    
    const responseText = await sendResponse.text();
    
    if (responseText.startsWith('<!DOCTYPE') || responseText.startsWith('<html')) {
      console.log(`   ⚠️ API returned HTML (rate limited or error page)`);
      
      if (sendResponse.status === 429) {
        console.log(`   ℹ️ Rate limit exceeded. Wait a few minutes and try again.`);
      }
    } else {
      try {
        const sendData = JSON.parse(responseText);
        console.log('   Response:', JSON.stringify(sendData, null, 2));

        if (sendData.success && sendData.data) {
          console.log(`   ✅ SMS sent successfully!`);
          console.log(`   Message ID: ${sendData.data.messageId}`);
          console.log(`   Recipients sent: ${sendData.data.recipientsSent}`);
          console.log(`   Credits used: ${sendData.data.creditsUsed}`);
          console.log(`   Remaining credits: ${sendData.data.remainingCredits}`);
        } else {
          console.log(`   ❌ SMS send failed: ${sendData.error || 'Unknown error'}`);
        }
      } catch {
        console.log(`   ❌ Invalid JSON response: ${responseText.substring(0, 200)}`);
      }
    }
  } catch (error: any) {
    console.log(`   ❌ SMS send error: ${error.message}`);
  }

  console.log('\n✨ SMS API test complete!');
  console.log('\n📝 Notes:');
  console.log('   - If you see 429 errors, the API is rate-limited (100 req/min)');
  console.log('   - Wait a few minutes and try again');
  console.log('   - Check your API key permissions in the dashboard');
}

// Run the test
testSmsApi();
