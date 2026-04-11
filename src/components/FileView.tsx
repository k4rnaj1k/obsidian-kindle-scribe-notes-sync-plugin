import React, { useEffect, useState } from "react";
import { FileData, SortOrder } from "types/Notebook";
import { useNotebook } from "../util/loadNotebookData";
import { jobManager } from "pool";
import { AlertTriangle, Bot, CheckCircle, Download } from "lucide-react";
import { useSettings } from "context/SettingsContext";
import { Tooltip } from "react-tooltip";
import { useDownloadStore } from "context/DownloadContext";
import { toMs } from "services/DownloadStore";

const RenderJobProgress = ({ percentage }: { percentage: number }) => {
    const filled = Math.round(percentage / 10);
    const empty = 10 - filled;
    return (
        <div style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>
            {'█'.repeat(filled)}{'░'.repeat(empty)} {percentage}%
        </div>
    );
};


const DownloadStatus = ({ file }: { file: FileData }) => {
    const { records } = useDownloadStore();
    const record = records.get(file.id);

    if (!record) return null;

    const apiModTime = file.lastModifiedDate ?? file.createdDate;
    const hasUpdate = apiModTime != null && toMs(apiModTime) > toMs(record.modificationTime);

    const downloadedDate = new Date(record.downloadedAt).toLocaleString();

    if (hasUpdate) {
        return <>
            <Tooltip id={`update-tooltip-${file.id}`} place="top">
                Update available — downloaded {downloadedDate}
            </Tooltip>
            <AlertTriangle
                className="status-update"
                size={16}
                data-tooltip-id={`update-tooltip-${file.id}`}
            />
        </>;
    }

    return <>
        <Tooltip id={`downloaded-tooltip-${file.id}`} place="top">
            Downloaded {downloadedDate}
        </Tooltip>
        <CheckCircle
            className="status-downloaded"
            size={16}
            data-tooltip-id={`downloaded-tooltip-${file.id}`}
        />
    </>;
};

const Note = ({ file }: { file: FileData }) => {
    const [, setTick] = useState(0);
    useEffect(() => {
        const unsub = jobManager.subscribe(() => setTick(t => t + 1));
        return () => { unsub(); };
    }, []);

    const { settings } = useSettings();

    const dlJob = jobManager.jobs.get(`${file.id}-dl`);
    const procJob = jobManager.jobs.get(`${file.id}-proc`);
    const activeJob = (dlJob && dlJob.status !== 'completed' && dlJob.status !== 'failed') ? dlJob
        : (procJob && procJob.status !== 'completed' && procJob.status !== 'failed') ? procJob
        : null;
    const { downloadOnly, downloadAndProcess } = useNotebook(file.id, file.title);

    return (<div className="file-row">
        <span className="file-title">
            {file.title}
            <DownloadStatus file={file} />
        </span>
        {!settings.openRouterKey && <Tooltip id="ai-download-tooltip" place="top">No OpenRouter API key configured. Go to Settings → Kindle Scribe Notes to add one.</Tooltip>}
        {activeJob
            ? <RenderJobProgress percentage={activeJob.progress} />
            : <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button onClick={downloadOnly}><Download /></button>
                or
                <button disabled={!settings.openRouterKey} onClick={downloadAndProcess} data-tooltip-id="ai-download-tooltip"><Download /> + <Bot /></button>
            </div>
        }
    </div>);
}

const sortFiles = (files: FileData[], sortOrder: SortOrder): FileData[] => {
    if (sortOrder === 'default') return files;
    return [...files].sort((a, b) => {
        const aDate = a.lastModifiedDate ?? a.createdDate ?? 0;
        const bDate = b.lastModifiedDate ?? b.createdDate ?? 0;
        return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
};

export const NotesList = ({ objects, sortOrder = 'default' }: { objects: FileData[], sortOrder?: SortOrder }) => {
    const sorted = sortFiles(objects, sortOrder);
    const renderFolder = (folder: FileData) => {
        return <details className="file-row" style={{ marginRight: 0}}>
            <summary>{folder.title}</summary>
            <NotesList objects={folder.items} sortOrder={sortOrder} />
        </details>;
    }
    return <div>
        {sorted.map(file => {
            if (file.type == 'folder')
                return renderFolder(file);
            return <Note file={file} />
        })}
    </div>
};