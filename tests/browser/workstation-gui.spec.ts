
import {expect,test} from '@playwright/test';

test('usable performance view keeps deck, mixer, SYNC and AutoMix real controls',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('tab',{name:'Performance'})).toHaveAttribute('aria-selected','true');
 for(const id of ['deck-a-load','deck-b-load','deck-a-play','deck-b-play','sync-a-to-b','mixer-crossfader','automix-plan']){
  await expect(page.locator('#'+id)).toBeVisible();
 }
 await page.evaluate(()=>window.__libertasSyncTest.loadClickPair(30,120,120));
 await page.locator('#deck-a-play').click();
 await page.locator('#deck-b-play').click();
 await page.locator('#sync-a-to-b').click();
 await expect.poll(()=>page.evaluate(async()=>(await window.__libertasSyncTest.status()).enabled)).toBe(true);
 await page.locator('#session-readout button').click();
 await expect(page.locator('#session-readout')).toContainText('SYNC');
 await page.screenshot({path:'test-results/workstation-performance.png'});
});

test('Advanced preserves actual module catalog, suites and functioning diagnostic export',async({page})=>{
 await page.goto('/');
 await page.getByRole('tab',{name:'Advanced'}).click();
 await expect(page.locator('#advanced-view')).toBeVisible();
 await expect(page.locator('#performance-view')).toBeHidden();
 await expect(page.locator('#advanced-modules .module-row')).toHaveCount(20);
 await expect(page.locator('#advanced-suites li')).toHaveCount(20);
 await expect(page.locator('#advanced-suites')).toContainText('automix-transition.spec.ts');
 await page.locator('#advanced-capture').click();
 await expect(page.locator('#advanced-output')).toContainText('libertas.gui-snapshot.v1');
 await page.screenshot({path:'test-results/workstation-advanced.png'});
 const downloading=page.waitForEvent('download');
 await page.locator('#advanced-export').click();
 expect((await downloading).suggestedFilename()).toBe('libertas0-diagnostics.json');
 await page.getByRole('tab',{name:'Performance'}).click();
 await expect(page.locator('#automix-arm')).toBeVisible();
});

test('query-link to Advanced and keyboard return work',async({page})=>{
 await page.goto('/?view=advanced');
 await expect(page.getByRole('tab',{name:'Advanced'})).toHaveAttribute('aria-selected','true');
 await page.getByRole('tab',{name:'Advanced'}).focus();
 await page.keyboard.press('ArrowLeft');
 await expect(page.locator('#performance-view')).toBeVisible();
 await expect(page.getByRole('tab',{name:'Performance'})).toBeFocused();
});
