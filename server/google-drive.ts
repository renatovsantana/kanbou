import { google } from 'googleapis';

let oauth2Client: any = null;
let cachedCredentials: { clientId: string; clientSecret: string; refreshToken: string } | null = null;

async function getCredentialsFromDB(): Promise<{ clientId: string; clientSecret: string; refreshToken: string } | null> {
  try {
    const { storage } = await import('./storage');
    const settings = await storage.getSystemSettings([
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'GOOGLE_REFRESH_TOKEN',
    ]);
    if (settings.GOOGLE_CLIENT_ID && settings.GOOGLE_CLIENT_SECRET && settings.GOOGLE_REFRESH_TOKEN) {
      return {
        clientId: settings.GOOGLE_CLIENT_ID,
        clientSecret: settings.GOOGLE_CLIENT_SECRET,
        refreshToken: settings.GOOGLE_REFRESH_TOKEN,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function resetOAuth2Client() {
  oauth2Client = null;
  cachedCredentials = null;
}

async function getOAuth2Client() {
  let clientId = process.env.GOOGLE_CLIENT_ID;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  let refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const dbCreds = await getCredentialsFromDB();
    if (dbCreds) {
      clientId = dbCreds.clientId;
      clientSecret = dbCreds.clientSecret;
      refreshToken = dbCreds.refreshToken;
    }
  }

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'Google Drive credentials not configured. Configure them in Settings or set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REFRESH_TOKEN environment variables.'
    );
  }

  const credsChanged = !cachedCredentials
    || cachedCredentials.clientId !== clientId
    || cachedCredentials.clientSecret !== clientSecret
    || cachedCredentials.refreshToken !== refreshToken;

  if (oauth2Client && !credsChanged) return oauth2Client;

  oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  cachedCredentials = { clientId, clientSecret, refreshToken };
  return oauth2Client;
}

async function getDriveClient() {
  const auth = await getOAuth2Client();
  return google.drive({ version: 'v3', auth });
}

const ROOT_FOLDER_NAME = "Shift Agency";

async function findOrCreateFolder(drive: any, name: string, parentId?: string): Promise<string> {
  let query = `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const fileMetadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    fileMetadata.parents = [parentId];
  }

  const created = await drive.files.create({
    requestBody: fileMetadata,
    fields: 'id',
  });

  return created.data.id;
}

export async function ensureRootFolder(): Promise<string> {
  const drive = await getDriveClient();
  return findOrCreateFolder(drive, ROOT_FOLDER_NAME);
}

export async function createClientFolder(clientName: string, clientId?: number): Promise<{ folderId: string; folderUrl: string }> {
  const drive = await getDriveClient();
  const rootId = await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const folderName = clientId ? `${clientName} [${clientId}]` : clientName;
  const clientFolderId = await findOrCreateFolder(drive, folderName, rootId);

  await findOrCreateFolder(drive, "Aprovações", clientFolderId);
  await findOrCreateFolder(drive, "Posts Agendados", clientFolderId);
  await findOrCreateFolder(drive, "Briefings", clientFolderId);
  await findOrCreateFolder(drive, "Kanban", clientFolderId);

  return {
    folderId: clientFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${clientFolderId}`,
  };
}

function normalizeFileName(originalName: string): string {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const parts = originalName.split('.');
  const ext = parts.length > 1 ? `.${parts.pop()}` : '';
  const baseName = parts.join('.');
  const sanitized = baseName
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9_\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${prefix}_${sanitized || 'arquivo'}${ext.toLowerCase()}`;
}

async function getYearMonthFolder(drive: any, parentFolderId: string, date?: Date): Promise<string> {
  const d = date || new Date();
  const yearStr = String(d.getFullYear());
  const monthStr = String(d.getMonth() + 1).padStart(2, '0');
  const yearFolderId = await findOrCreateFolder(drive, yearStr, parentFolderId);
  const monthFolderId = await findOrCreateFolder(drive, monthStr, yearFolderId);
  return monthFolderId;
}

const EXTENSION_FOLDER_MAP: Record<string, string> = {
  jpg: "JPG",
  jpeg: "JPG",
  png: "PNG",
  gif: "GIF",
  webp: "WEBP",
  svg: "SVG",
  pdf: "PDF",
  psd: "PSD",
  ai: "AI",
  eps: "EPS",
  doc: "DOC",
  docx: "DOCX",
  xls: "XLS",
  xlsx: "XLSX",
  ppt: "PPT",
  pptx: "PPTX",
  mp4: "MP4",
  mov: "MOV",
  avi: "AVI",
  zip: "ZIP",
  rar: "RAR",
  txt: "TXT",
  csv: "CSV",
};

function getExtensionFolder(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2 || !parts[parts.length - 1]) return "OUTROS";
  const ext = parts[parts.length - 1].toLowerCase();
  return EXTENSION_FOLDER_MAP[ext] || ext.toUpperCase() || "OUTROS";
}

export async function uploadKanbanFileToDrive(
  clientFolderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; fileUrl: string; downloadUrl: string; extensionFolder: string }> {
  const drive = await getDriveClient();
  const { Readable } = await import('stream');

  const monthFolderId = await getYearMonthFolder(drive, clientFolderId);
  const kanbanFolderId = await findOrCreateFolder(drive, "Kanban", monthFolderId);
  const extensionFolder = getExtensionFolder(fileName);
  const extFolderId = await findOrCreateFolder(drive, extensionFolder, kanbanFolderId);
  const normalizedName = normalizeFileName(fileName);

  const res = await drive.files.create({
    requestBody: {
      name: normalizedName,
      parents: [extFolderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = res.data.id || '';
  return {
    fileId,
    fileUrl: res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: res.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`,
    extensionFolder,
  };
}

