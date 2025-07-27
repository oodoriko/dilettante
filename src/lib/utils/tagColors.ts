import type { Tag } from '../database/db.js';

export function getTagColor(tagName: string, tags: Tag[]): string {
  const tag = tags.find(t => t.name === tagName);
  return tag?.color || '#3B82F6'; // Default blue if tag not found
}

export function getEntryColor(entryTags: string[], tags: Tag[]): string {
  if (!entryTags || entryTags.length === 0) {
    return '#3B82F6'; // Default blue
  }
  
  // Use the first tag's color
  const firstTag = entryTags[0];
  return getTagColor(firstTag, tags);
}