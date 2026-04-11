//"id":"4e7a3809-9154-4523-dc62-d3a241dbaab1",
// "title":"another"
// ,"type":"notebook","parentFolder":"root","items":[]
export type FileData = {
    id: string;
    title: string;
    type: 'notebook' | 'folder',
    items: FileData[];
    lastModifiedDate?: number;
    createdDate?: number;
};

export type SortOrder = 'default' | 'newest' | 'oldest' | 'a-z' | 'z-a';