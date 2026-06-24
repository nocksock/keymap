import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { sendKeysPlugin } from '@web/test-runner-commands/plugins';

// Pick the Chromium binary: an explicit override via PLAYWRIGHT_CHROMIUM wins,
// then a local Nix-provided chromium for dev, and finally (e.g. in CI) we fall
// back to Playwright's own bundled browser by leaving launchOptions empty.
const explicit = process.env.PLAYWRIGHT_CHROMIUM;
const localChromium = '/home/nr/.nix-profile/bin/chromium';
const executablePath = explicit || (process.env.CI ? undefined : localChromium);

export default {
  files: 'test/*.browser-test.ts',
  nodeResolve: true,
  plugins: [
    esbuildPlugin({ ts: true }),
    sendKeysPlugin(),
  ],
  browsers: [
    playwrightLauncher({
      product: 'chromium',
      ...(executablePath ? { launchOptions: { executablePath } } : {}),
    })
  ]
};
