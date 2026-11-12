import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const path = '/docs/build/community/roadmap.html';
const empty = { schemaVersion:1, scope:'theme-features', inWorks:[], delivered:[] };
const populated = {
  schemaVersion:1, scope:'theme-features',
  inWorks:[
    { category:'Colour', title:'Keep your chosen palette when opening device details', summary:'Move between the dashboard and device details with a consistent colour scheme.', issueNumber:999, username:'PRIVATE_AUTHOR', commit:'PRIVATE_COMMIT', technicalNotes:'PRIVATE_NOTES' },
    { category:'Layouts', title:'Make room names easier to read', summary:'Recognise rooms without losing the end of a long name.' },
  ],
  delivered:[
    { year:2026, months:[
      { month:'2026-11', label:'November', items:[
        { category:'Colour', title:'Choose Vivid or Muted colours', summary:'Choose the colour strength that suits your display.' },
        { category:'Layouts', title:'Read controls on a small screen', summary:'Use the main controls without scrolling the whole page sideways.' },
      ] },
      { month:'2026-10', label:'October', items:[{ category:'Theme settings', title:'Change the theme in one place', summary:'Find related appearance choices together.' }] },
    ] },
    { year:2025, months:[{ month:'2025-12', label:'December', items:[{ category:'Keyboard access', title:'Follow a clear keyboard focus', summary:'See which link or control will respond before you activate it.' }] }] },
  ],
};

// Render the production partial itself, including its nested card/art partials.
// Only the data is synthetic. No fixture page or fake roadmap record is shipped.
const rubyRenderer = String.raw`
require 'erb'
require 'json'
require 'cgi'
class RoadmapFixture
  def escape(value)
    CGI.escapeHTML(value.to_s)
  end
  def partial(name, locals: {})
    file = File.join('docs/source', File.dirname(name), '_' + File.basename(name) + '.erb')
    context = binding
    locals.each { |key, value| context.local_variable_set(key.to_sym, value) }
    ERB.new(File.read(file)).result(context)
  end
end
print RoadmapFixture.new.partial('partials/roadmap', locals: {roadmap: JSON.parse(STDIN.read)})
`;

function render(data) {
  return execFileSync('ruby', ['-e', rubyRenderer], { input:JSON.stringify(data), encoding:'utf8' });
}

async function fixture(page, data) {
  const builtPage = readFileSync('docs/build/community/roadmap.html', 'utf8');
  const sheet = [...builtPage.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)]
    .map(match => match[1]).find(href => /\/screen[^/]*\.css$/.test(href));
  expect(sheet, 'Use the built production stylesheet, including the roadmap partial').toBeTruthy();
  const stylesheet = new URL(sheet, `http://127.0.0.1:4173${path}`).href;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Theme roadmap test fixture</title><link rel="stylesheet" href="${stylesheet}"></head><body><main class="technical-documentation govuk-width-container" style="padding-top:30px;padding-bottom:30px"><h1>Theme roadmap</h1><p class="govuk-body">Synthetic records for this test only.</p>${render(data)}</main></body></html>`;
  await page.route('**/__roadmap-fixture__/', route => route.fulfill({ contentType:'text/html', body:html }));
  await page.goto('/__roadmap-fixture__/');
}

const noOverflow = async page => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
const allItems = data => [...data.inWorks, ...data.delivered.flatMap(year => year.months.flatMap(month => month.items))];

test('the public roadmap shows exactly the reviewed theme fields and two section illustrations', async ({ page }) => {
  const data = JSON.parse(readFileSync('docs/data/roadmap.json', 'utf8'));
  expect(data.scope).toBe('theme-features');
  await page.goto(path);
  await expect(page.locator('main h1')).toHaveText('Theme roadmap');
  await expect(page.locator('[data-roadmap-feature]')).toHaveCount(allItems(data).length);
  expect(await page.locator('[data-roadmap-feature]').evaluateAll(nodes => nodes.map(node => [...node.children].map(child => child.textContent.trim()))))
    .toEqual(allItems(data).map(item => [item.category, item.title, item.summary]));
  await expect(page.locator('[data-roadmap-art]')).toHaveCount(2);
  for (const illustration of await page.locator('[data-roadmap-art]').all()) {
    await expect(illustration).toHaveAttribute('aria-hidden', 'true');
    await expect(illustration).toHaveAttribute('focusable', 'false');
    const box = await illustration.boundingBox();
    expect(box.width / box.height).toBeCloseTo(4 / 3, 2);
  }
  await expect(page.getByRole('navigation', {name:'Main navigation'}).getByRole('link', {name:'Community',exact:true})).toHaveAttribute('aria-current','true');
});

test('populated roadmap groups years and months in one reading column with three-part feature cards', async ({ page }, testInfo) => {
  await page.setViewportSize({width:1280,height:900});
  await fixture(page, populated);
  expect(await page.locator('[data-roadmap-year]').evaluateAll(nodes => nodes.map(node => node.dataset.roadmapYear))).toEqual(['2026','2025']);
  expect(await page.locator('[data-roadmap-month] time').evaluateAll(nodes => nodes.map(node => [node.dateTime,node.textContent]))).toEqual([['2026-11','November'],['2026-10','October'],['2025-12','December']]);
  const cards = page.locator('[data-roadmap-feature]');
  await expect(cards).toHaveCount(6);
  expect(await cards.evaluateAll(nodes => nodes.map(node => [...node.children].map(child => child.tagName)))).toEqual([
    ['SPAN','H3','P'],['SPAN','H3','P'],['SPAN','H5','P'],['SPAN','H5','P'],['SPAN','H5','P'],['SPAN','H5','P'],
  ]);
  await expect(page.locator('[data-roadmap]')).not.toContainText(/PRIVATE_AUTHOR|PRIVATE_COMMIT|PRIVATE_NOTES|999/);
  await expect(cards.locator('a,button,input,time')).toHaveCount(0);
  const boxes = await cards.evaluateAll(nodes => nodes.map(node => {const b=node.getBoundingClientRect();return {x:b.x,y:b.y,bottom:b.bottom};}));
  for (let index=1;index<boxes.length;index++) expect(boxes[index].y).toBeGreaterThanOrEqual(boxes[index-1].bottom);
  const pending = await page.locator('[data-roadmap-section="in-works"]').boundingBox();
  const delivered = await page.locator('[data-roadmap-section="delivered"]').boundingBox();
  expect(delivered.y).toBeGreaterThan(pending.y + pending.height);
  for (const [name,width] of [['desktop',1280],['320px',320]]) {
    await page.setViewportSize({width,height:900});
    await noOverflow(page);
    const screenshot = testInfo.outputPath(`roadmap-populated-${name}.png`);
    await page.screenshot({path:screenshot,fullPage:true});
    await testInfo.attach(`Populated roadmap at ${name}`,{path:screenshot,contentType:'image/png'});
  }
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations.map(({id,nodes}) => ({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
});

test('the production roadmap remains readable and navigable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:900}});
  try {
    const page = await context.newPage();
    const data = JSON.parse(readFileSync('docs/data/roadmap.json','utf8'));
    await page.goto(`http://127.0.0.1:4173${path}`);
    await expect(page.locator('main h1')).toHaveText('Theme roadmap');
    await expect(page.locator('[data-roadmap-section]')).toHaveCount(2);
    await expect(page.locator('[data-roadmap-feature]')).toHaveCount(allItems(data).length);
    await expect(page.locator('[data-roadmap-art]')).toHaveCount(2);
    const sections = page.getByRole('navigation',{name:'Roadmap sections'});
    await sections.getByRole('link',{name:'In the works',exact:true}).focus();
    await page.keyboard.press('Tab');
    await expect(sections.getByRole('link',{name:'Delivered',exact:true})).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#roadmap-delivered')).toBeFocused();
    await expect(page.locator('#roadmap-delivered')).toBeInViewport();
    await noOverflow(page);
  } finally {
    await context.close();
  }
});

