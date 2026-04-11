import { FileData } from 'types/Notebook';
import { getAmazonApi } from '../util/amazonApiUtils';


const getNotesData = async (): Promise<FileData[]> => {
    const result = await getAmazonApi<{ itemsList: FileData[] }>('https://read.amazon.com/kindle-notebook/api/notes');
    if (result.itemsList.length > 0) {
        console.debug('[KindleScribe] First item fields:', Object.keys(result.itemsList[0]));
        console.debug('[KindleScribe] First item:', result.itemsList[0]);
    }
    return result.itemsList;
}

export const notesService = {
    getNotesData
}