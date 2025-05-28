import fs from 'fs/promises';
import path from 'path';

const getTodayBaseName = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
};

interface FolderInfo {
  folderName: string;
  folderPath: string;
  fileBase: string;
}

const getNextFolderAndFileName = async (pocBaseDir: string): Promise<FolderInfo> => {
  const base = getTodayBaseName();
  let idx = 1;
  let folderName: string, folderPath: string, fileBase: string;
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

export { getTodayBaseName, getNextFolderAndFileName };
