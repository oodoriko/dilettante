import type { Tag } from '../database/db.js';

// Muted color palette using only blue and grey variants for a calming design
const MUTED_TAG_COLORS = [
  '#3b82f6', // blue-500 - primary blue
  '#60a5fa', // blue-400 - lighter blue
  '#2563eb', // blue-600 - deeper blue
  '#93c5fd', // blue-300 - soft blue
  '#1d4ed8', // blue-700 - darker blue
  '#6b7280', // gray-500 - balanced grey
  '#9ca3af', // gray-400 - lighter grey
  '#4b5563', // gray-600 - deeper grey
  '#374151', // gray-700 - darker grey
  '#1e40af', // blue-800 - deep blue
  '#64748b', // slate-500 - blue-grey
  '#475569', // slate-600 - darker blue-grey
];

export function getTagColor(tagName: string, tags: Tag[]): string {
  const tag = tags.find(t => t.name === tagName);
  if (tag?.color) {
    return tag.color;
  }
  
  // Generate a consistent color based on tag name hash for consistency
  let hash = 0;
  for (let i = 0; i < tagName.length; i++) {
    hash = tagName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colorIndex = Math.abs(hash) % MUTED_TAG_COLORS.length;
  return MUTED_TAG_COLORS[colorIndex];
}

export function getEntryColor(entryTags: string[], tags: Tag[]): string {
  if (!entryTags || entryTags.length === 0) {
    return '#3b82f6'; // Default primary blue
  }
  
  // Use the first tag's color
  const firstTag = entryTags[0];
  return getTagColor(firstTag, tags);
}

// Export the color palette for use in tag creation/editing components
export const getAvailableTagColors = (): string[] => {
  return [...MUTED_TAG_COLORS];
};