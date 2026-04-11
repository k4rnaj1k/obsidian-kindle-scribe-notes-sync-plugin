import { App, Modal } from "obsidian";
import React from "react";
import { createRoot, Root } from "react-dom/client";
import { SettingsProvider } from "../context/SettingsContext";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../util/queryClient";
import { MainView } from "views/MainView";
import '../main.css';
import { JobsContextProvider } from "context/JobContext";
import { DownloadProvider } from "context/DownloadContext";

export class ReactWrapper extends Modal {
    root: Root | null = null;
    hidden: boolean = true;
    private settings: { openRouterKey: string, model: string };

    constructor(app: App, settings: { openRouterKey: string, model: string } ) {
        super(app);
        this.settings = settings;
    }

    onOpen() {
        const { contentEl } = this;

        this.root = createRoot(contentEl);
        this.setTitle('Kindle notes list');
        this.root.render(
            <React.StrictMode>
                <SettingsProvider settings={this.settings} app={this.app}>
                    <QueryClientProvider client={queryClient}>
                        <JobsContextProvider>
                            <DownloadProvider>
                                <MainView />
                            </DownloadProvider>
                        </JobsContextProvider>
                    </QueryClientProvider>
                </SettingsProvider>
            </React.StrictMode>
        );
    }

    onClose() {
        this.root = null;
        
        this.contentEl.empty();
    }
}