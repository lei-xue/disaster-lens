const playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const name = process.env.BROWSER || 'chromium';
if (!['chromium', 'firefox', 'webkit'].includes(name)) throw new Error(`Unsupported BROWSER: ${name}`);
module.exports = { browserType: playwright[name], browserName: name };
