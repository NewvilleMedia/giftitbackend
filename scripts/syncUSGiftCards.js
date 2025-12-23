require('dotenv').config();
const { connectDB, disconnectDB } = require('../src/config/database');
const GiftCard = require('../src/models/GiftCard');
const runaApi = require('../src/utils/runaApi');

async function syncUSGiftCards() {
  console.log('Connecting to MongoDB...');
  await connectDB();

  console.log('Fetching US gift cards from Runa...');

  let afterCursor = null;
  let totalSynced = 0;
  let page = 1;

  while (true) {
    const result = await runaApi.getCatalog({
      limit: 500,
      country: 'US',
      after: afterCursor
    });

    if (!result.success) {
      console.error('Error fetching catalog:', result.error);
      break;
    }

    const products = result.data || [];
    console.log(`Page ${page}: ${products.length} products, hasMore: ${result.pagination?.hasMore}`);

    if (products.length === 0) {
      break;
    }

    // Sync each product to database
    for (const product of products) {
      const giftCardData = runaApi.mapProductToGiftCard(product);

      await GiftCard.findOneAndUpdate(
        { provider: 'runa', providerId: product.code },
        { $set: { ...giftCardData, lastSyncedAt: new Date() } },
        { upsert: true, new: true }
      );

      totalSynced++;
    }

    if (!result.pagination?.hasMore || !result.pagination?.after) {
      break;
    }

    afterCursor = result.pagination.after;
    page++;
  }

  // Count final US cards
  const usCardCount = await GiftCard.countDocuments({ countries: 'US' });

  console.log(`\nSync complete!`);
  console.log(`Total synced: ${totalSynced}`);
  console.log(`US cards in database: ${usCardCount}`);

  await disconnectDB();
  process.exit(0);
}

syncUSGiftCards().catch(async (error) => {
  console.error('Sync failed:', error);
  await disconnectDB();
  process.exit(1);
});
