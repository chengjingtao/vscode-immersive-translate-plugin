import * as vscode from 'vscode';
import { getConfig, validateConfig, TranslateConfig } from './config';
import { createTranslationService } from './translationService';

let translateSlidePanel: vscode.WebviewPanel | undefined;
let immersiveDecorationType: vscode.TextEditorDecorationType | undefined;
let immersiveDecorations: vscode.DecorationOptions[] = [];

export function activate(context: vscode.ExtensionContext) {
    // Initialize decoration type for immersive translation
    immersiveDecorationType = vscode.window.createTextEditorDecorationType({
        after: {
            color: '#6A9955',
            fontStyle: 'italic',
            margin: '0 0 0 2em'
        }
    });

    // Register Translate to Slide command
    const translateToSlideCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateToSlide',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const text = editor.document.getText();

            if (!text.trim()) {
                vscode.window.showWarningMessage('Current file is empty.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await showTranslateSlidePanel(context, text, config);
        }
    );

    const translateToSlideOnlyTargetCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateToSlideOnlyTarget',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const text = editor.document.getText();

            if (!text.trim()) {
                vscode.window.showWarningMessage('Current file is empty.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await showTranslateSlidePanelOnlyTarget(context, text, config);
        }
    );

    // Register Translate Immersive command
    const translateImmersiveCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.translateImmersive',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor found.');
                return;
            }

            const config = getConfig();
            const validation = validateConfig(config);
            if (!validation.valid) {
                vscode.window.showErrorMessage(validation.message || 'Invalid configuration');
                return;
            }

            await translateImmersive(editor, config);
        }
    );

    // Register Close Translate Immersive command
    const closeTranslateImmersiveCommand = vscode.commands.registerCommand(
        'vscode-immersive-translate-plugin.closeTranslateImmersive',
        () => {
            clearImmersiveDecorations();
            vscode.window.showInformationMessage('Immersive translation closed.');
        }
    );

    context.subscriptions.push(
        translateToSlideCommand,
        translateToSlideOnlyTargetCommand,
        translateImmersiveCommand,
        closeTranslateImmersiveCommand,
        immersiveDecorationType
    );
}

async function showTranslateSlidePanel(
    context: vscode.ExtensionContext,
    text: string,
    config: TranslateConfig
): Promise<void> {
    // Create or reveal the panel
    const column = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Beside
        : vscode.ViewColumn.One;

    if (translateSlidePanel) {
        translateSlidePanel.reveal(column);
    } else {
        translateSlidePanel = vscode.window.createWebviewPanel(
            'translateSlide',
            'Translation',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        translateSlidePanel.onDidDispose(
            () => { translateSlidePanel = undefined; },
            null,
            context.subscriptions
        );
    }

    const originalLines = text.split(/\r?\n/);
    const translatedLines = new Array<string>(originalLines.length).fill('');
    translateSlidePanel.webview.html = getTranslationResultHtml(originalLines, translatedLines, true);

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Translating current file...',
                cancellable: true
            },
            async (progress, token) => {
                const service = createTranslationService(config.apiProvider);

                for (let i = 0; i < originalLines.length; i++) {
                    if (token.isCancellationRequested) {
                        break;
                    }

                    const sourceLine = originalLines[i];
                    if (!sourceLine.trim()) {
                        translatedLines[i] = '';
                    } else {
                        try {
                            const result = await service.translate(sourceLine, config);
                            translatedLines[i] = result.text;
                        } catch {
                            translatedLines[i] = '[Translation failed]';
                        }
                    }

                    progress.report({
                        message: `Line ${i + 1}/${originalLines.length}`,
                        increment: 100 / Math.max(originalLines.length, 1)
                    });

                    if (translateSlidePanel) {
                        translateSlidePanel.webview.html = getTranslationResultHtml(originalLines, translatedLines, true);
                    }
                }
            }
        );

        if (translateSlidePanel) {
            translateSlidePanel.webview.html = getTranslationResultHtml(originalLines, translatedLines, false);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        translateSlidePanel.webview.html = getErrorHtml(errorMessage);
    }
}

async function showTranslateSlidePanelOnlyTarget(
    context: vscode.ExtensionContext,
    text: string,
    config: TranslateConfig
): Promise<void> {
    const column = vscode.window.activeTextEditor
        ? vscode.ViewColumn.Beside
        : vscode.ViewColumn.One;

    if (translateSlidePanel) {
        translateSlidePanel.reveal(column);
    } else {
        translateSlidePanel = vscode.window.createWebviewPanel(
            'translateSlide',
            'Translation',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        translateSlidePanel.onDidDispose(
            () => { translateSlidePanel = undefined; },
            null,
            context.subscriptions
        );
    }

    translateSlidePanel.webview.html = getOnlyTargetResultHtml('', true);

    try {
        const result = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Translating current file...',
                cancellable: false
            },
            async () => {
                const service = createTranslationService(config.apiProvider);
                return service.translate(text, config);
            }
        );

        if (translateSlidePanel) {
            translateSlidePanel.webview.html = getOnlyTargetResultHtml(result.text, false);
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        translateSlidePanel.webview.html = getErrorHtml(errorMessage);
    }
}

