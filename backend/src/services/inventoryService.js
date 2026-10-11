/**
 * Race-safe inventory operations.
 *
 * Stock is reserved with a single conditional atomic update per product
 * (`stock >= qty` → `$inc: -qty`). Two concurrent checkouts for the last unit cannot
 * both succeed: MongoDB applies one update, the second no longer matches its filter.
 * If any line in an order fails, the lines already reserved are rolled back.
 */
const { Product } = require('../models');
const ApiError = require('../utils/ApiError');

/** Aggregates quantities per product (the same product may appear in several colour/size lines). */
const totalsByProduct = (items) => {
  const map = new Map();
  for (const i of items) {
    const id = String(i.product?._id || i.product);
    const entry = map.get(id) || { id, quantity: 0, name: i.name || i.product?.name };
    entry.quantity += i.quantity;
    map.set(id, entry);
  }
  return [...map.values()];
};

async function reserveStock(items) {
  const reserved = [];
  for (const line of totalsByProduct(items)) {
    const res = await Product.updateOne(
      { _id: line.id, isActive: true, stock: { $gte: line.quantity } },
      { $inc: { stock: -line.quantity } },
    );
    if (res.modifiedCount !== 1) {
      await releaseStock(reserved.map((r) => ({ product: r.id, quantity: r.quantity })));
      throw ApiError.conflict(`Sorry, "${line.name || 'an item'}" just went out of stock or doesn't have enough units left.`, {
        code: 'OUT_OF_STOCK',
        details: [{ product: line.id, issue: 'insufficient_stock' }],
      });
    }
    reserved.push(line);
  }
  return true;
}

/** Tries to reserve; returns false instead of throwing. */
async function tryReserveStock(items) {
  try {
    return await reserveStock(items);
  } catch {
    return false;
  }
}

async function releaseStock(items) {
  const ops = totalsByProduct(items).map((l) => ({ updateOne: { filter: { _id: l.id }, update: { $inc: { stock: l.quantity } } } }));
  if (ops.length) await Product.bulkWrite(ops);
}

async function recordSale(items) {
  const ops = totalsByProduct(items).map((l) => ({ updateOne: { filter: { _id: l.id }, update: { $inc: { soldCount: l.quantity } } } }));
  if (ops.length) await Product.bulkWrite(ops);
}

async function reverseSale(items) {
  const ops = totalsByProduct(items).map((l) => ({
    updateOne: { filter: { _id: l.id }, update: { $inc: { stock: l.quantity, soldCount: -l.quantity } } },
  }));
  if (ops.length) await Product.bulkWrite(ops);
}

module.exports = { reserveStock, tryReserveStock, releaseStock, recordSale, reverseSale };
