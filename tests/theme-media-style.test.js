const fs = require('fs');
const path = require('path');

// 公开 WXSS 样式契约；不是 CSS 计算器，也不是原生渲染/截图证据。
test('浅深两主题真实示意图与演示共用白底 normal，只有有媒体图托变白', () => {
  for (const [file, images, wraps] of [
    ['pages/today/today.wxss', ['.exercise-image'], []],
    ['pages/training/training.wxss', ['.ex-thumb-img', '.preview-image'], []],
    ['pages/library/library.wxss', ['.library-art-image'], ['.library-art-wrap']],
    ['pages/plan-day/plan-day.wxss', ['.exercise-thumb image'], ['.exercise-thumb']],
    ['components/exercise-detail/exercise-detail.wxss', ['.detail-media'], ['.detail-art-wrap']],
  ]) {
    const css = fs.readFileSync(path.join(__dirname, '..', file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    for (const selector of [...images, ...wraps.map(wrap => `${wrap}.has-media`)]) {
      const base = rules.filter(([, head]) => head.trim() === selector).map(([, , body]) => body).join('\n');
      expect(base).toMatch(/background:\s*#FFFFFF;/);
      if (images.includes(selector)) expect(base).toMatch(/mix-blend-mode:\s*normal;/);
      // 不允许主题专属规则重染真实媒体，也不留下同值浅色覆盖。
      expect(css).not.toContain(`.theme-light ${selector} {`);
      expect(css).not.toContain(`.theme-dark ${selector} {`);
    }
    for (const wrap of wraps) {
      const placeholder = rules.find(([, head]) => head.trim() === wrap);
      expect(placeholder[2]).not.toMatch(/background:\s*#FFFFFF;/);
    }
    expect(css).not.toMatch(/mix-blend-mode:\s*multiply/);
  }
});
