import { writable } from 'svelte/store';
import { db, type JournalEntry } from '../database/db.js';

export const entries = writable<JournalEntry[]>([]);

export const entryStore = {
  async loadAll() {
    const allEntries = await db.entries.orderBy('timestamp').reverse().toArray();
    entries.set(allEntries);
  },

  async create(entry: Omit<JournalEntry, 'id'>) {
    const id = await db.entries.add(entry);
    await this.loadAll();
    return id;
  },

  async update(id: number, changes: Partial<JournalEntry>) {
    await db.entries.update(id, changes);
    await this.loadAll();
  },

  async delete(id: number) {
    await db.entries.delete(id);
    await this.loadAll();
  },

  async getById(id: number) {
    return await db.entries.get(id);
  }
};