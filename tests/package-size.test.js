const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SCRIPT = path.join(ROOT, 'scripts/check-package-size.js');
const run = (script) => spawnSync(process.execPath, [script, '--json'], { encoding: 'utf8' });

test('发布源码低于 2 MiB，保留离线目录、声音及全部主题图标', () => {
  const result = run(SCRIPT);
  expect(result.stderr).toBe('');
  expect(result.status).toBe(0);
  const { total, limit, files } = JSON.parse(result.stdout);
  const names = files.map(({ file }) => file);
  expect(total).toBeLessThan(limit);
  expect(names).toEqual(expect.arrayContaining([
    'app.js', 'app.json', 'app.wxss', 'sitemap.json', 'assets/audio/rest.wav',
    'data/exercises.js', 'data/exercises-data-1.js', 'data/exercises-data-2.js', 'data/exercises-data-3.js',
    'data/slug-map.js', 'data/curated-catalog.js', 'utils/domain.js', 'utils/db.js', 'utils/theme.js',
  ]));
  const icons = fs.readdirSync(path.join(ROOT, 'images/tabbar')).filter((name) => name.endsWith('.png'));
  expect(icons).toHaveLength(16);
  icons.forEach((name) => expect(names).toContain(`images/tabbar/${name}`));
  expect(names.filter((name) => /^(\.pi|\.scratch|coverage|tests|tools|docs|scripts|cloudfunctions)\//.test(name))).toEqual([]);
  expect(names.filter((name) => name.startsWith('images/tabbar/gen/'))).toEqual([]);
});

test('超限资源使检查失败，目录排除不会误排除同名前缀资源', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'fitness-package-'));
  try {
    fs.mkdirSync(path.join(fixture, 'scripts'));
    const script = path.join(fixture, 'scripts/check-package-size.js');
    fs.copyFileSync(SCRIPT, script);
    fs.mkdirSync(path.join(fixture, 'images/gen'), { recursive: true });
    fs.writeFileSync(path.join(fixture, 'images/gen/source.png'), Buffer.alloc(2 * 1024 * 1024));
    fs.writeFileSync(path.join(fixture, 'images/gen-active.png'), 'runtime icon');
    const config = path.join(fixture, 'project.config.json');
    fs.writeFileSync(config, JSON.stringify({ packOptions: { ignore: [] } }));
    expect(run(script).status).toBe(1);
    fs.writeFileSync(config, JSON.stringify({ packOptions: {
      ignore: [{ type: 'folder', value: 'images/gen' }],
    } }));
    const result = run(script);
    expect(result.status).toBe(0);
    const names = JSON.parse(result.stdout).files.map(({ file }) => file);
    expect(names).toContain('images/gen-active.png');
    expect(names).not.toContain('images/gen/source.png');
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
});