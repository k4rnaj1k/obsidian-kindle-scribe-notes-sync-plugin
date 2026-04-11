import { QueryObserverResult, useQuery } from "@tanstack/react-query";
import { doAmazonLogin } from "amazonLogin/doAmazonLogin";
import { amazonLogoutModal } from "amazonLogin/amazonLogoutModal";
import { NotesList } from "components/FileView";
import { LoadingComponent } from "components/LoadingComponent";
import { LoaderCircle, RefreshCcwDot } from "lucide-react";
import React, { useEffect, useState } from "react";
import { notesService } from "services/NotesService";
import { FileData, SortOrder } from "types/Notebook";
import { noAmazonCookies } from "../util/amazonApiUtils";
import { NoCookiesView } from './NoCookiesView';

type RefetchFn = () => Promise<QueryObserverResult<FileData[], Error>>;

const SORT_LABELS: Record<SortOrder, string> = {
    default: 'Sort: default',
    newest: 'Sort: newest first',
    oldest: 'Sort: oldest first',
    'a-z': 'Sort: A → Z',
    'z-a': 'Sort: Z → A',
};

const SORT_CYCLE: Record<SortOrder, SortOrder> = {
    default: 'a-z',
    'a-z': 'z-a',
    'z-a': 'newest',
    newest: 'oldest',
    oldest: 'default',
};

const NotesError = ({ refetch }: { refetch: RefetchFn }) => {
    return <div className="error-text">
        <p>Failed to fetch notes. </p>
        <p>Probably caused by <b>outdated/non-existing</b> Amazon cookies.<br />
            Try to login with this button:
        </p>
        <button onClick={() => void doAmazonLogin().then(login => login && refetch())}>Login to Amazon</button>
        <code style={{ paddingTop: '15px' }}>If that doesn't work - try <b>Logging out and then logging in</b>.</code>
    </div>;
};

const collectNotes = (files: FileData[]): FileData[] => {
    return files.flatMap(item => item.type == 'folder' ? [...collectNotes(item.items), item] : item);
}

const NotesControls = ({ contentLoading, refetch, setIsLoggedOut, data, sortOrder, onSortChange }: { contentLoading: boolean, refetch: RefetchFn, setIsLoggedOut: () => void, data: FileData[], sortOrder: SortOrder, onSortChange: (order: SortOrder) => void }) => {
    const notes = collectNotes(data);
    const files = notes.filter(item => item.type == 'notebook').length;
    const folders = notes.filter(item => item.type == 'folder').length;
    return <div style={{ display: 'grid', gap: '15px', justifyContent: 'end', paddingBottom: '15px', gridAutoFlow: 'column' }}>
        <div>Showing data for {files} notes, {folders} folders in Vault</div>
        <button onClick={() => onSortChange(SORT_CYCLE[sortOrder])}>{SORT_LABELS[sortOrder]}</button>
        <button disabled={contentLoading} onClick={() => {
            void refetch();
        }}>{contentLoading ? <LoaderCircle className="rotate" /> : <RefreshCcwDot />}</button>
        <button onClick={() => {
            void amazonLogoutModal().then(logout => logout && setIsLoggedOut())
        }}>Logout from Amazon</button>
    </div>;
};

export const MainView = () => {
    const [isLoggedOut, setIsLoggedOut] = useState(false);
    const [hasCookies, setHasCookies] = useState<boolean | null>(null);
    const [sortOrder, setSortOrder] = useState<SortOrder>('default');

    useEffect(() => {
        void noAmazonCookies().then(missing => setHasCookies(!missing));
    }, []);

    const { data, isLoading, isRefetching, refetch, error } = useQuery({
        queryKey: ['notes', isLoggedOut],
        queryFn: notesService.getNotesData,
        enabled: !isLoggedOut,
    });

    const contentLoading = !data || isLoading || isRefetching;

    if (hasCookies === false) {
        return <NoCookiesView setLoggedOut={(value) => { setIsLoggedOut(value); void refetch(); }} />;
    }

    return (
        <div className="file-modal">
            <NotesControls
                data={data || []}
                contentLoading={contentLoading}
                setIsLoggedOut={() => setIsLoggedOut(true)}
                refetch={refetch}
                sortOrder={sortOrder}
                onSortChange={setSortOrder} />
            <div className="notes-content">
                {error ? <NotesError refetch={refetch} /> : contentLoading ? <LoadingComponent /> : <NotesList objects={data} sortOrder={sortOrder} />}
            </div>
        </div>
    );
};