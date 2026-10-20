/**
 * 媒体与代码解耦的仓库守卫:Gym visual 动作媒体绝不入库,缺媒体时界面走降级链。
 *
 * 断言对象优先取 **git 跟踪**的文件,不是整个工作区:本地自建媒体包/上传缓存留在工作区
 * 不算违规,但它们一旦被 git add,这里立刻失败(对应第03票验收里的「仓库不再包含
 * 有版权风险的素材」)。没有 .git 时(下载 zip 解压的部署者)退化为遍历目录并跳过
 * 已在 .gitignore 里兜住的媒体目录。
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'coverage', 'miniprogram_npm', '.pi', 'exercises', 'media-pack']);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(path.relative(ROOT, full).split(path.sep).join('/'));
  }
  return out;
}

function repoFiles() {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' })
      .split('\0')
      .filter(Boolean);
  } catch (err) {
    return walk(ROOT);
  }
}

describe('动作媒体与代码解耦', () => {
  test('仓库跟踪的文件里没有任何图片/GIF/视频媒体', () => {
    const media = repoFiles().filter((file) => /\.(jpe?g|gif|webp|mp4|mov|m4v|avi)$/i.test(file));
    expect(media).toEqual([]);
  });

  test('images/ 只有自制 tabBar 图标', () => {
    const images = repoFiles().filter((file) => file.startsWith('images/'));
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((file) => /^images\/tabbar\/(gen\/)?[a-z-]+\.png$/.test(file))).toBe(true);
  });

  test('README 写明媒体包来源、缺媒体降级与署名限制', () => {
    const readme = read('README.md');
    expect(readme).toContain('## 动作媒体：仓库里没有，部署时怎么补');
    expect(readme).toContain('MEDIA_ROOT');
    expect(readme).toContain('2,590');
    expect(readme).toContain('© Gym visual — https://gymvisual.com/');
    expect(readme).toContain('180×180');
  });

  test('部署指南与第三方声明指向同一套媒体规则', () => {
    expect(read('docs/independent-deployment.md')).toContain('媒体包布局与缺媒体表现');
    expect(read('THIRD-PARTY.md')).toContain('README');
  });

  test('.gitignore 兜住媒体目录,避免误 add 后再靠人工清理', () => {
    const ignore = read('.gitignore');
    expect(ignore).toMatch(/^exercises\/$/m);
    expect(ignore).toMatch(/^media-pack\/$/m);
  });

  // 干净 clone 后开发者工具能编译的静态前提:app.json 里点名的图标与页面文件都在。
  // 这是「媒体不入库」最容易踩的坑——把 tabBar 图标也当媒体搬走,编译器立刻报错。
  test('app.json 引用的图标与页面文件都真实存在', () => {
    const app = JSON.parse(read('app.json'));
    const missing = [];
    for (const item of (app.tabBar && app.tabBar.list) || []) {
      for (const key of ['iconPath', 'selectedIconPath']) {
        if (item[key] && !fs.existsSync(path.join(ROOT, item[key]))) missing.push(item[key]);
      }
    }
    for (const page of app.pages || []) {
      for (const ext of ['js', 'wxml', 'json', 'wxss']) {
        if (!fs.existsSync(path.join(ROOT, `${page}.${ext}`))) missing.push(`${page}.${ext}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
