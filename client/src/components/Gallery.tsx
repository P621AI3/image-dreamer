import type { GeneratedImage, GalleryItem } from '../types';

interface GalleryProps {
  items: GalleryItem[];
  onLoad: (image: GeneratedImage) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Gallery({ items, onLoad, onDelete, onClose }: GalleryProps) {
  return (
    <div className="gallery-panel">
      <div className="gallery-header">
        <h3>Gallery</h3>
        <button className="clear-button" onClick={onClose}>
          ✕
        </button>
      </div>

      {items.length === 0 ? (
        <div className="gallery-empty">No saved images yet</div>
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <div
              key={item.id}
              className="gallery-item"
              onClick={() => onLoad(item.image)}
            >
              <img
                src={`data:${item.image.mimeType};base64,${item.image.base64}`}
                alt={item.label || 'Saved dream'}
              />
              <button
                className="gallery-item-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
              >
                ×
              </button>
              <span className="gallery-item-date">
                {formatDate(item.savedAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
