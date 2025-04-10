/// <reference types="vite/client" />

// Add custom allowed hosts
interface ImportMetaEnv {
  readonly VITE_ALLOWED_HOSTS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
} 