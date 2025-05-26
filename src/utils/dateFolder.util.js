const fs = require('fs').promises;
const path = require('path');

const getTodayBaseName = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

const getNextFolderAndFileName = async pocBaseDir => {
  const base = getTodayBaseName();
  let idx = 1;
  let folderName, folderPath, fileBase;
  while (true) {
    const suffix = `-${String(idx).padStart(2, '0')}`;
    folderName = `${base}${suffix}`;
    folderPath = path.join(pocBaseDir, folderName);
    fileBase = `${base}${suffix}`;
    try {
      await fs.access(folderPath);
      idx++;
    } catch {
      break;
    }
  }
  return { folderName, folderPath, fileBase };
};

module.exports = {
  getTodayBaseName,
  getNextFolderAndFileName,
};
