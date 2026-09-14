// One-time PocketBase schema setup for the betting dashboard.
// Reuses the same PocketBase instance as gym-dashboard (same single user).
// Bets/bankroll are publicly viewable (matches old Firestore behavior where
// the dashboard loads before sign-in); only the owning user can write.
//
// Usage: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/pb-setup-schema.mjs

import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'https://data.huynh.place'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD) {
  console.error('Set PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD env vars.')
  process.exit(1)
}

const pb = new PocketBase(PB_URL)

const OWN_ROW_RULE = 'user = @request.auth.id'
const CREATE_RULE = '@request.auth.id != "" && user = @request.auth.id'
const PUBLIC_READ_RULE = ''

async function ensureCollection(def) {
  try {
    const existing = await pb.collections.getOne(def.name)
    console.log(`Collection "${def.name}" already exists (${existing.id}), skipping.`)
    return existing
  } catch {
    const created = await pb.collections.create(def)
    console.log(`Created collection "${def.name}" (${created.id}).`)
    return created
  }
}

async function main() {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
  console.log('Authenticated as superuser.')

  const usersCollection = await pb.collections.getOne('users')

  await ensureCollection({
    name: 'bets',
    type: 'base',
    fields: [
      { name: 'user', type: 'relation', required: true, collectionId: usersCollection.id, maxSelect: 1, cascadeDelete: true },
      { name: 'date', type: 'date', required: true },
      { name: 'sportsbook', type: 'text', required: true },
      { name: 'sport', type: 'json' },
      { name: 'betType', type: 'text', required: true },
      { name: 'wager', type: 'number', required: true },
      { name: 'odds', type: 'text' },
      { name: 'result', type: 'text', required: true },
      { name: 'bonusBet', type: 'bool' },
      { name: 'profitBoost', type: 'bool' },
      { name: 'notes', type: 'text' },
      { name: 'payout', type: 'number' },
      { name: 'profit', type: 'number' },
      { name: 'expectedPayout', type: 'number' },
      { name: 'legacyTimestamp', type: 'number' },
    ],
    listRule: PUBLIC_READ_RULE,
    viewRule: PUBLIC_READ_RULE,
    createRule: CREATE_RULE,
    updateRule: OWN_ROW_RULE,
    deleteRule: OWN_ROW_RULE,
  })

  await ensureCollection({
    name: 'bankroll',
    type: 'base',
    fields: [
      { name: 'user', type: 'relation', required: true, collectionId: usersCollection.id, maxSelect: 1, cascadeDelete: true },
      { name: 'date', type: 'date', required: true },
      { name: 'sportsbook', type: 'text', required: true },
      { name: 'type', type: 'text', required: true },
      { name: 'amount', type: 'number', required: true },
      { name: 'legacyTimestamp', type: 'number' },
    ],
    listRule: PUBLIC_READ_RULE,
    viewRule: PUBLIC_READ_RULE,
    createRule: CREATE_RULE,
    updateRule: OWN_ROW_RULE,
    deleteRule: OWN_ROW_RULE,
  })

  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
