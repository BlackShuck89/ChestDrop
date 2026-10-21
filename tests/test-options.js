/* Mock options page integration: save, export, import, validation, token omission. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');

function el(id) {
  return {
    id, value: '', checked: false, disabled: false, textContent: '', files: null,
    listeners: {}, classList: { toggle() {} },
    setAttribute() {}, addEventListener(name, fn) { this.listeners[name] = fn; },
    click() { if (this.listeners.click) return this.listeners.click(); },
    remove() {}
  };
}
async function main() {
  const ids = ['api-token','api-username','privacy','rating','use-filename','screenshot-fallback',
    'save-status','backup-status','toggle-token','test-token','settings-form',
    'export-settings','import-settings','import-file','backup-include-token'];
  const elements = Object.fromEntries(ids.map(id => [id, el(id)]));
  const radios = Object.fromEntries(['foreground','background','none'].map(v => [v, Object.assign(el('radio-'+v), {value:v})]));
  const body = { appendChild() {} };
  const document = {
    getElementById: id => elements[id] || null,
    querySelector: selector => {
      if (selector.includes(':checked')) return Object.values(radios).find(r => r.checked) || null;
      const match = selector.match(/value="([^"]+)"/);
      return match ? radios[match[1]] : null;
    },
    createElement: tag => tag === 'a' ? el('export-link') : el('new'),
    body
  };
  const store = { apiToken:'my-previous-key', apiUsername:'Earlier', privacy:'hidden', nsfw:false,
    openBehavior:'foreground', useFilenameAsTitle:false, screenshotFallback:true,
    lastUpload:{url:'https://imgchest.com/p/12345678'} };
  const browser = {storage:{local:{
    get: async () => ({...store}), set: async patch => Object.assign(store,patch)
  }}, runtime:{sendMessage: async () => ({message:'simulated'})}};
  const captured = {blob:null,downloads:0};
  const URLMock = {createObjectURL(blob){ captured.blob=blob;return 'blob:test'; },revokeObjectURL() {}};
  const ctx = vm.createContext({document,browser,URL:URLMock,Blob,console,setTimeout:()=>42,Date});
  vm.runInContext(fs.readFileSync(path.join(root,'shared.js'),'utf8'),ctx);
  vm.runInContext(fs.readFileSync(path.join(root,'options.js'),'utf8'),ctx);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(elements['api-token'].value, 'my-previous-key');
  assert.equal(elements['api-username'].value, 'Earlier');
  assert.equal(radios.foreground.checked,true);
  // Export the persisted state, including token.
  elements['backup-include-token'].checked=true;
  await elements['export-settings'].click();
  const backup=JSON.parse(await captured.blob.text());
  assert.equal(backup.settings.apiToken,'my-previous-key');
  assert.equal(Object.hasOwn(backup.settings,'lastUpload'), false);
  // Import restores all settings in storage and updates the form.
  store.apiToken='new-install-empty';
  store.privacy='secret';
  store.nsfw=false;
  elements['import-file'].files=[{size:2048,text:async()=>JSON.stringify(backup)}];
  await elements['import-file'].listeners.change({target:elements['import-file']});
  assert.equal(store.apiToken,'my-previous-key');
  assert.equal(store.privacy,'hidden');
  assert.equal(elements['api-token'].value,'my-previous-key');
  assert.equal(elements['rating'].value,'sfw');
  // Unchecked export excludes token; importing it must preserve current token.
  elements['backup-include-token'].checked=false;
  await elements['export-settings'].click();
  const publicBackup=JSON.parse(await captured.blob.text());
  assert.equal(Object.hasOwn(publicBackup.settings,'apiToken'),false);
  store.apiToken='retain-on-import';
  elements['import-file'].files=[{size:2048,text:async()=>JSON.stringify(publicBackup)}];
  await elements['import-file'].listeners.change({target:elements['import-file']});
  assert.equal(store.apiToken,'retain-on-import');
  // Malformed import must not update storage.
  const oldPrivacy=store.privacy;
  elements['import-file'].files=[{size:2048,text:async()=>JSON.stringify({format:'x'})}];
  await elements['import-file'].listeners.change({target:elements['import-file']});
  assert.equal(store.privacy,oldPrivacy);
  assert.match(elements['backup-status'].textContent,/Import failed/);
  // Verify ordinary settings save still persists updates.
  elements['api-token'].value='saved-now';
  elements['rating'].value='nsfw';
  radios.foreground.checked=false;
  radios.background.checked=true;
  await elements['settings-form'].listeners.submit({preventDefault(){}});
  assert.equal(store.apiToken,'saved-now');
  assert.equal(store.nsfw,true);
  assert.equal(store.openBehavior,'background');
  console.log('PASS: settings page load, export/import with token, tokenless import, invalid import, normal save');
}
main().catch(error=>{console.error(error);process.exitCode=1});
