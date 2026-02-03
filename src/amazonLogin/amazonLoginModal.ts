const electron = require('electron');
const { BrowserWindow } = electron.remote || electron;

export default class AmazonLoginModal {
  private modal: any;
  private waitForSignIn: Promise<boolean>;
  private resolvePromise!: (success: boolean) => void;

  constructor() {

    this.waitForSignIn = new Promise(
      (resolve: (success: boolean) => void) => (this.resolvePromise = resolve)
    );

    this.modal = new BrowserWindow({
      width: 450,
      height: 730,
      show: false,
    });

    // We can only change title after page is loaded since HTML page has its own title
    this.modal.once('ready-to-show', () => {
      this.modal.setTitle('Connect your Amazon account to Obsidian');
      this.modal.show();
    });

    // If user is on the read.amazon.com url, we can safely assume they are logged in
    this.modal.webContents.on('did-navigate', (_event, url) => {
      if (url.startsWith('https://read.amazon.com')) {
        console.log('is logged in')
        this.modal.close();
        this.resolvePromise(true);
      }
    });

    this.modal.on('closed', () => {
      this.resolvePromise(false);
    });
  }

  async doLogin(): Promise<boolean> {
    try {
      await this.modal.loadURL('https://read.amazon.com/notebook');
    } catch (error) {
      // Swallow error. `loadUrl` is interrupted on successful
      // login as we immediately redirect if user is logged in
    }

    return this.waitForSignIn;
  }
}
