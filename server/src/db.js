/* MongoDB Atlas connection, collections and indexes.
   Every record carries `rev`, a hospital-wide revision number, so phones can ask for
   "everything that changed since rev N" instead of downloading the whole database. */
'use strict';

const { MongoClient } = require('mongodb');
const crypto = require('crypto');

const COLLS = ['admins', 'staff', 'patients', 'tokens'];
const db = {};
let client;

async function connect(uri, name) {
  client = new MongoClient(uri, { maxPoolSize: 10 });
  await client.connect();
  const d = client.db(name);
  for (const c of [...COLLS, 'tombstones', 'counters', 'meta']) db[c] = d.collection(c);
  // Left over from versions that had Members; no longer read or sent, only cleared by "Erase all data"
  db.members = d.collection('members');

  await Promise.all([
    ...COLLS.map(c => db[c].createIndex({ id: 1 }, { unique: true })),
    ...COLLS.map(c => db[c].createIndex({ rev: 1 })),
    db.admins.createIndex({ username: 1 }, { unique: true }),
    db.staff.createIndex({ 'login.username': 1 }, { unique: true, partialFilterExpression: { 'login.username': { $type: 'string' } } }),
    db.patients.createIndex({ phone10: 1 }, { unique: true }),
    db.tokens.createIndex({ date: 1, seq: 1 }),
    db.tokens.createIndex({ phone10: 1, date: 1 }),
    db.tombstones.createIndex({ rev: 1 }),
  ]);
  await epoch();
  return db;
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
