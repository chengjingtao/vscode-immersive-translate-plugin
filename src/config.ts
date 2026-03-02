import * as vscode from 'vscode';

export interface TranslateConfig {
    apiProvider: 'google-free' | 'bing-free' | 'google' | 'bing' | 'openai' | 'gemini' | 'deepseek';
    apiKey: string;
    sourceLanguage: string;
    targetLanguage: string;
}

export function getConfig(): TranslateConfig {
    const config = vscode.workspace.getConfiguration('vscode-immersive-translate-plugin');
    
    return {
        apiProvider: config.get<'google-free' | 'bing-free' | 'google' | 'bing' | 'openai' | 'gemini' | 'deepseek'>('apiProvider', 'google-free'),
        apiKey: config.get<string>('apiKey', ''),
        sourceLanguage: config.get<string>('sourceLanguage', 'en'),
        targetLanguage: config.get<string>('targetLanguage', 'zh-CN')
    };
}

export function validateConfig(config: TranslateConfig): { valid: boolean; message?: string } {
    if (config.apiProvider === 'openai' || config.apiProvider === 'gemini' || config.apiProvider === 'deepseek') {
        if (!config.apiKey) {
            return { 
                valid: false, 
                message: `API Key is required for ${config.apiProvider}. Please configure it in settings.` 
            };
        }
    }
    
    if (!config.sourceLanguage || !config.targetLanguage) {
        return { 
            valid: false, 
            message: 'Source and target languages must be configured.' 
        };
    }
    
    return { valid: true };
}
