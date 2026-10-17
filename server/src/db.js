/* MongoDB Atlas connection, collections and indexes.
   Every record carries `rev`, a hospital-wide revision number, so phones can ask for
   "everything that changed since rev N" instead of downloading the whole database. */
'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

// "doctors" holds every hospital account that can manage the hospital: doctors and managers alike,
// told apart by their `role` field ('Doctor' or 'Manager')
const COLLS = ['doctors', 'staff', 'patients', 'tokens'];
const db = {};
let client;

async function connect(uri, name) {
  client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  const d = client.db(name);
  for (const c of [...COLLS, 'tombstones', 'counters', 'meta']) db[c] = d.collection(c);
  // Left over from versions that had Members; no longer read or sent, only cleared by "Erase all data"
  db.members = d.collection('members');

  await renameAdmins(d);
  await Promise.all([
    ...COLLS.map(c => db[c].createIndex({ id: 1 }, { unique: true })),
    ...COLLS.map(c => db[c].createIndex({ rev: 1 })),
    db.doctors.createIndex({ username: 1 }, { unique: true }),
    db.staff.createIndex({ 'login.username': 1 }, { unique: true, partialFilterExpression: { 'login.username': { $type: 'string' } } }),
    db.patients.createIndex({ phone10: 1 }, { unique: true }),
    db.tokens.createIndex({ date: 1, seq: 1 }),
    db.tokens.createIndex({ phone10: 1, date: 1 }),
    db.tombstones.createIndex({ rev: 1 }),
  ]);
  await epoch();
  return db;
}

/* Before version 1.8.0, doctors and managers were stored in a collection called "admins".
   The first start after the update moves them to "doctors" (deletion records too), then starts a
   new epoch so every phone reloads its copy instead of waiting for changes. Runs once: after that
   there is no "admins" collection left. */
async function renameAdmins(d) {
  const names = (await d.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name);
  if (!names.includes('admins')) return;
  const target = d.collection('doctors');
  if (names.includes('doctors') && (await target.countDocuments({}, { limit: 1 }))) {
    console.warn('Both "admins" and "doctors" have records; leaving "admins" as it is. Check them in Atlas.');
    return;
  }
  try {
    if (names.includes('doctors')) await target.drop();
    await d.collection('admins').rename('doctors');
  } catch (e) {
    // Where renaming isn't allowed, copy the records across and remove the old collection
    const docs = await d.collection('admins').find({}).toArray();
    if (docs.length) await target.insertMany(docs, { ordered: false }).catch(err => { if (err.code !== 11000) throw err; });
    if ((await target.countDocuments({})) < docs.length) throw new Error('Copying "admins" to "doctors" was incomplete; "admins" was kept');
    await d.collection('admins').drop();
  }
  await d.collection('tombstones').updateMany({ coll: 'admins' }, { $set: { coll: 'doctors' } });
  await d.collection('meta').updateOne({ _id: 'epoch' }, { $set: { value: crypto.randomBytes(8).toString('hex') } }, { upsert: true });
  console.log('Moved doctors and managers from "admins" to "doctors"');
}

async function counter(name) {
  const r = await db.counters.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return r.seq;
}
const nextRev = () => counter('rev');
async function currentRev() {
  const r = await db.counters.findOne({ _id: 'rev' });
  return r ? r.seq : 0;
}

// The epoch changes when all data is erased, which tells phones to drop their copy and reload
async function epoch() {
  const r = await db.meta.findOne({ _id: 'epoch' });
  if (r) return r.value;
  await db.meta.updateOne({ _id: 'epoch' }, { $setOnInsert: { value: crypto.randomBytes(8).toString('hex') } }, { upsert: true });
  return (await db.meta.findOne({ _id: 'epoch' })).value;
}
async function newEpoch() {
  await db.meta.updateOne({ _id: 'epoch' }, { $set: { value: crypto.randomBytes(8).toString('hex') } }, { upsert: true });
}

module.exports = { connect, db, COLLS, counter, nextRev, currentRev, epoch, newEpoch, close: () => client && client.close() };
