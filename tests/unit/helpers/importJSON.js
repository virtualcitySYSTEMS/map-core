import fs from 'fs';

/**
 * @param {string} fileName
 * @returns {Promise<Object>}
 */
export default async function importJSON(fileName) {
  if (fs.existsSync(fileName)) {
    const content = await fs.promises.readFile(fileName);
    return JSON.parse(content.toString());
  }
  // eslint-disable-next-line no-console
  console.log(`${fileName} does not exist`);
  return {};
}
