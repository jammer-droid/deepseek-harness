/** Verify the exact isolated Web URL, never a shell-only replacement server. */
import { createRequire } from 'node:module';
import { join } from 'node:path';
export async function verifyBrowser(url, home) {
  const require = createRequire(join(process.env.STUDIO_WORKFLOW_BROWSER_TOOLS, 'package.json'));
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url);
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    console.log('ONBOARDING', await page.locator('body').innerText());
    await page.screenshot({ path: join(home, 'onboarding.png'), fullPage: true });
    console.log('DIALOGS', await page.getByRole('dialog').allTextContents());
    console.log('ALL_BUTTONS', await page.locator('button').evaluateAll(buttons => buttons.map(button => ({ text: button.textContent, label: button.getAttribute('aria-label') }))));
    await page.screenshot({ path: join(home, 'dialog.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'DSH Studio', exact: true }).click();
    await page.getByRole('button', { name: '적용 상태 다시 조회', exact: true }).waitFor();
    await page.screenshot({ path: join(home, 'web-initial.png'), fullPage: true });
    await page.getByRole('button', { name: '적용 상태 다시 조회', exact: true }).click();
    await page.getByText('실제 요청 모델·추론 수준이 요청값과 다릅니다.', { exact: false }).waitFor();
    for (const colorScheme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme });
      for (const width of [1280, 600]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.getByRole('button', { name: '저장된 버전 적용', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: join(home, `workflow-${colorScheme}-${width}.png`), fullPage: true });
      }
    }
    await page.getByRole('button', { name: '저장된 버전 적용', exact: true }).click();
    await page.getByRole('dialog').filter({ hasText: '워크플로 프리셋 적용' }).waitFor();
    await page.screenshot({ path: join(home, 'apply-confirmation.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('button', { name: '취소', exact: true }).last().click();
    console.log('WEB_BODY', await page.locator('body').innerText());
    console.log('WEB_BUTTONS', await page.locator('button').evaluateAll(buttons => buttons.map(button => ({ text: button.textContent, title: button.title, label: button.getAttribute('aria-label') }))));
  } finally { await browser.close(); }
}
