import axios from 'axios';
import { TranslateConfig } from './config';

export interface TranslationResult {
    text: string;
    source: string;
    target: string;
    provider: string;
}

export interface TranslationService {
    translate(text: string, config: TranslateConfig): Promise<TranslationResult>;
}

// Free Google Translate using web API (no API key required)
export class GoogleFreeTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = 'https://translate.googleapis.com/translate_a/single';
        const params = {
            client: 'gtx',
            sl: config.sourceLanguage,
            tl: config.targetLanguage,
            dt: 't',
            q: text
        };

        try {
            const response = await axios.get(url, { params });
            // Google Free API returns a complex array structure: [[["translated", "source", ...], ...]]
            const translatedText = response.data[0].map((item: unknown) => (item as unknown[])[0]).join('');
            const detectedSource = response.data[2] || config.sourceLanguage;

            return {
                text: translatedText,
                source: detectedSource,
                target: config.targetLanguage,
                provider: 'google-free'
            };
        } catch (error) {
            throw new Error(`Google Free Translation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}

// Free Bing Translate using web API (no API key required)
export class BingFreeTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        // Use Lingva Translate as a more reliable alternative for Bing-style translations
        const url = `https://lingva.ml/api/v1/${config.sourceLanguage}/${config.targetLanguage}/${encodeURIComponent(text)}`;

        try {
            const response = await axios.get(url);
            const translatedText = response.data.translation;

            return {
                text: translatedText,
                source: config.sourceLanguage,
                target: config.targetLanguage,
                provider: 'bing-free'
            };
        } catch {
            // Fallback to MyMemory API (free, no key required)
            try {
                const fallbackUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${config.sourceLanguage}|${config.targetLanguage}`;
                const response = await axios.get(fallbackUrl);
                const translatedText = response.data.responseData.translatedText;

                return {
                    text: translatedText,
                    source: config.sourceLanguage,
                    target: config.targetLanguage,
                    provider: 'bing-free'
                };
            } catch (error) {
                throw new Error(`Free Translation failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
    }
}

// Paid Google Cloud Translation API
export class GoogleTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = 'https://translation.googleapis.com/language/translate/v2';
        
        const params: Record<string, string> = {
            q: text,
            target: config.targetLanguage,
            format: 'text'
        };
        
        if (config.sourceLanguage !== 'auto') {
            params.source = config.sourceLanguage;
        }
        
        if (config.apiKey) {
            params.key = config.apiKey;
        }

        try {
            const response = await axios.post(url, null, { params });
            
            const translatedText = response.data.data.translations[0].translatedText;
            const detectedSourceLanguage = response.data.data.translations[0].detectedSourceLanguage || config.sourceLanguage;
            
            return {
                text: translatedText,
                source: detectedSourceLanguage,
                target: config.targetLanguage,
                provider: 'google'
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Google Translation failed: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

// Paid Microsoft Azure Translator API
export class BingTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = 'https://api.cognitive.microsofttranslator.com/translate';
        
        const params = {
            'api-version': '3.0',
            to: config.targetLanguage
        };
        
        if (config.sourceLanguage !== 'auto') {
            (params as Record<string, string>).from = config.sourceLanguage;
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Ocp-Apim-Subscription-Key': config.apiKey,
            'Ocp-Apim-Subscription-Region': 'global'
        };

        try {
            const response = await axios.post(url, [{ text }], { params, headers });
            
            const translatedText = response.data[0].translations[0].text;
            const detectedSourceLanguage = response.data[0].detectedLanguage?.language || config.sourceLanguage;
            
            return {
                text: translatedText,
                source: detectedSourceLanguage,
                target: config.targetLanguage,
                provider: 'bing'
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Bing Translation failed: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

// OpenAI GPT API
export class OpenAITranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = 'https://api.openai.com/v1/chat/completions';
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        const sourceLang = config.sourceLanguage === 'auto' ? 'auto-detected' : config.sourceLanguage;
        
        const messages = [
            {
                role: 'system',
                content: `You are a professional translator. Translate the given text from ${sourceLang} to ${config.targetLanguage}. Only output the translated text, nothing else.`
            },
            {
                role: 'user',
                content: text
            }
        ];

        try {
            const response = await axios.post(url, {
                model: 'gpt-3.5-turbo',
                messages,
                temperature: 0.3
            }, { headers });
            
            const translatedText = response.data.choices[0].message.content.trim();
            
            return {
                text: translatedText,
                source: config.sourceLanguage,
                target: config.targetLanguage,
                provider: 'openai'
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`OpenAI Translation failed: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

// Google Gemini API
export class GeminiTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${config.apiKey}`;
        
        const sourceLang = config.sourceLanguage === 'auto' ? 'auto-detected' : config.sourceLanguage;
        
        const requestBody = {
            contents: [{
                parts: [{
                    text: `You are a professional translator. Translate the following text from ${sourceLang} to ${config.targetLanguage}. Only output the translated text, nothing else.\n\nText to translate:\n${text}`
                }]
            }],
            generationConfig: {
                temperature: 0.3,
                topP: 0.8,
                topK: 40
            }
        };

        try {
            const response = await axios.post(url, requestBody, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const translatedText = response.data.candidates[0].content.parts[0].text.trim();
            
            return {
                text: translatedText,
                source: config.sourceLanguage,
                target: config.targetLanguage,
                provider: 'gemini'
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Gemini Translation failed: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

// DeepSeek API
export class DeepSeekTranslateService implements TranslationService {
    async translate(text: string, config: TranslateConfig): Promise<TranslationResult> {
        const url = 'https://api.deepseek.com/v1/chat/completions';
        
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
        };

        const sourceLang = config.sourceLanguage === 'auto' ? 'auto-detected' : config.sourceLanguage;
        
        const messages = [
            {
                role: 'system',
                content: `You are a professional translator. Translate the given text from ${sourceLang} to ${config.targetLanguage}. Only output the translated text, nothing else.`
            },
            {
                role: 'user',
                content: text
            }
        ];

        try {
            const response = await axios.post(url, {
                model: 'deepseek-chat',
                messages,
                temperature: 0.3
            }, { headers });
            
            const translatedText = response.data.choices[0].message.content.trim();
            
            return {
                text: translatedText,
                source: config.sourceLanguage,
                target: config.targetLanguage,
                provider: 'deepseek'
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`DeepSeek Translation failed: ${error.response?.data?.error?.message || error.message}`);
            }
            throw error;
        }
    }
}

export function createTranslationService(provider: string): TranslationService {
    switch (provider) {
        case 'google-free':
            return new GoogleFreeTranslateService();
        case 'bing-free':
            return new BingFreeTranslateService();
        case 'google':
            return new GoogleTranslateService();
        case 'bing':
            return new BingTranslateService();
        case 'openai':
            return new OpenAITranslateService();
        case 'gemini':
            return new GeminiTranslateService();
        case 'deepseek':
            return new DeepSeekTranslateService();
        default:
            throw new Error(`Unknown translation provider: ${provider}`);
    }
}