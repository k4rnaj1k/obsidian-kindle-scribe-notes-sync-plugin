import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { DownloadRecord, getAllRecords } from 'services/DownloadStore';
import { jobManager } from 'pool';

interface DownloadContextType {
    records: Map<string, DownloadRecord>;
    refresh: () => Promise<void>;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [records, setRecords] = useState<Map<string, DownloadRecord>>(new Map());
    const seenCompleted = useRef(new Set<string>());

    const refresh = useCallback(async () => {
        try {
            const all = await getAllRecords();
            setRecords(all);
        } catch (e) {
            console.error('[DownloadStore] Failed to load records:', e);
        }
    }, []);

    useEffect(() => {
        void refresh();

        // Re-read IndexedDB whenever a job newly transitions to 'completed'.
        // The download task writes to IndexedDB before the job manager marks it
        // completed, so the record is guaranteed to exist by this point.
        const unsub = jobManager.subscribe((jobs) => {
            const newlyCompleted = jobs.filter(
                j => j.status === 'completed' && !seenCompleted.current.has(j.id)
            );
            if (newlyCompleted.length > 0) {
                newlyCompleted.forEach(j => seenCompleted.current.add(j.id));
                void refresh();
            }
        });

        return () => unsub();
    }, [refresh]);

    return (
        <DownloadContext.Provider value={{ records, refresh }}>
            {children}
        </DownloadContext.Provider>
    );
};

export const useDownloadStore = (): DownloadContextType => {
    const ctx = useContext(DownloadContext);
    if (!ctx) throw new Error('useDownloadStore must be used within DownloadProvider');
    return ctx;
};
