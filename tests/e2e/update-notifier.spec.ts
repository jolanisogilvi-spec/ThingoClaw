import { expect, test, completeSetup } from './fixtures/electron';

test.describe('update channel', () => {
  test('does not show update notifications when the update channel is disabled', async ({ electronApp, page }) => {
    await completeSetup(page);

    await electronApp.evaluate(() => {
      const { BrowserWindow } = process.mainModule!.require('electron') as typeof import('electron');
      const win = BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed());
      win?.webContents.send('update:status-changed', {
        status: 'available',
        info: {
          version: '9.9.9',
          releaseDate: new Date().toISOString(),
        },
      });
    });

    await expect(page.getByText(/9\.9\.9/)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Download|下载|ダウンロード|Скачать/i })).toHaveCount(0);

    await page.getByTestId('sidebar-nav-settings').click();
    await expect(page.getByTestId('settings-page')).toBeVisible();
    await expect(page.getByTestId('updates-settings-section')).toHaveCount(0);
  });
});
