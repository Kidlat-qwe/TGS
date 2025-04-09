
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading from different locations
console.log('Current directory:', __dirname);

// Try root directory
dotenv.config({ path: path.join(__dirname, '..', '..', '..', '.env') });
console.log('After loading from root directory:');
console.log('SMTP_HOST:', process.env.SMTP_HOST);
console.log('SMTP_USER:', process.env.SMTP_USER);

// This is just for debugging
export function debugEnvironment() {
  return {
    SMTP_HOST: process.env.SMTP_HOST,
    SMTP_PORT: process.env.SMTP_PORT,
    SMTP_USER: process.env.SMTP_USER,
    SMTP_PASS: process.env.SMTP_PASS ? 'set' : 'not set'
  };
}
