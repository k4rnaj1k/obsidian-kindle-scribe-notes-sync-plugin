import { Notice } from 'obsidian';
import { getNotebookData } from '../util/loadNotebookData';

const electron = require('electron');
const { BrowserWindow } = electron.remote || electron;

export default class AmazonNotesPage {
  private modal: any;
  private waitForLoad: Promise<boolean>;
  private resolvePromise!: (success: boolean) => void;

  constructor() {

    this.waitForLoad = new Promise(
      (resolve: (success: boolean) => void) => (this.resolvePromise = resolve)
    );

    this.modal = new BrowserWindow({
      width: 450,
      height: 730,
      show: false,
    });

    // We can only change title after page is loaded since HTML page has its own title
    this.modal.once('ready-to-show', async () => {
      this.modal.setTitle('Connect your Amazon account to Obsidian');
      this.modal.show();
      setTimeout(async () => {
        const fileIds = await this.modal.webContents.executeJavaScript(
          `(() => {
        const nodes = document.querySelectorAll('img[id^="notebook-image"]');
        return Array.from(nodes).map(node => node.id.replace('notebook-image-', ''));
      })()`);
        const names: Array<string> = await this.modal.webContents.executeJavaScript(
          `(() => {
          const names = document.querySelectorAll('div[id^="file-row-info"]');
          return Array.from(names).map(node => node.textContent);
      })()`
        );
        console.log(fileIds, names);
        for (let i = 0; i < fileIds.length; i++) {
          const fileId = fileIds[i];
          const noteName = names[i];
          if (!fileId || !noteName)
            continue;
          await getNotebookData(fileId, noteName, async (code) => await this.modal.webContents.executeJavaScript(code));
        }
        console.log(fileIds);
      }, 1500);
    });

    // If user is on the read.amazon.com url, we can safely assume they are logged in
    this.modal.webContents.on('did-navigate', async (_event, url) => {

      
    });
    // document.querySelectorAll('div[id^="file-cover"]').forEach(node => console.log(node.id.replace('file-cover-', '')))
    //{"metadata":{"currentPage":1,"modificationTime":1769728168,"title":"another","totalPages":2},"readingSessionId":"1f4ce13c-5311-4cf8-8fc6-290ce5f95706","renderingToken":"AgV4OxBE0KT+m6EFahk9tuuaKDktoaYvShfeSmFqsu2n8gkAegACABVhd3MtY3J5cHRvLXB1YmxpYy1rZXkAREE1ODQwOGxEODYxb044YkVoeHUvYWdFZjRrcElaVFFOWVpkRUtsRDNheUdpVlNQeDFjQWNyc0wxems1Wkd6REVqQT09AApjdXN0b21lcklkAA1BRjhPRjYxT1g0UFdHAAEAB2F3cy1rbXMAS2Fybjphd3M6a21zOnVzLWVhc3QtMTo5NDQzOTg4Njg0MDI6a2V5LzhmNDNlYTUzLWFkN2UtNDY4Mi1hNzQ5LTYwMTk2OTZiMDNmMwC4AQIBAHivxIt7dzv1R8+EEwGSgxnyZkkBTXrYDC/Ymq0lNksXfwEICuuIwYGhmMqrTa1iNHKSAAAAfjB8BgkqhkiG9w0BBwagbzBtAgEAMGgGCSqGSIb3DQEHATAeBglghkgBZQMEAS4wEQQMKztZNWq3ljFOCU5QAgEQgDseAkqMehEutyPo23zYlhdxkv7JKDJU7yWwzso8NcW/6VLGrEZ691CgTgRxeQ4vcEDQWG/RjCZdtcguiAIAABAAlCvTEROW1TtYqFMZswyw3S/BUzMK8bimszmkmgoclODn0fjBTCc/38GkRWLyGR4J/////wAAAAEAAAAAAAAAAAAAAAEAAAFyVIULPTC1bOBn8Hiu22YSw0pSkyISEYndVYyuP9vQiRUFOhls4AFkCMYNbbjF9tgcWU3aZvKeLrYBNC2tPy3M4j4sXkoAaKCsCajWXHroBKNq1LAG0VI48TduQ+y+jIMF8SMGTL2IOeSYd5KRtwYObrI9IhwHGV8mGx7LZcLkJvNwMeRQEdr19zrfA72mhzKIWRYxLSSeErHBdv4e6QznIqnpV9Pxe5JnWu+fgjzp5wL8Cganw+k4thO0j9SzIhvLoZhFs7LI2YvpOvOEJjQDquirfAdlyCfzyPLU2K6auW8C7wONIYKUwdD5NtVR/5AROl1NPAbZa2fxPFHQePyV8WhpVFwt6PQCDXqQXJpTH0K/Saffa/IhJw0eV+y7HWbA4a8a3QjRtbehfYvK9bwnw+8Xw4FX+IZPlBffmAN/qEq5JSL3pOvh2SpkA7jk/1+RUYmXdp6dTpS3b8C+hdEoAp1YbiVeyy/PUDZiPUM8EbflPwHdej5TTNCtou1BptESaBkAZzBlAjEAgLyfjfub83ENyQxCplYmH1BYWM3Nc5/0/6qp3beEYApt0BQ/6jdECQMyhB2DWnamAjAhC3scTa/2d+SNIszcM/C+ViOpbmv6SWvcZocGRGW/71dyemxCSacZbaPXrT/w4/0="}
    //https://read.amazon.com/openNotebook?notebookId=4e7a3809-9154-4523-dc62-d3a241dbaab1&marketplaceId=ATVPDKIKX0DER

    this.modal.on('closed', () => {
      this.resolvePromise(false);
    });
  }

  async doLoad(): Promise<boolean> {
    try {
      await this.modal.loadURL('https://read.amazon.com/kindle-notebook?ref_=neo_mm_yn_na_kfa',
        { userAgent: 'Mozilla/5.0 (Linux; Android 15.0.0 r12; Z832 Build/MMB29M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.7559.53 Mobile Safari/537.36' });
    } catch (error) {
      // Swallow error. `loadUrl` is interrupted on successful
      // login as we immediately redirect if user is logged in
    }

    return this.waitForLoad;
  }
}
