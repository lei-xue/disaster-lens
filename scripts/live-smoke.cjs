// Run after npm run build with a static preview server. Playwright stays outside the app dependencies.
// Example: PLAYWRIGHT_MODULE=/path/to/playwright node scripts/live-smoke.cjs
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const expectedVersion=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8')).version;
const base=process.env.BASE_URL||'http://127.0.0.1:8792/';
const out=process.env.SCREENSHOT_DIR||path.join(process.cwd(),'docs/screenshots');
(async()=>{
 fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'networkidle',timeout:60000});
  await page.getByLabel('Loaded data scope').waitFor({timeout:60000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.match(await page.getByLabel('Website build information').innerText(),new RegExp(`Version ${expectedVersion.replace(/\./g,'\\.')}`));
  const scope=await page.getByLabel('Loaded data scope').innerText();
  await page.screenshot({path:path.join(out,`dashboard-${width}.png`),fullPage:true});
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Explore'}).click();
  await page.locator('tbody tr').first().waitFor();
  assert.equal(await page.locator('tbody tr').count(),25);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  assert.match(await page.getByText('Showing ',{exact:false}).innerText(),/26–50/);
  await page.getByRole('button',{name:'Title',exact:false}).click();
  assert.match(await page.getByText('Showing ',{exact:false}).innerText(),/1–25/);
  await page.locator('#table-search').fill('zz-no-match-zz');await page.getByText('No records match',{exact:false}).waitFor();
  await page.goto(base+'#/about');await page.getByRole('heading',{name:'About DisasterLens'}).waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'#/preparedness');await page.locator('h1').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.goto(base+'#/disaster/4945');await page.locator('article').waitFor({timeout:45000});
  const areas=await page.locator('article li').allTextContents();assert.equal(areas.length,7);
  await page.screenshot({path:path.join(out,`detail-${width}.png`),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,source:'LIVE OpenFEMA; no request interception',scope,areas,errors}));await page.close();
 }
 const meta=fs.readFileSync('dist/index.html','utf8');assert.match(meta,/og:description/);assert.match(meta,/twitter:description/);assert.match(meta,/National Weather Service alerts/);assert.match(meta,/not a guaranteed real-time warning service/);
 console.log('PASS live dashboard/explore sorting/pagination/empty/about/preparedness/detail, version, raw HTML metadata and screenshots at 320/390/1440. Live sample may change as FEMA updates.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
