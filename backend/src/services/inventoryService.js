import { Inventory } from '../models/Inventory.js';
import { BadRequestException, NotFoundException } from '../middleware/errors.js';

export async function createItem(data) {
  const item = new Inventory(data);
  await item.save();
  return item;
}

export async function listItems() {
  return Inventory.find().sort({ category: 1, name: 1 });
}

export async function getItem(itemId) {
  const item = await Inventory.findOne({ item_id: itemId });
  if (!item) {
    throw new NotFoundException(`Inventory item '${itemId}' not found`);
  }
  return item;
}

export async function updateItem(itemId, updates) {
  const item = await Inventory.findOneAndUpdate(
    { item_id: itemId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  if (!item) {
    throw new NotFoundException(`Inventory item '${itemId}' not found`);
  }
  return item;
}

export async function deleteItem(itemId) {
  const deleted = await Inventory.findOneAndDelete({ item_id: itemId });
  if (!deleted) {
    throw new NotFoundException(`Inventory item '${itemId}' not found`);
  }
  return deleted;
}

/**
 * Returns low-stock and expiring items with highlighted alerts (F009).
 */
export async function getExpiringOrLowStock(daysThreshold = 30) {
  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);

  // Items where quantity <= min_threshold OR expiry_date <= thresholdDate
  const items = await Inventory.find({
    $or: [
      { $expr: { $lte: ['$quantity', '$min_threshold'] } },
      { expiry_date: { $lte: thresholdDate } }
    ]
  }).sort({ expiry_date: 1 });

  const annotated = items.map((doc) => {
    const item = doc.toJSON();
    const expiryTime = new Date(item.expiry_date).getTime();
    const daysUntilExpiry = Math.ceil((expiryTime - now.getTime()) / (1000 * 60 * 60 * 24));
    const isExpired = daysUntilExpiry <= 0;
    const isLowStock = item.quantity <= item.min_threshold;

    return {
      ...item,
      is_low_stock: isLowStock,
      is_expired: isExpired,
      days_until_expiry: daysUntilExpiry,
      alert_status: isExpired ? 'EXPIRED' : isLowStock ? 'LOW_STOCK' : 'EXPIRING_SOON'
    };
  });

  return {
    count: annotated.length,
    low_stock_count: annotated.filter((i) => i.is_low_stock).length,
    expired_count: annotated.filter((i) => i.is_expired).length,
    items: annotated
  };
}

/**
 * Parses and imports CSV rows into Inventory collection (F009).
 * Expected CSV Header: item_id,name,category,quantity,min_threshold,unit,expiry_date,location,is_critical
 */
export async function importFromCsv(csvText) {
  if (!csvText || typeof csvText !== 'string') {
    throw new BadRequestException('Valid CSV text is required');
  }

  const lines = csvText.trim().split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    throw new BadRequestException('CSV must include a header and at least one data row');
  }

  const headers = lines[0].split(',').map((h) => h.trim());
  const expected = ['item_id', 'name', 'category', 'quantity', 'min_threshold', 'unit', 'expiry_date'];
  for (const exp of expected) {
    if (!headers.includes(exp)) {
      throw new BadRequestException(`Missing required CSV header column: ${exp}`);
    }
  }

  const items = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx];
    });

    const parsedItem = {
      item_id: row.item_id,
      name: row.name,
      category: row.category,
      quantity: Number(row.quantity),
      min_threshold: Number(row.min_threshold || 5),
      unit: row.unit,
      expiry_date: new Date(row.expiry_date),
      location: row.location || 'MedKit Alpha, Drawer 1',
      is_critical: String(row.is_critical).toLowerCase() === 'true'
    };

    items.push(parsedItem);
  }

  const operations = items.map((item) => ({
    updateOne: {
      filter: { item_id: item.item_id },
      update: { $set: item },
      upsert: true
    }
  }));

  await Inventory.bulkWrite(operations);
  return {
    imported_count: items.length,
    items
  };
}
