import path from 'path';
import { fileURLToPath } from 'url';

/**
 * @param {string} url
 * @param {string} fileName
 * @returns {string}
 */
export default function getFileNameFromUrl(url, fileName) {
  const dirName = fileURLToPath(url);
  return path.join(dirName, fileName);
}
