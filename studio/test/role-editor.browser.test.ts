/** Real Loader and browser acceptance; provider catalog only, never a model turn. */
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { expect, it } from 'vitest'
import { launchWebScaffold } from '@studio-test/scaffold'

const studio = fileURLToPath(new URL('..', import.meta.url))
const fixture = fileURLToPath(new URL('./role-editor/session.v3.jsonl', import.meta.url))

it('edits only two roles, applies explicitly, and reloads the saved snapshot in Studio', async () => {
  const browser = await chromium.launch({
    ...(process.env.DSH_TEST_BROWSER_CHANNEL ? { channel: process.env.DSH_TEST_BROWSER_CHANNEL } : {}),
  })
  try {
    const scaffold = await launchWebScaffold({
      extraOverlayPath: `${studio}/packages/bundle/cordis.patch.yml`,
      extraInstallAnchors: ['bundle', 'shell', 'roles', 'demo'].map(name => `${studio}/packages/${name}/package.json`),
      replayFixture: fixture,
      replayProvidersOnly: true,
    })
    try {
      const page = await browser.newPage({ locale: 'en-US', viewport: { width: 1440, height: 1200 } })
      await page.goto(scaffold.authenticatedUrl)
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click()
      await page.getByRole('button', { name: 'Role settings', exact: true }).click()
      const editor = page.getByRole('region', { name: 'Role settings', exact: true })
      await editor.waitFor({ timeout: 30_000 })
      expect(await editor.getByRole('group').allTextContents()).toHaveLength(2)
      expect(await editor.getByRole('group', { name: 'Implementer', exact: true }).count()).toBe(1)
      expect(await editor.getByRole('group', { name: 'Reviewer', exact: true }).count()).toBe(1)
      expect(await editor.innerText()).toContain('Applies to new children only.')
      const status = editor.getByRole('status')
      await expect.poll(() => status.allTextContents()).toContain('Not configured. New role execution is blocked.')
      for (const role of ['Implementer', 'Reviewer']) {
        await editor.getByRole('textbox', { name: `${role} Instructions`, exact: true }).fill(`${role}: browser acceptance instructions`)
        await editor.getByRole('textbox', { name: `${role} Provider`, exact: true }).fill('deepseek-official')
        await editor.getByRole('textbox', { name: `${role} Model`, exact: true }).fill('deepseek-v4-flash-vision-exp')
        await editor.getByRole('textbox', { name: `${role} Reasoning effort (empty = provider default)`, exact: true }).fill('high')
      }
      expect(await status.allTextContents()).toContain('Unsaved changes — execution settings have not changed.')
      expect(await editor.locator('dd').allTextContents()).toEqual(['None', 'None', '0'])
      await editor.getByRole('button', { name: 'Reload saved settings', exact: true }).click()
      await expect.poll(() => editor.getByRole('textbox', { name: 'Implementer Instructions', exact: true }).inputValue()).toBe('')
      for (const role of ['Implementer', 'Reviewer']) {
        await editor.getByRole('textbox', { name: `${role} Instructions`, exact: true }).fill(`${role}: browser acceptance instructions`)
        await editor.getByRole('textbox', { name: `${role} Provider`, exact: true }).fill('deepseek-official')
        await editor.getByRole('textbox', { name: `${role} Model`, exact: true }).fill('deepseek-v4-flash-vision-exp')
        await editor.getByRole('textbox', { name: `${role} Reasoning effort (empty = provider default)`, exact: true }).fill('high')
      }
      await editor.getByRole('button', { name: 'Apply', exact: true }).click()
      await expect.poll(() => status.allTextContents(), { timeout: 15_000 }).toEqual(['Saved and applied.', 'No unsaved changes.'])
      const saved = await editor.locator('dd').allTextContents()
      expect(saved[0]).not.toBe('None')
      expect(saved[0]).toBe(saved[1])
      expect(saved[2]).toBe('1')
      await editor.getByRole('textbox', { name: 'Implementer Instructions', exact: true }).fill('Discard this unsaved draft')
      expect(await status.allTextContents()).toContain('Unsaved changes — execution settings have not changed.')
      expect(await editor.locator('dd').allTextContents()).toEqual(saved)
      await page.reload()
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).waitFor()
      await page.getByRole('button', { name: 'DSH Studio', exact: true }).click()
      await page.getByRole('button', { name: 'Role settings', exact: true }).click()
      await expect.poll(() => status.allTextContents(), { timeout: 15_000 }).toEqual(['Saved and applied.', 'No unsaved changes.'])
      for (const role of ['Implementer', 'Reviewer']) {
        expect(await editor.getByRole('textbox', { name: `${role} Instructions`, exact: true }).inputValue()).toBe(`${role}: browser acceptance instructions`)
        expect(await editor.getByRole('textbox', { name: `${role} Provider`, exact: true }).inputValue()).toBe('deepseek-official')
        expect(await editor.getByRole('textbox', { name: `${role} Model`, exact: true }).inputValue()).toBe('deepseek-v4-flash-vision-exp')
        expect(await editor.getByRole('textbox', { name: `${role} Reasoning effort (empty = provider default)`, exact: true }).inputValue()).toBe('high')
      }
      await Promise.all([
        page.waitForResponse(response => response.url().endsWith('/api/studioRoles/describe') && response.ok()),
        editor.getByRole('button', { name: 'Reload saved settings', exact: true }).click(),
      ])
      await expect.poll(() => editor.locator('dd').allTextContents()).toEqual(saved)
      await page.route('**/api/studioRoles/describe', route => route.fulfill({ status: 503, body: 'Test transport unavailable' }), { times: 1 })
      await editor.getByRole('button', { name: 'Reload saved settings', exact: true }).click()
      await page.getByRole('alert').filter({ hasText: 'Settings could not be read.' }).waitFor()
      expect(await editor.getByRole('button', { name: 'Apply', exact: true }).isEnabled()).toBe(false)
      const retry = page.getByRole('button', { name: 'Reload saved settings', exact: true }).filter({ visible: true }).first()
      expect(await retry.isEnabled()).toBe(true)
      await retry.click()
      await expect.poll(() => page.getByRole('alert').filter({ hasText: 'Settings could not be read.' }).count()).toBe(0)
      await expect.poll(() => editor.locator('dd').allTextContents()).toEqual(saved)
      expect(await editor.getByRole('button', { name: 'Apply', exact: true }).isEnabled()).toBe(true)
      for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' })
        // Keep the host sidebar visible while testing a narrow Studio content column.
        await page.setViewportSize({ width: 720, height: 844 })
        const appearance = await editor.evaluate(element => {
          const surface = element.closest('.studio-ui')!
          const style = getComputedStyle(surface)
          return {
            ink: style.getPropertyValue('--studio-ink').trim(),
            hostInk: style.getPropertyValue('--dsw-alias-label-primary').trim(),
            width: element.clientWidth,
            scroll: element.scrollWidth,
          }
        })
        expect(appearance.ink).not.toBe('')
        expect(appearance.ink).toBe(appearance.hostInk)
        expect(appearance.scroll).toBeLessThanOrEqual(appearance.width + 1)
        const apply = editor.getByRole('button', { name: 'Apply', exact: true })
        await editor.getByRole('textbox', { name: 'Reviewer Reasoning effort (empty = provider default)', exact: true }).focus()
        await page.keyboard.press('Tab')
        expect(await apply.evaluate(element => element === document.activeElement)).toBe(true)
        expect(await apply.evaluate(element => getComputedStyle(element).outlineStyle)).toBe('solid')
      }
      if (process.env.DSH_TEST_SCREENSHOT) await page.screenshot({ path: process.env.DSH_TEST_SCREENSHOT, fullPage: true })
    } finally {
      await scaffold.close()
    }
  } finally {
    await browser.close()
  }
})