async function translateImmersive(
    editor: vscode.TextEditor,
    config: TranslateConfig
): Promise<void> {
    // Clear existing decorations
    immersiveDecorations = [];

    const document = editor.document;
    const lineCount = Math.min(document.lineCount, 50); // Limit to 50 lines for performance

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Translating...',
            cancellable: true
        },
        async (progress, token) => {
            const service = createTranslationService(config.apiProvider);
            
            for (let i = 0; i < lineCount; i++) {
                if (token.isCancellationRequested) {
                    break;
                }

                const line = document.lineAt(i);
                const text = line.text.trim();

                if (!text) {
                    continue;
                }

                progress.report({
                    message: `Line ${i + 1}/${lineCount}`,
                    increment: (100 / lineCount)
                });

                try {
                    const result = await service.translate(text, config);
                    
                    const decoration: vscode.DecorationOptions = {
                        range: line.range,
                        renderOptions: {
                            after: {
                                contentText: result.text
                            }
                        }
                    };
                    immersiveDecorations.push(decoration);
                    
                    // Apply decorations incrementally for better UX
                    editor.setDecorations(immersiveDecorationType!, [...immersiveDecorations]);
                } catch {
                    // Skip lines that fail to translate
                }
            }
        }
    );

    vscode.window.showInformationMessage(`Immersive translation complete.`);
}

function clearImmersiveDecorations(): void {
    const editor = vscode.window.activeTextEditor;
    if (editor && immersiveDecorationType) {
        editor.setDecorations(immersiveDecorationType, []);
    }
    immersiveDecorations = [];
}

function getTranslationResultHtml(originalLines: string[], translatedLines: string[], translating: boolean): string {
    const interleavedHtml = buildInterleavedHtml(originalLines, translatedLines);
    const status = translating ? '<div class="status">Translating...</div>' : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Result</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
                    font-size: var(--vscode-editor-font-size, 14px);
                    font-weight: var(--vscode-editor-font-weight, normal);
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .content {
                    line-height: 1.5;
                    tab-size: 4;
                    padding: 8px 12px;
                    margin: 0;
                }
                .status {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    margin: 0;
                    padding: 6px 12px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .line {
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    margin: 0;
                    padding: 0;
                }
                .line.original {
                    color: var(--vscode-editor-foreground);
                }
                .line.translation {
                    color: #6A9955;
                    font-style: italic;
                    background: transparent;
                    border-left: none;
                    padding: 0;
                    margin: 0 0 6px 0;
                }
            </style>
        </head>
        <body>${status}<div class="content">${interleavedHtml}</div></body>
        </html>
    `;
}

function getOnlyTargetResultHtml(translatedText: string, translating: boolean): string {
    const translatedLinesHtml = translatedText
        .split(/\r?\n/)
        .map((line) => `<div class="line translation">${escapeHtml(line)}</div>`)
        .join('');
    const status = translating ? '<div class="status">Translating...</div>' : '';

    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Result</title>
            <style>
                body {
                    font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
                    font-size: var(--vscode-editor-font-size, 14px);
                    font-weight: var(--vscode-editor-font-weight, normal);
                    padding: 0;
                    margin: 0;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .status {
                    position: sticky;
                    top: 0;
                    z-index: 1;
                    margin: 0;
                    padding: 6px 12px;
                    font-size: 12px;
                    color: var(--vscode-descriptionForeground);
                    background: var(--vscode-editor-background);
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                .content {
                    line-height: 1.5;
                    tab-size: 4;
                    padding: 8px 12px;
                    margin: 0;
                }
                .line {
                    white-space: pre-wrap;
                    overflow-wrap: anywhere;
                    word-break: break-word;
                    margin: 0;
                    padding: 0;
                }
                .line.translation {
                    color: #6A9955;
                    font-style: italic;
                    background: transparent;
                    border-left: none;
                    padding: 0;
                    margin: 0 0 6px 0;
                }
            </style>
        </head>
        <body>${status}<div class="content">${translatedLinesHtml}</div></body>
        </html>
    `;
}

function buildInterleavedHtml(originalLines: string[], translatedLines: string[]): string {
    const maxLines = Math.max(originalLines.length, translatedLines.length);
    const rows: string[] = [];

    for (let i = 0; i < maxLines; i++) {
        const originalLine = escapeHtml(originalLines[i] ?? '');
        const translatedLine = escapeHtml(translatedLines[i] ?? '');

        rows.push(`<div class="line original">${originalLine}</div>`);
        rows.push(`<div class="line translation">${translatedLine}</div>`);
    }

    return rows.join('');
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getErrorHtml(errorMessage: string): string {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Translation Error</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                .error-box {
                    background: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    padding: 16px;
                    border-radius: 6px;
                }
                .error-title {
                    color: #F44747;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
            </style>
        </head>
        <body>
            <div class="error-box">
                <div class="error-title">⚠️ Translation Failed</div>
                <div>${errorMessage}</div>
            </div>
        </body>
        </html>
    `;
}

export function deactivate() {
    translateSlidePanel?.dispose();
    immersiveDecorationType?.dispose();
    immersiveDecorations = [];
}