async function findAllKanbanFolders(drive: any, parentFolderId: string): Promise<string[]> {
  const kanbanIds: string[] = [];

  const directKanban = await drive.files.list({
    q: `name='Kanban' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  for (const f of (directKanban.data.files || [])) {
    kanbanIds.push(f.id);
  }

  const yearFolders = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  for (const yf of (yearFolders.data.files || [])) {
    if (!/^\d{4}$/.test(yf.name || '')) continue;
    const monthFolders = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${yf.id}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    for (const mf of (monthFolders.data.files || [])) {
      if (!/^\d{2}$/.test(mf.name || '')) continue;
      const kanban = await drive.files.list({
        q: `name='Kanban' and mimeType='application/vnd.google-apps.folder' and '${mf.id}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });
      for (const k of (kanban.data.files || [])) {
        kanbanIds.push(k.id);
      }
    }
  }
  return kanbanIds;
}

export async function listKanbanExtensionFolders(
  clientFolderId: string
): Promise<Array<{ name: string; folderId: string; folderUrl: string; fileCount: number }>> {
  const drive = await getDriveClient();
  const kanbanFolderIds = await findAllKanbanFolders(drive, clientFolderId);

  const aggregated: Record<string, { name: string; folderId: string; folderUrl: string; fileCount: number }> = {};

  for (const kanbanId of kanbanFolderIds) {
    const foldersRes = await drive.files.list({
      q: `'${kanbanId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id, name)',
      orderBy: 'name',
      spaces: 'drive',
    });

    for (const f of (foldersRes.data.files || [])) {
      const name = f.name || '';
      const filesRes = await drive.files.list({
        q: `'${f.id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
        fields: 'files(id)',
        spaces: 'drive',
      });
      const count = filesRes.data.files?.length || 0;
      if (aggregated[name]) {
        aggregated[name].fileCount += count;
      } else {
        aggregated[name] = {
          name,
          folderId: f.id || '',
          folderUrl: `https://drive.google.com/drive/folders/${f.id}`,
          fileCount: count,
        };
      }
    }
  }

  return Object.values(aggregated).sort((a, b) => a.name.localeCompare(b.name));
}

export async function createApprovalSubfolder(
  clientFolderId: string,
  postTitle: string,
  version?: number
): Promise<{ folderId: string; folderUrl: string }> {
  const drive = await getDriveClient();
  const monthFolderId = await getYearMonthFolder(drive, clientFolderId);
  const approvalsId = await findOrCreateFolder(drive, "Aprovações", monthFolderId);
  const postFolderId = await findOrCreateFolder(drive, postTitle, approvalsId);

  if (version && version > 1) {
    const versionFolderId = await findOrCreateFolder(drive, `v${version}`, postFolderId);
    return {
      folderId: versionFolderId,
      folderUrl: `https://drive.google.com/drive/folders/${versionFolderId}`,
    };
  }

  return {
    folderId: postFolderId,
    folderUrl: `https://drive.google.com/drive/folders/${postFolderId}`,
  };
}

export async function uploadFileToDrive(
  folderId: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ fileId: string; fileUrl: string }> {
  const drive = await getDriveClient();
  const { Readable } = await import('stream');
  const normalizedName = normalizeFileName(fileName);

  const res = await drive.files.create({
    requestBody: {
      name: normalizedName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink',
  });

  return {
    fileId: res.data.id || '',
    fileUrl: res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`,
  };
}

export async function uploadImageFromUrl(
  folderId: string,
  imageUrl: string,
  fileName: string
): Promise<{ fileId: string; fileUrl: string; downloadUrl: string }> {
  const drive = await getDriveClient();
  const { Readable } = await import('stream');

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'image/png';
  const normalizedName = normalizeFileName(fileName);

  const res = await drive.files.create({
    requestBody: {
      name: normalizedName,
      parents: [folderId],
    },
    media: {
      mimeType: contentType,
      body: Readable.from(buffer),
    },
    fields: 'id, webViewLink, webContentLink',
  });

  const fileId = res.data.id || '';
  return {
    fileId,
    fileUrl: res.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`,
    downloadUrl: res.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`,
  };
}

export async function listDriveFiles(
  folderId: string
): Promise<Array<{ fileId: string; name: string; fileUrl: string; downloadUrl: string; createdTime: string; mimeType: string }>> {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'`,
    fields: 'files(id, name, webViewLink, webContentLink, createdTime, mimeType)',
    orderBy: 'createdTime desc',
    spaces: 'drive',
  });

  return (res.data.files || []).map((f: any) => ({
    fileId: f.id || '',
    name: f.name || '',
    fileUrl: f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`,
    downloadUrl: f.webContentLink || `https://drive.google.com/uc?export=download&id=${f.id}`,
    createdTime: f.createdTime || '',
    mimeType: f.mimeType || '',
  }));
}

