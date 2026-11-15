import { Router } from 'express';
import { z } from 'zod';
import {
  createItem,
  deleteItem,
  getExpiringOrLowStock,
  getItem,
  importFromCsv,
  listItems,
  updateItem
} from '../services/inventoryService.js';

const router = Router();

const inventorySchema = z.object({
  item_id: z.string().min(2).max(32),
  name: z.string().min(2).max(128),
  category: z.enum(['medication', 'surgical', 'diagnostic', 'ppe', 'first_aid', 'general']),
  quantity: z.number().min(0),
  min_threshold: z.number().min(0).default(5),
  unit: z.string().min(1),
  expiry_date: z.string().or(z.date()),
  location: z.string().optional(),
  is_critical: z.boolean().default(false)
});

const csvImportSchema = z.object({
  csv_data: z.string().min(5)
});

router.post('/api/v1/inventory', async (req, res, next) => {
  try {
    const data = inventorySchema.parse(req.body);
    data.expiry_date = new Date(data.expiry_date);
    const item = await createItem(data);
    return res.status(201).json(item);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/inventory', async (req, res, next) => {
  try {
    const items = await listItems();
    return res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/inventory/alerts/expiring-or-low', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days || '30', 10);
    const alerts = await getExpiringOrLowStock(days);
    return res.json(alerts);
  } catch (err) {
    next(err);
  }
});

router.post('/api/v1/inventory/import-csv', async (req, res, next) => {
  try {
    const { csv_data } = csvImportSchema.parse(req.body);
    const result = await importFromCsv(csv_data);
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/api/v1/inventory/:id', async (req, res, next) => {
  try {
    const item = await getItem(req.params.id);
    return res.json(item);
  } catch (err) {
    next(err);
  }
});

router.patch('/api/v1/inventory/:id', async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.expiry_date) {
      updates.expiry_date = new Date(updates.expiry_date);
    }
    const updated = await updateItem(req.params.id, updates);
    return res.json(updated);
  } catch (err) {
    next(err);
  }
});

router.delete('/api/v1/inventory/:id', async (req, res, next) => {
  try {
    const deleted = await deleteItem(req.params.id);
    return res.json({ message: 'Inventory item deleted', item_id: deleted.item_id });
  } catch (err) {
    next(err);
  }
});

export default router;
