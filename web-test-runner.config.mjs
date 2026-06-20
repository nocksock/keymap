import { playwrightLauncher } from '@web/test-runner-playwright';
import { esbuildPlugin } from '@web/dev-server-esbuild';
import { sendKeysPlugin } from '@web/test-runner-commands/plugins';

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
      launchOptions: {
        executablePath: '/home/nr/.nix-profile/bin/chromium',
      }
    })
  ]
};
