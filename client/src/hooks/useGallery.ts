import { useCallback, useState } from 'react';
import type { GeneratedImage, GalleryItem } from '../types';
import {
  loadGallery,
  saveToGallery,
  removeFromGallery,
} from '../services/gallery';

export function useGallery() {
  const [items, setItems] = useState<GalleryItem[]>(() => loadGallery());
  const [isOpen, setIsOpen] = useState(false);

  const saveImage = useCallback((image: GeneratedImage, label?: string) => {
    const item: GalleryItem = {
      id: crypto.randomUUID(),
      image,
      savedAt: Date.now(),
      label,
    };
    setItems(saveToGallery(item));
  }, []);

  const removeImage = useCallback((id: string) => {
    setItems(removeFromGallery(id));
  }, []);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);

  return { items, isOpen, saveImage, removeImage, open, close };
}
