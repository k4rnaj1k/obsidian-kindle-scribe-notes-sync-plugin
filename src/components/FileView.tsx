import React, { useEffect, useState } from "react";
import { FileData, SortOrder } from "types/Notebook";
import { useNotebook } from "../util/loadNotebookData";
import { jobManager } from "pool";
import { Bot, CheckCircle, Download } from "lucide-react";
import { useSettings } from "context/SettingsContext";
import { Tooltip } from "react-tooltip";
import { useDownloadStore } from "context/DownloadContext";
import { DownloadRecord } from "services/DownloadStore";

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

    const downloadedDate = new Date(record.downloadedAt).toLocaleString();

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

const sortFiles = (files: FileData[], sortOrder: SortOrder, records: Map<string, DownloadRecord>): FileData[] => {
    if (sortOrder === 'default') return files;
    return [...files].sort((a, b) => {
        if (sortOrder === 'a-z') return a.title.localeCompare(b.title);
        if (sortOrder === 'z-a') return b.title.localeCompare(a.title);
        // Use modificationTime captured at download time (from individual notebook API)
        const aDate = records.get(a.id)?.modificationTime ?? 0;
        const bDate = records.get(b.id)?.modificationTime ?? 0;
        return sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
    });
};

export const NotesList = ({ objects, sortOrder = 'default' }: { objects: FileData[], sortOrder?: SortOrder }) => {
    const { records } = useDownloadStore();
    const sorted = sortFiles(objects, sortOrder, records);
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