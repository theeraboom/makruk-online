const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
function translations(lang) {
 const context=vm.createContext({localStorage:{getItem:()=>lang},document:{addEventListener:()=>{}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/i18n.js'),'utf8'),context);
 return context.I18N;
}
test('English intentionally empty suffixes do not fall back to Thai',()=>{
 const i18n=translations('en');
 assert.equal(i18n.t('footer.times'),'');
 assert.equal(i18n.t('footer.people'),'');
 assert.equal(i18n.t('game.chess'),'Thai Chess');
});
test('invalid saved languages fall back to Thai',()=>{
 const i18n=translations('invalid');
 assert.equal(i18n.getLang(),'th');
 assert.equal(i18n.t('game.chess'),'หมากรุกไทย');
});
