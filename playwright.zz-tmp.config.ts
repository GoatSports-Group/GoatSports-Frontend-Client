import base from './playwright.config';
import { defineConfig } from '@playwright/test';

// Tạm: chạy e2e trên cổng 4210 vì 4200 là dev server của người dùng. Xóa sau khi chạy.
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: 'http://127.0.0.1:4210' },
  webServer: { ...base.webServer, command: 'npm run start -- --host 127.0.0.1 --port 4210', url: 'http://127.0.0.1:4210', reuseExistingServer: false, timeout: 240_000 }
});
