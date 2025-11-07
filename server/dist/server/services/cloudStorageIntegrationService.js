import { Storage } from '@google-cloud/storage';
import { Client } from '@microsoft/microsoft-graph-client';
import { Dropbox } from 'dropbox';
import { BlobServiceClient } from '@azure/storage-blob';
import crypto from 'crypto';
import path from 'path';
export class CloudStorageIntegrationService {
    googleStorage;
    microsoftClient;
    dropboxClient;
    azureBlobClient;
    encryptionKey;
    constructor() {
        this.encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
        this.initializeProviders();
    }
    async initializeProviders() {
        try {
            // Initialize Google Cloud Storage
            if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
                this.googleStorage = new Storage({
                    keyFilename: process.env.GOOGLE_CLOUD_CREDENTIALS,
                    projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                });
            }
            // Initialize Microsoft Graph (OneDrive)
            if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
                this.microsoftClient = Client.init({
                    authProvider: async (done) => {
                        // OAuth token implementation would go here
                        done(null, process.env.MICROSOFT_ACCESS_TOKEN || '');
                    }
                });
            }
            // Initialize Dropbox
            if (process.env.DROPBOX_ACCESS_TOKEN) {
                this.dropboxClient = new Dropbox({
                    accessToken: process.env.DROPBOX_ACCESS_TOKEN
                });
            }
            // Initialize Azure Blob Storage
            if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
                this.azureBlobClient = BlobServiceClient.fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING);
            }
        }
        catch (error) {
            console.error('Cloud storage initialization error:', error);
        }
    }
    async uploadToGoogleDrive(fileBuffer, fileName, mimeType) {
        if (!this.googleStorage) {
            throw new Error('Google Cloud Storage not configured');
        }
        const bucketName = process.env.GOOGLE_STORAGE_BUCKET || 'rur2-evidence-storage';
        const bucket = this.googleStorage.bucket(bucketName);
        // Encrypt sensitive files
        const isSecure = this.isSensitiveFile(fileName);
        let processedBuffer = fileBuffer;
        let encryptionKey;
        if (isSecure) {
            const result = await this.encryptFile(fileBuffer);
            processedBuffer = result.encryptedData;
            encryptionKey = result.encryptionKey;
        }
        const file = bucket.file(`evidence/${Date.now()}-${fileName}`);
        const stream = file.createWriteStream({
            metadata: {
                contentType: mimeType,
                metadata: {
                    originalName: fileName,
                    uploadDate: new Date().toISOString(),
                    encrypted: isSecure.toString()
                }
            }
        });
        return new Promise((resolve, reject) => {
            stream.on('error', reject);
            stream.on('finish', () => {
                resolve({
                    fileId: file.name,
                    fileName,
                    size: processedBuffer.length,
                    provider: 'google_drive',
                    encryptionKey,
                    uploadUrl: `gs://${bucketName}/${file.name}`
                });
            });
            stream.end(processedBuffer);
        });
    }
    async uploadToOneDrive(fileBuffer, fileName) {
        if (!this.microsoftClient) {
            throw new Error('OneDrive not configured');
        }
        const isSecure = this.isSensitiveFile(fileName);
        let processedBuffer = fileBuffer;
        let encryptionKey;
        if (isSecure) {
            const result = await this.encryptFile(fileBuffer);
            processedBuffer = result.encryptedData;
            encryptionKey = result.encryptionKey;
        }
        try {
            const uploadSession = await this.microsoftClient
                .api('/me/drive/root:/RUR2_Evidence/' + fileName + ':/createUploadSession')
                .post({
                item: {
                    '@microsoft.graph.conflictBehavior': 'rename',
                    name: fileName
                }
            });
            // For simplicity, using direct upload for small files
            const response = await this.microsoftClient
                .api('/me/drive/root:/RUR2_Evidence/' + fileName + ':/content')
                .put(processedBuffer);
            return {
                fileId: response.id,
                fileName,
                size: processedBuffer.length,
                provider: 'onedrive',
                encryptionKey,
                uploadUrl: response.webUrl
            };
        }
        catch (error) {
            throw new Error(`OneDrive upload failed: ${error.message}`);
        }
    }
    async uploadToDropbox(fileBuffer, fileName) {
        if (!this.dropboxClient) {
            throw new Error('Dropbox not configured');
        }
        const isSecure = this.isSensitiveFile(fileName);
        let processedBuffer = fileBuffer;
        let encryptionKey;
        if (isSecure) {
            const result = await this.encryptFile(fileBuffer);
            processedBuffer = result.encryptedData;
            encryptionKey = result.encryptionKey;
        }
        try {
            const response = await this.dropboxClient.filesUpload({
                path: `/RUR2_Evidence/${Date.now()}-${fileName}`,
                contents: processedBuffer,
                mode: { '.tag': 'add' },
                autorename: true
            });
            return {
                fileId: response.result.id,
                fileName,
                size: processedBuffer.length,
                provider: 'dropbox',
                encryptionKey,
                uploadUrl: response.result.path_display
            };
        }
        catch (error) {
            throw new Error(`Dropbox upload failed: ${error.message}`);
        }
    }
    async uploadToAzureBlob(fileBuffer, fileName, mimeType) {
        if (!this.azureBlobClient) {
            throw new Error('Azure Blob Storage not configured');
        }
        const containerName = process.env.AZURE_CONTAINER_NAME || 'rur2-evidence';
        const containerClient = this.azureBlobClient.getContainerClient(containerName);
        // Ensure container exists
        await containerClient.createIfNotExists({ access: 'blob' });
        const isSecure = this.isSensitiveFile(fileName);
        let processedBuffer = fileBuffer;
        let encryptionKey;
        if (isSecure) {
            const result = await this.encryptFile(fileBuffer);
            processedBuffer = result.encryptedData;
            encryptionKey = result.encryptionKey;
        }
        const blobName = `evidence/${Date.now()}-${fileName}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        try {
            await blockBlobClient.upload(processedBuffer, processedBuffer.length, {
                blobHTTPHeaders: {
                    blobContentType: mimeType
                },
                metadata: {
                    originalName: fileName,
                    uploadDate: new Date().toISOString(),
                    encrypted: isSecure.toString()
                }
            });
            return {
                fileId: blobName,
                fileName,
                size: processedBuffer.length,
                provider: 'azure_blob',
                encryptionKey,
                uploadUrl: blockBlobClient.url
            };
        }
        catch (error) {
            throw new Error(`Azure Blob upload failed: ${error.message}`);
        }
    }
    async downloadFile(provider, fileId, encryptionKey) {
        let fileBuffer;
        switch (provider) {
            case 'google_drive':
                if (!this.googleStorage)
                    throw new Error('Google Cloud Storage not configured');
                const bucket = this.googleStorage.bucket(process.env.GOOGLE_STORAGE_BUCKET || 'rur2-evidence-storage');
                const file = bucket.file(fileId);
                const [contents] = await file.download();
                fileBuffer = contents;
                break;
            case 'onedrive':
                if (!this.microsoftClient)
                    throw new Error('OneDrive not configured');
                const response = await this.microsoftClient.api(`/me/drive/items/${fileId}/content`).get();
                fileBuffer = Buffer.from(response);
                break;
            case 'dropbox':
                if (!this.dropboxClient)
                    throw new Error('Dropbox not configured');
                const downloadResponse = await this.dropboxClient.filesDownload({ path: fileId });
                fileBuffer = downloadResponse.result.fileBinary;
                break;
            case 'azure_blob':
                if (!this.azureBlobClient)
                    throw new Error('Azure Blob Storage not configured');
                const containerName = process.env.AZURE_CONTAINER_NAME || 'rur2-evidence';
                const containerClient = this.azureBlobClient.getContainerClient(containerName);
                const blobClient = containerClient.getBlobClient(fileId);
                const downloadResult = await blobClient.download();
                if (downloadResult.readableStreamBody) {
                    const chunks = [];
                    for await (const chunk of downloadResult.readableStreamBody) {
                        chunks.push(Buffer.from(chunk));
                    }
                    fileBuffer = Buffer.concat(chunks);
                }
                else {
                    throw new Error('Failed to download blob');
                }
                break;
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
        // Decrypt if needed
        if (encryptionKey) {
            return this.decryptFile(fileBuffer, encryptionKey);
        }
        return fileBuffer;
    }
    async checkQuota(provider) {
        switch (provider) {
            case 'google_drive':
                // Google Cloud Storage quota check
                return { used: 0, limit: 1000000000000, available: 1000000000000 }; // 1TB default
            case 'onedrive':
                if (!this.microsoftClient)
                    throw new Error('OneDrive not configured');
                const quota = await this.microsoftClient.api('/me/drive').get();
                return {
                    used: quota.quota.used,
                    limit: quota.quota.total,
                    available: quota.quota.remaining
                };
            case 'dropbox':
                if (!this.dropboxClient)
                    throw new Error('Dropbox not configured');
                const usage = await this.dropboxClient.usersGetSpaceUsage();
                const allocation = usage.result.allocation.allocated || 1000000000000;
                return {
                    used: usage.result.used,
                    limit: allocation,
                    available: allocation - usage.result.used
                };
            case 'azure_blob':
                // Azure Blob Storage doesn't have a direct quota API
                // Return account-level defaults (adjust based on actual Azure subscription)
                return { used: 0, limit: 5000000000000, available: 5000000000000 }; // 5TB default
            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
    async encryptFile(data) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();
        const encryptedData = Buffer.concat([iv, authTag, encrypted]);
        const encryptionKey = Buffer.concat([key, iv]).toString('base64');
        return { encryptedData, encryptionKey };
    }
    decryptFile(encryptedData, encryptionKeyBase64) {
        const algorithm = 'aes-256-gcm';
        const keyBuffer = Buffer.from(encryptionKeyBase64, 'base64');
        const key = keyBuffer.slice(0, 32);
        const iv = encryptedData.slice(0, 16);
        const authTag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }
    isSensitiveFile(fileName) {
        const sensitiveExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.csv'];
        const sensitiveKeywords = ['financial', 'audit', 'compliance', 'assessment', 'evidence'];
        const extension = path.extname(fileName).toLowerCase();
        const nameLower = fileName.toLowerCase();
        return sensitiveExtensions.includes(extension) ||
            sensitiveKeywords.some(keyword => nameLower.includes(keyword));
    }
    async getProviderStatus() {
        const providers = [];
        // Google Drive status
        if (this.googleStorage) {
            try {
                const quota = await this.checkQuota('google_drive');
                providers.push({
                    id: 'google_drive',
                    name: 'Google Drive',
                    type: 'google_drive',
                    credentials: !!process.env.GOOGLE_CLOUD_CREDENTIALS,
                    quotaUsed: quota.used,
                    quotaLimit: quota.limit,
                    isActive: true
                });
            }
            catch (error) {
                providers.push({
                    id: 'google_drive',
                    name: 'Google Drive',
                    type: 'google_drive',
                    credentials: false,
                    quotaUsed: 0,
                    quotaLimit: 0,
                    isActive: false
                });
            }
        }
        // OneDrive status
        if (this.microsoftClient) {
            try {
                const quota = await this.checkQuota('onedrive');
                providers.push({
                    id: 'onedrive',
                    name: 'OneDrive',
                    type: 'onedrive',
                    credentials: !!process.env.MICROSOFT_ACCESS_TOKEN,
                    quotaUsed: quota.used,
                    quotaLimit: quota.limit,
                    isActive: true
                });
            }
            catch (error) {
                providers.push({
                    id: 'onedrive',
                    name: 'OneDrive',
                    type: 'onedrive',
                    credentials: false,
                    quotaUsed: 0,
                    quotaLimit: 0,
                    isActive: false
                });
            }
        }
        // Dropbox status
        if (this.dropboxClient) {
            try {
                const quota = await this.checkQuota('dropbox');
                providers.push({
                    id: 'dropbox',
                    name: 'Dropbox',
                    type: 'dropbox',
                    credentials: !!process.env.DROPBOX_ACCESS_TOKEN,
                    quotaUsed: quota.used,
                    quotaLimit: quota.limit,
                    isActive: true
                });
            }
            catch (error) {
                providers.push({
                    id: 'dropbox',
                    name: 'Dropbox',
                    type: 'dropbox',
                    credentials: false,
                    quotaUsed: 0,
                    quotaLimit: 0,
                    isActive: false
                });
            }
        }
        // Azure Blob Storage status
        if (this.azureBlobClient) {
            try {
                const quota = await this.checkQuota('azure_blob');
                providers.push({
                    id: 'azure_blob',
                    name: 'Azure Blob Storage',
                    type: 'azure_blob',
                    credentials: !!process.env.AZURE_STORAGE_CONNECTION_STRING,
                    quotaUsed: quota.used,
                    quotaLimit: quota.limit,
                    isActive: true
                });
            }
            catch (error) {
                providers.push({
                    id: 'azure_blob',
                    name: 'Azure Blob Storage',
                    type: 'azure_blob',
                    credentials: false,
                    quotaUsed: 0,
                    quotaLimit: 0,
                    isActive: false
                });
            }
        }
        return providers;
    }
}
export const cloudStorageService = new CloudStorageIntegrationService();
