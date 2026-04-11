import { App, arrayBufferToBase64, Notice } from "obsidian";
import { convertTarToPdf, exportImagesFromTar } from "./saveToPdf";
import { processNotebookPages } from "services/OpenRouterService";
import { getAmazonApi, getChunk } from "./amazonApiUtils";
import { useSettings } from "context/SettingsContext";
import { useCallback } from "react";
import { jobManager } from "pool";
import { computeHash, recordDownload } from "services/DownloadStore";

type Metadata = {
    "metadata": { "currentPage": number, "modificationTime": number, "title": string, "totalPages": number },
    "readingSessionId": string, "renderingToken": string
};
const NOTE_WIDTH = 620;
const NOTE_HEIGHT = 877;
type UseNotebook = {
    downloadOnly: () => void;
    downloadAndProcess: () => void;
};

type FetchResult = {
    images: string[];
    contentHash: string;
    modificationTime: number;
};

/** Fetch all pages and save a PDF. Returns images as base64, a content hash, and the notebook's modificationTime. */
async function fetchPages(
    app: App,
    fileId: string,
    noteName: string,
    update: (p: number) => void
): Promise<FetchResult> {
    update(0);
    const pagesData: ArrayBuffer[] = [];

    const { metadata, renderingToken } = await getAmazonApi<Metadata>(
        `https://read.amazon.com/openNotebook?notebookId=${fileId}&marketplaceId=ATVPDKIKX0DER`
    );
    const notice = new Notice(`Starting fetching pages for ${noteName}`);
    for (let i = 0; i < metadata.totalPages; i += 3) {
        const end = Math.min(i + 2, metadata.totalPages);
        notice.setMessage(`Fetching pages ${i + 1}-${end} out of ${metadata.totalPages}`);

        update((end / metadata.totalPages) * 50);
        const chunk = await getChunk(
            `https://read.amazon.com/renderPage?startPage=${i}&endPage=${end}&width=${NOTE_WIDTH}&height=${NOTE_HEIGHT}&dpi=50`,
            renderingToken
        );
        pagesData.push(chunk);
    }
    notice.hide();
    const [images, contentHash] = await Promise.all([
        exportImagesFromTar(pagesData.map(page => page.slice(0))),
        computeHash(pagesData),
    ]);
    await convertTarToPdf(app, pagesData, noteName);
    update(50);

    return {
        images: images.map(image => arrayBufferToBase64(image.data.buffer as ArrayBuffer)),
        contentHash,
        modificationTime: metadata.modificationTime,
    };
}

export const useNotebook = (fileId: string, noteName: string): UseNotebook => {
    const { app, settings } = useSettings();

    const downloadOnlyTask = useCallback(async (update: (p: number) => void) => {
        const { contentHash, modificationTime } = await fetchPages(app, fileId, noteName, update);
        await recordDownload({ id: fileId, title: noteName, downloadedAt: Date.now(), contentHash, modificationTime });
        update(100);
        new Notice(`Downloaded "${noteName}" — PDF saved.`);
    }, [app, fileId, noteName]);

    const downloadAndProcessTask = useCallback(async (update: (p: number) => void) => {
        const { openRouterKey, model } = settings;

        const { images, contentHash, modificationTime } = await fetchPages(app, fileId, noteName, update);
        await processNotebookPages(
            app,
            images,
            'scribe notes ai/' + noteName,
            noteName,
            openRouterKey,
            model
        );
        await recordDownload({ id: fileId, title: noteName, downloadedAt: Date.now(), contentHash, modificationTime });
        update(100);
        new Notice(`Note "${noteName}" downloaded and processed.`);
    }, [app, fileId, noteName, settings]);

    return {
        downloadOnly: () => void jobManager.addJob(`${fileId}-dl`, downloadOnlyTask),
        downloadAndProcess: () => void jobManager.addJob(`${fileId}-proc`, downloadAndProcessTask),
    };
}

export async function getNotebookData(app: App, fileId: string, noteName: string, openRouterKey: string, model: string) {
    const pagesData: ArrayBuffer[] = [];

    try {
        const { metadata, renderingToken } = await getAmazonApi<Metadata>(`https://read.amazon.com/openNotebook?notebookId=${fileId}&marketplaceId=ATVPDKIKX0DER`);
        
        const notice = new Notice(`Starting fetch for ${metadata.totalPages} pages...`);

        for (let i = 0; i < metadata.totalPages; i += 3) {
            const end = Math.min(i + 2, metadata.totalPages);
            notice.setMessage(`Fetching pages ${i + 1}-${end} out of ${metadata.totalPages}`);

            const chunk = await getChunk(`https://read.amazon.com/renderPage?startPage=${i}&endPage=${end}&width=${NOTE_WIDTH}&height=${NOTE_HEIGHT}&dpi=50`, renderingToken);
            pagesData.push(chunk);
        }

        const images = await exportImagesFromTar(pagesData.map(page => page.slice(0)));
        await convertTarToPdf(app, pagesData, noteName);
        await processNotebookPages(app, images.map(image => arrayBufferToBase64(image.data.buffer as ArrayBuffer)), 'scribe notes ai/' + noteName, noteName, openRouterKey, model);
        notice.hide();
        new Notice(`note ${noteName} converted`)
    } catch (e) {
        console.error("Notebook Data Error:", e);
    }
};