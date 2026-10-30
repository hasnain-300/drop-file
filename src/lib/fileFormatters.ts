/**
 * Utility functions for formatting file sizes, mime types, and category labels.
 */

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';
  if (!bytes || isNaN(bytes)) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeI = Math.min(i, sizes.length - 1);

  return parseFloat((bytes / Math.pow(k, safeI)).toFixed(dm)) + ' ' + sizes[safeI];
}

export interface FileTypeInfo {
  label: string;
  category: 'image' | 'video' | 'audio' | 'document' | 'archive' | 'code' | 'other';
  mimeType: string;
  extension: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export function getFileTypeInfo(fileName: string, mimeType?: string): FileTypeInfo {
  const ext = fileName.includes('.') 
    ? (fileName.split('.').pop() || '').toLowerCase() 
    : '';

  const mime = mimeType || '';

  // Images
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'].includes(ext)) {
    const specific = ext ? ext.toUpperCase() : 'Image';
    return {
      label: `${specific} Image`,
      category: 'image',
      mimeType: mime || `image/${ext || 'unknown'}`,
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-blue-50 dark:bg-blue-900/30',
      badgeText: 'text-blue-700 dark:text-blue-300',
      badgeBorder: 'border-blue-200 dark:border-blue-800/40'
    };
  }

  // Videos
  if (mime.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv', 'wmv'].includes(ext)) {
    const specific = ext ? ext.toUpperCase() : 'Video';
    return {
      label: `${specific} Video`,
      category: 'video',
      mimeType: mime || `video/${ext || 'unknown'}`,
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-purple-50 dark:bg-purple-900/30',
      badgeText: 'text-purple-700 dark:text-purple-300',
      badgeBorder: 'border-purple-200 dark:border-purple-800/40'
    };
  }

  // Audio
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)) {
    const specific = ext ? ext.toUpperCase() : 'Audio';
    return {
      label: `${specific} Audio`,
      category: 'audio',
      mimeType: mime || `audio/${ext || 'unknown'}`,
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-pink-50 dark:bg-pink-900/30',
      badgeText: 'text-pink-700 dark:text-pink-300',
      badgeBorder: 'border-pink-200 dark:border-pink-800/40'
    };
  }

  // Archives
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso'].includes(ext) || mime.includes('zip') || mime.includes('compressed')) {
    const specific = ext ? ext.toUpperCase() : 'Archive';
    return {
      label: `${specific} Archive`,
      category: 'archive',
      mimeType: mime || 'application/zip',
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-amber-50 dark:bg-amber-900/30',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-200 dark:border-amber-800/40'
    };
  }

  // PDFs
  if (ext === 'pdf' || mime === 'application/pdf') {
    return {
      label: 'PDF Document',
      category: 'document',
      mimeType: 'application/pdf',
      extension: '.pdf',
      badgeBg: 'bg-red-50 dark:bg-red-900/30',
      badgeText: 'text-red-700 dark:text-red-300',
      badgeBorder: 'border-red-200 dark:border-red-800/40'
    };
  }

  // Spreadsheets
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext) || mime.includes('sheet') || mime.includes('csv')) {
    return {
      label: ext === 'csv' ? 'CSV Sheet' : 'Spreadsheet',
      category: 'document',
      mimeType: mime || 'application/vnd.ms-excel',
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      badgeText: 'text-emerald-700 dark:text-emerald-300',
      badgeBorder: 'border-emerald-200 dark:border-emerald-800/40'
    };
  }

  // Documents
  if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext) || mime.startsWith('text/')) {
    let label = 'Document';
    if (ext === 'md') label = 'Markdown Note';
    else if (ext === 'txt') label = 'Text File';
    else if (ext === 'docx' || ext === 'doc') label = 'Word Document';

    return {
      label,
      category: 'document',
      mimeType: mime || 'text/plain',
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-cyan-50 dark:bg-cyan-900/30',
      badgeText: 'text-cyan-700 dark:text-cyan-300',
      badgeBorder: 'border-cyan-200 dark:border-cyan-800/40'
    };
  }

  // Code
  if (['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'php', 'sql', 'sh'].includes(ext)) {
    const extMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'React TS',
      js: 'JavaScript',
      jsx: 'React JS',
      py: 'Python',
      json: 'JSON Data',
      html: 'HTML File',
      css: 'CSS Style',
      rs: 'Rust Source',
      go: 'Go Source',
      cpp: 'C++ Source',
      c: 'C Source',
      sql: 'SQL Script',
      sh: 'Shell Script'
    };
    return {
      label: extMap[ext] || `${ext.toUpperCase()} Code`,
      category: 'code',
      mimeType: mime || 'text/plain',
      extension: ext ? `.${ext}` : '',
      badgeBg: 'bg-teal-50 dark:bg-teal-900/30',
      badgeText: 'text-teal-700 dark:text-teal-300',
      badgeBorder: 'border-teal-200 dark:border-teal-800/40'
    };
  }

  // Fallback
  return {
    label: ext ? `${ext.toUpperCase()} File` : (mime || 'Binary File'),
    category: 'other',
    mimeType: mime || 'application/octet-stream',
    extension: ext ? `.${ext}` : '',
    badgeBg: 'bg-gray-100 dark:bg-gray-800',
    badgeText: 'text-gray-700 dark:text-gray-300',
    badgeBorder: 'border-gray-200 dark:border-gray-700'
  };
}