export async function getDriveFileDownloadUrl(fileId: string): Promise<string> {
  const drive = await getDriveClient();
  const res = await drive.files.get({
    fileId,
    fields: 'webContentLink',
  });
  return res.data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;
}

export async function getDriveFileStream(fileId: string): Promise<{ stream: any; mimeType: string; name: string }> {
  const drive = await getDriveClient();
  const meta = await drive.files.get({ fileId, fields: 'mimeType, name' });
  const mimeType = meta.data.mimeType || 'application/octet-stream';
  const name = meta.data.name || 'file';
  const res = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  return { stream: res.data, mimeType, name };
}

async function findAllApprovalsFolders(drive: any, clientFolderId: string): Promise<string[]> {
  const approvalIds: string[] = [];

  const directApprovals = await drive.files.list({
    q: `name='Aprovações' and mimeType='application/vnd.google-apps.folder' and '${clientFolderId}' in parents and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  for (const f of (directApprovals.data.files || [])) {
    approvalIds.push(f.id);
  }

  const yearFolders = await drive.files.list({
    q: `mimeType='application/vnd.google-apps.folder' and '${clientFolderId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  for (const yf of (yearFolders.data.files || [])) {
    if (!/^\d{4}$/.test(yf.name || '')) continue;
    const monthFolders = await drive.files.list({
      q: `mimeType='application/vnd.google-apps.folder' and '${yf.id}' in parents and trashed=false`,
      fields: 'files(id, name)',
      spaces: 'drive',
    });
    for (const mf of (monthFolders.data.files || [])) {
      if (!/^\d{2}$/.test(mf.name || '')) continue;
      const approvals = await drive.files.list({
        q: `name='Aprovações' and mimeType='application/vnd.google-apps.folder' and '${mf.id}' in parents and trashed=false`,
        fields: 'files(id)',
        spaces: 'drive',
      });
      for (const a of (approvals.data.files || [])) {
        approvalIds.push(a.id);
      }
    }
  }
  return approvalIds;
}

export async function listApprovalVersionFolders(
  clientFolderId: string,
  postTitle: string
): Promise<Array<{ folderId: string; name: string; folderUrl: string }>> {
  const drive = await getDriveClient();
  const approvalFolderIds = await findAllApprovalsFolders(drive, clientFolderId);

  const escapedTitle = postTitle.replace(/'/g, "\\'");
  let postFolderId: string | null = null;

  for (const approvalsId of approvalFolderIds) {
    const postRes = await drive.files.list({
      q: `name='${escapedTitle}' and mimeType='application/vnd.google-apps.folder' and '${approvalsId}' in parents and trashed=false`,
      fields: 'files(id)',
      spaces: 'drive',
    });
    if (postRes.data.files?.length && postRes.data.files[0].id) {
      postFolderId = postRes.data.files[0].id;
      break;
    }
  }

  if (!postFolderId) return [];

  const foldersRes = await drive.files.list({
    q: `'${postFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    orderBy: 'name',
    spaces: 'drive',
  });

  const folders = (foldersRes.data.files || []).map((f: any) => ({
    folderId: f.id,
    name: f.name,
    folderUrl: `https://drive.google.com/drive/folders/${f.id}`,
  }));

  const rootFiles = await drive.files.list({
    q: `'${postFolderId}' in parents and mimeType!='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    spaces: 'drive',
  });
  if (rootFiles.data.files?.length) {
    folders.unshift({
      folderId: postFolderId,
      name: 'v1',
      folderUrl: `https://drive.google.com/drive/folders/${postFolderId}`,
    });
  }

  return folders;
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  const drive = await getDriveClient();
  await drive.files.delete({ fileId });
}

export async function isDriveConnected(): Promise<boolean> {
  try {
    const drive = await getDriveClient();
    await drive.about.get({ fields: 'user' });
    return true;
  } catch {
    return false;
  }
}

export async function getDriveUserInfo(): Promise<{ email: string; name: string } | null> {
  try {
    const drive = await getDriveClient();
    const res = await drive.about.get({ fields: 'user' });
    return {
      email: res.data.user?.emailAddress || '',
      name: res.data.user?.displayName || '',
    };
  } catch {
    return null;
  }
}
