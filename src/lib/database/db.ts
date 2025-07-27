import Dexie, { type EntityTable } from 'dexie';

export interface JournalEntry {
  id?: number;
  timestamp: Date;
  createdAt: Date;
  lastEditedAt: Date;
  title: string;
  content: string;
  tags?: string[];
  location?: string;
  mood?: string;
  weather?: string;
}

export interface MediaFile {
  id?: number;
  entryId: number;
  type: string;
  name: string;
  data: Blob;
  thumbnailData?: Blob;
}

export interface Journal {
  id?: number;
  name: string;
  color: string;
  description?: string;
  createdAt: Date;
}

export interface Tag {
  id?: number;
  name: string;
  color?: string;
  createdAt: Date;
  usageCount: number;
}

const db = new Dexie('JournalDatabase') as Dexie & {
  entries: EntityTable<JournalEntry, 'id'>;
  media: EntityTable<MediaFile, 'id'>;
  journals: EntityTable<Journal, 'id'>;
  tags: EntityTable<Tag, 'id'>;
};

db.version(1).stores({
  entries: '++id, timestamp, createdAt, lastEditedAt, title, content, tags, location, mood, weather',
  media: '++id, entryId, type, name, data, thumbnailData',
  journals: '++id, name, color, description, createdAt',
  tags: '++id, name, color, createdAt, usageCount',
});

export { db };