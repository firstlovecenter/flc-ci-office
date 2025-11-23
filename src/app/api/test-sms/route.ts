import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: NextRequest) {
  try {
    const { phone, senderIdOverride } = await request.json();

    const apiKey = process.env.MNOTIFY_API_KEY;
    const senderId = senderIdOverride || process.env.MNOTIFY_SENDER_ID;
    const recipient = phone || '233557382057';

    console.log('🧪 Testing mNotify SMS...');
    console.log('API Key:', apiKey?.substring(0, 10) + '...');
    console.log('Sender ID:', senderId);
    console.log('Recipient:', recipient);

    // Test 1: Try with current config
    console.log('\n📤 Attempt 1: With sender ID');
    try {
      const response1 = await axios.post(
        'https://api.mnotify.com/api/sms/quick',
        {
          recipient: [recipient],
          sender: senderId,
          message: 'Test SMS from FLC Accounts',
          is_schedule: false,
          schedule_date: '',
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
        }
      );

      console.log('✅ Success with sender ID!', response1.data);
      return NextResponse.json({
        success: true,
        method: 'with_sender_id',
        data: response1.data,
      });
    } catch (error1: any) {
      console.log('❌ Failed with sender ID:', error1.response?.data);

      // Test 2: Try with 'key' instead of 'Bearer'
      console.log('\n📤 Attempt 2: Using key instead of Bearer');
      try {
        const response2 = await axios.post(
          'https://api.mnotify.com/api/sms/quick',
          {
            recipient: [recipient],
            sender: senderId,
            message: 'Test SMS from FLC Accounts',
            is_schedule: false,
            schedule_date: '',
          },
          {
            headers: {
              'Content-Type': 'application/json',
              'key': apiKey,
            },
          }
        );

        console.log('✅ Success with key header!', response2.data);
        return NextResponse.json({
          success: true,
          method: 'key_header',
          data: response2.data,
        });
      } catch (error2: any) {
        console.log('❌ Failed with key header:', error2.response?.data);

        // Test 3: Try without sender ID
        console.log('\n📤 Attempt 3: Without sender ID field');
        try {
          const response3 = await axios.post(
            'https://api.mnotify.com/api/sms/quick',
            {
              recipient: [recipient],
              message: 'Test SMS from FLC Accounts',
              is_schedule: false,
              schedule_date: '',
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
            }
          );

          console.log('✅ Success without sender ID!', response3.data);
          return NextResponse.json({
            success: true,
            method: 'without_sender_id',
            data: response3.data,
          });
        } catch (error3: any) {
          console.log('❌ Failed without sender ID:', error3.response?.data);

          // Return all error details
          return NextResponse.json(
            {
              success: false,
              errors: {
                with_sender_id_bearer: error1.response?.data || error1.message,
                with_key_header: error2.response?.data || error2.message,
                without_sender_id: error3.response?.data || error3.message,
              },
              debug: {
                apiKey: apiKey?.substring(0, 10) + '...',
                senderId,
                recipient,
              },
            },
            { status: 500 }
          );
        }
      }
    }
  } catch (error: any) {
    console.error('❌ Test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint with { "phone": "233XXXXXXXXX", "senderIdOverride": "optional" }',
  });
}