test('empty data keeps honest section-specific messages without fabricated feature cards or dates', async ({ page }) => {
  await fixture(page, empty);
  await expect(page.locator('[data-roadmap-feature]')).toHaveCount(0);
  await expect(page.locator('[data-roadmap-year],[data-roadmap-month]')).toHaveCount(0);
  await expect(page.locator('[data-roadmap-section="in-works"]')).toContainText('There are no reviewed theme features in the works to show yet.');
  await expect(page.locator('[data-roadmap-section="delivered"]')).toContainText('No reviewed theme features have been added to this timeline yet.');
  await expect(page.locator('[data-roadmap-art]')).toHaveCount(2);
  const result = await new AxeBuilder({page}).analyze();
  expect(result.violations.map(({id,nodes}) => ({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
});

test('long roadmap copy wraps at 320px and enlarged text while artwork and keyboard section links remain usable', async ({ page }) => {
  const data = structuredClone(populated);
  data.inWorks[0].category = 'Theme appearance for shared household displays';
  data.inWorks[0].title = 'Keep a consistent appearance when moving between a room with a very long name and its available device controls';
  data.delivered[0].months[0].items[0].title = 'A theme label can include an exceptionallylongunbrokensuppliednamewithoutlosingitsending';
  await page.setViewportSize({width:320,height:900});
  await fixture(page, data);
  await noOverflow(page);
  const firstLink = page.getByRole('navigation',{name:'Roadmap sections'}).getByRole('link',{name:'In the works',exact:true});
  await firstLink.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link',{name:'Delivered',exact:true})).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#roadmap-delivered')).toBeFocused();
  await page.locator('[data-roadmap]').evaluate(root => {
    const sizes=[...root.querySelectorAll('h2,h3,h4,h5,p,.c-roadmap__category,a')].map(node=>[node,parseFloat(getComputedStyle(node).fontSize)]);
    for(const [node,size] of sizes) node.style.fontSize=`${size*2}px`;
  });
  await noOverflow(page);
  for (const card of await page.locator('[data-roadmap-feature]').all()) {
    expect(await card.evaluate(node=>node.scrollWidth<=node.clientWidth+1&&node.scrollHeight<=node.clientHeight+1)).toBe(true);
  }
  const result=await new AxeBuilder({page}).analyze();
  expect(result.violations.map(({id,nodes})=>({id,targets:nodes.map(node=>node.target)}))).toEqual([]);
});

test('roadmap fields remain literal text rather than active markup', async ({ page }) => {
  const data=structuredClone(empty);
  data.inWorks.push({category:'Colour <choices>',title:'Use <strong> tags as supplied text',summary:'A name such as <img src="/unexpected-image" onerror="window.roadmapInjected=true"> is text.'});
  await fixture(page,data);
  await expect(page.locator('[data-roadmap-feature] strong,[data-roadmap-feature] img')).toHaveCount(0);
  await expect(page.locator('[data-roadmap-feature]')).toContainText(data.inWorks[0].summary);
  expect(await page.evaluate(()=>window.roadmapInjected)).toBeUndefined();
});
