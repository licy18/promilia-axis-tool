import viteConfig from '../../../vite.config.js';

describe('vite config', () => {
  it('externalizes generated Workbench JSON assets only during production builds', () => {
    const plugin = viteConfig.plugins.find(
      entry => entry.name === 'externalize-workbench-json-assets'
    );

    expect(plugin).toBeTruthy();
    expect(plugin.apply).toBe('build');
  });
});
