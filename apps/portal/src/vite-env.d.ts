/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    readonly VITE_PLANNER_URL: string;
    readonly VITE_PLANNER_APP_URL: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
