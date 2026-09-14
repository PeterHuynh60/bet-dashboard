// One-time migration: reads bets/bankroll from Firestore (betting-dashboard-c224e)
// and writes normalized records into PocketBase (bets/bankroll collections).
//
// Usage: PB_ADMIN_EMAIL=... PB_ADMIN_PASSWORD=... node scripts/migrate-from-firestore.mjs

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { readFileSync } from 'node:fs'
import PocketBase from 'pocketbase'

const PB_URL = process.env.PB_URL || 'https://data.huynh.place'
const PB_ADMIN_EMAIL = process.env.PB_ADMIN_EMAIL
const PB_ADMIN_PASSWORD = process.env.PB_ADMIN_PASSWORD
const APP_USER_ID = process.env.APP_USER_ID

if (!PB_ADMIN_EMAIL || !PB_ADMIN_PASSWORD || !APP_USER_ID) {
  console.error('Set PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD, and APP_USER_ID env vars.')
  process.exit(1)
}

const serviceAccount = JSON.parse(readFileSync(new URL('../service-account.json', import.meta.url)))
initializeApp({ credential: cert(serviceAccount) })
const fdb = getFirestore()

const pb = new PocketBase(PB_URL)

function pbDate(dateStr) {
  // Firestore stores plain "YYYY-MM-DD" strings; PocketBase date fields want a full timestamp.
  return `${dateStr} 00:00:00.000Z`
}

async function migrateBankroll() {
  const snap = await fdb.collection('bankroll').get()
  console.log(`Migrating ${snap.size} bankroll transactions...`)
  let count = 0
  for (const doc of snap.docs) {
    const d = doc.data()
    await pb.collection('bankroll').create({
      user: APP_USER_ID,
      date: pbDate(d.date),
      sportsbook: d.sportsbook,
      type: d.type,
      amount: d.amount,
      legacyTimestamp: d.timestamp ?? null,
    })
    count++
  }
  console.log(`Bankroll migrated: ${count}`)
}

async function migrateBets() {
  const snap = await fdb.collection('bets').get()
  console.log(`Migrating ${snap.size} bets...`)
  let count = 0
  for (const doc of snap.docs) {
    const bet = JSON.parse(doc.data().value)
    // doc.id is like "bet:1768023103392" — extract the legacy timestamp for ordering.
    const legacyTimestamp = Number(doc.id.split(':')[1]) || null
    await pb.collection('bets').create({
      user: APP_USER_ID,
      date: pbDate(bet.date),
      sportsbook: bet.sportsbook,
      sport: bet.sport,
      betType: bet.betType,
      wager: bet.wager,
      odds: bet.odds,
      result: bet.result,
      bonusBet: !!bet.bonusBet,
      profitBoost: !!bet.profitBoost,
      notes: bet.notes ?? '',
      payout: bet.payout ?? 0,
      profit: bet.profit ?? 0,
      expectedPayout: bet.expectedPayout ?? null,
      legacyTimestamp,
    })
    count++
  }
  console.log(`Bets migrated: ${count}`)
}

async function main() {
  await pb.collection('_superusers').authWithPassword(PB_ADMIN_EMAIL, PB_ADMIN_PASSWORD)
  console.log('Authenticated as superuser.')
  await migrateBankroll()
  await migrateBets()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err?.response ?? err)
  process.exit(1)
})
