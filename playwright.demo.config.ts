import {defineConfig,devices} from '@playwright/test'
export default defineConfig({
 testDir:'./tests/demo-ui',fullyParallel:false,workers:1,timeout:180_000,
 expect:{timeout:20_000},outputDir:'.local/demo-ui-results',reporter:'list',
 use:{...devices['Desktop Chrome'],viewport:{width:1440,height:1000},baseURL:'http://127.0.0.1:4174',channel:'chrome',trace:'retain-on-failure'},
 webServer:{command:'npm run demo:build && npm run preview -- --port 4174 --strictPort',port:4174,reuseExistingServer:false,timeout:60_000},
})
