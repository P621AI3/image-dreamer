import type { GeneratedImage, GeneratedVideo } from '../types';

export function readFileAsGeneratedImage(file: File): Promise<GeneratedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl format: "data:<mimeType>;base64,<base64data>"
      const commaIndex = dataUrl.indexOf(',');
      if (commaIndex === -1) {
        reject(new Error('Invalid file data'));
        return;
      }
      const base64 = dataUrl.slice(commaIndex + 1);
      resolve({ base64, mimeType: file.type || 'image/png' });
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function downloadImage(image: GeneratedImage): void {
  const ext = image.mimeType.split('/')[1] || 'png';
  const link = document.createElement('a');
  link.href = `data:${image.mimeType};base64,${image.base64}`;
  link.download = `dream-${Date.now()}.${ext}`;
  link.click();
}

export function downloadVideo(video: GeneratedVideo): void {
  const link = document.createElement('a');
  link.href = `data:${video.mimeType};base64,${video.base64}`;
  link.download = `dream-${Date.now()}.mp4`;
  link.click();
}
