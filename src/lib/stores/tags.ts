import { writable } from 'svelte/store';
import { db, type Tag } from '../database/db.js';

export const tags = writable<Tag[]>([]);

export const tagStore = {
  async loadAll() {
    const allTags = await db.tags.orderBy('usageCount').reverse().toArray();
    tags.set(allTags);
  },

  async create(tagName: string, color?: string): Promise<Tag> {
    const existingTag = await db.tags.where('name').equalsIgnoreCase(tagName).first();
    
    if (existingTag) {
      return existingTag;
    }

    // Create new tag with unique color
    const newTag: Omit<Tag, 'id'> = {
      name: tagName.toLowerCase().trim(),
      color: color || await this.generateUniqueColor(),
      createdAt: new Date(),
      usageCount: 0
    };

    const id = await db.tags.add(newTag);
    await this.loadAll();
    return { ...newTag, id };
  },

  async incrementUsage(tagName: string) {
    const tag = await db.tags.where('name').equalsIgnoreCase(tagName).first();
    if (tag) {
      await db.tags.update(tag.id!, { usageCount: tag.usageCount + 1 });
      await this.loadAll();
    }
  },

  async decrementUsage(tagName: string) {
    const tag = await db.tags.where('name').equalsIgnoreCase(tagName).first();
    if (tag && tag.usageCount > 0) {
      const newCount = tag.usageCount - 1;
      if (newCount === 0) {
        // Optionally delete unused tags or keep them for history
        await db.tags.update(tag.id!, { usageCount: 0 });
      } else {
        await db.tags.update(tag.id!, { usageCount: newCount });
      }
      await this.loadAll();
    }
  },

  async searchTags(query: string): Promise<Tag[]> {
    if (!query.trim()) {
      const allTags = await db.tags.orderBy('usageCount').reverse().limit(10).toArray();
      return allTags;
    }
    
    return await db.tags
      .where('name')
      .startsWithIgnoreCase(query.toLowerCase())
      .or('name')
      .anyOfIgnoreCase([query.toLowerCase()])
      .reverse()
      .sortBy('usageCount');
  },

  async getTagByName(name: string): Promise<Tag | undefined> {
    return await db.tags.where('name').equalsIgnoreCase(name.toLowerCase()).first();
  },

  async generateUniqueColor(): Promise<string> {
    // Expanded color palette for better variety
    const colors = [
      '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1',
      '#14B8A6', '#F43F5E', '#8B5A2B', '#6B7280', '#059669',
      '#DC2626', '#7C3AED', '#0891B2', '#CA8A04', '#9333EA',
      '#0D9488', '#E11D48', '#A16207', '#4B5563', '#047857',
      '#BE123C', '#6D28D9', '#0369A1', '#B45309', '#7C2D12',
      '#374151', '#1F2937', '#111827', '#0F172A', '#581C87'
    ];
    
    // Get all existing tag colors
    const existingTags = await db.tags.toArray();
    const usedColors = new Set(existingTags.map(tag => tag.color));
    
    // Find an unused color
    for (const color of colors) {
      if (!usedColors.has(color)) {
        return color;
      }
    }
    
    // If all predefined colors are used, generate a random color
    return this.generateRandomHexColor();
  },

  generateRandomHexColor(): string {
    // Generate a random hex color if all predefined colors are exhausted
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  },

  async updateTagsUsage(oldTags: string[], newTags: string[]) {
    // Decrement usage for removed tags
    const removedTags = oldTags.filter(tag => !newTags.includes(tag));
    for (const tagName of removedTags) {
      await this.decrementUsage(tagName);
    }

    // Increment usage for new tags (or create them)
    const addedTags = newTags.filter(tag => !oldTags.includes(tag));
    for (const tagName of addedTags) {
      await this.create(tagName);
      await this.incrementUsage(tagName);
    }
  },

  async updateTagName(tagId: number, newName: string) {
    await db.tags.update(tagId, { name: newName.toLowerCase().trim() });
    await this.loadAll();
  },

  async deleteTag(tagId: number) {
    await db.tags.delete(tagId);
    await this.loadAll();
  }
};