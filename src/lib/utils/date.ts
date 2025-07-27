import type { JournalEntry } from '../database/db.js';

export function groupEntriesByMonth(entries: JournalEntry[]): { [key: string]: JournalEntry[] } {
  return entries.reduce((groups, entry) => {
    const date = new Date(entry.timestamp);
    const monthYear = date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long' 
    });
    
    if (!groups[monthYear]) {
      groups[monthYear] = [];
    }
    
    groups[monthYear].push(entry);
    return groups;
  }, {} as { [key: string]: JournalEntry[] });
}

export function formatEntryDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'long',
    day: 'numeric'
  });
}

export function formatLastEditedTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}