import type { GalleryItem } from '../types';

const STORAGE_KEY = 'image-dreamer-gallery';
const MAX_ITEMS = 20;

function isValidItem(item: unknown): item is GalleryItem {
  if (!item || typeof item !== 'object') return false;
  const obj = item as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.savedAt === 'number' &&
    obj.image !== null &&
    typeof obj.image === 'object' &&
    typeof (obj.image as Record<string, unknown>).base64 === 'string' &&
    typeof (obj.image as Record<string, unknown>).mimeType === 'string'
  );
}

export function loadGallery(): GalleryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidItem);
  } catch {
    return [];
  }
}

function persist(items: GalleryItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function saveToGallery(item: GalleryItem): GalleryItem[] {
  const items = [item, ...loadGallery().filter((i) => i.id !== item.id)].slice(
    0,
    MAX_ITEMS,
  );
  try {
    persist(items);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // Remove oldest 3 and retry
      const trimmed = items.slice(0, -3);
      try {
        persist(trimmed);
        return trimmed;
      } catch {
        throw e;
      }
    }
    throw e;
  }
  return items;
}

export function removeFromGallery(id: string): GalleryItem[] {
  const items = loadGallery().filter((i) => i.id !== id);
  try {
    persist(items);
  } catch (e) {
    console.error('[gallery] failed to persist after removal', e);
  }
  return items;
}
