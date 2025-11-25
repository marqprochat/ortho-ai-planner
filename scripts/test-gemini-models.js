import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try to read .env.local manually since we might not have dotenv
const envPath = path.resolve(__dirname, '../.env.local');
let apiKey = '';

try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    if (match) {
        apiKey = match[1].trim();
    }
} catch (e) {
    console.log("Could not read .env.local, trying .env");
    try {
        const envPath2 = path.resolve(__dirname, '../.env');
        const envContent = fs.readFileSync(envPath2, 'utf8');
        const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
        if (match) {
            apiKey = match[1].trim();
        }
    } catch (e2) {
        console.error("Could not find API key in .env files");
    }
}

if (!apiKey) {
    console.error("API Key not found. Please set VITE_GEMINI_API_KEY in .env.local");
    process.exit(1);
}

async function listModels() {
    try {
        console.log("Fetching available models via REST API...");
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`API Error: ${response.status} ${response.statusText}`);
            console.error(errorText);
            return;
        }

        const data = await response.json();
        if (data.models) {
            console.log("Available Models:");
            data.models.forEach(m => {
                console.log(`- ${m.name} (${m.displayName})`);
                console.log(`  Supported methods: ${m.supportedGenerationMethods?.join(', ')}`);
            });
        } else {
            console.log("No models found in response.");
            console.log(JSON.stringify(data, null, 2));
        }

    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
