// Script to generate VAPID keys for push notifications
// Run with: node scripts/generate-vapid-keys.js

const webpush = require('web-push');

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n=== VAPID Keys Generated ===\n');
console.log('Add these to your .env.local file:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:admin@flc-ci.org`);
console.log('\n===========================\n');
console.log('⚠️  Keep the VAPID_PRIVATE_KEY secret and never commit it to version control!\n');
