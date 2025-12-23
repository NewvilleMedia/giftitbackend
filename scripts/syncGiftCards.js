require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/database');
const giftCardService = require('../src/services/giftcard');

async function main() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  console.log('Starting gift card sync from Runa...');
  const result = await giftCardService.syncGiftCardsFromRuna();
  console.log('Sync result:', result);

  await disconnectDB();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('Sync failed:', error);
  await disconnectDB();
  process.exit(1);
});
