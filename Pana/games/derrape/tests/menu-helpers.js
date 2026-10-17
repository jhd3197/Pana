// Drive the same visible step buttons that players use; never force hidden controls.
export async function menuStep(page, step) {
  await page.locator('.menu-flow').waitFor();
  if (await page.locator('#garage').getAttribute('data-menu-step') !== step) {
    await page.locator(`[data-step="${step}"]`).click();
  }
}

export async function menuClick(page, selector) {
  const step = /data-mode|#mode-pick|#t-next|#t-prev/.test(selector) ? 'track'
    : /#open-shop/.test(selector) ? 'car' : 'ready';
  await menuStep(page, step);
  await page.locator(selector).click();
}
