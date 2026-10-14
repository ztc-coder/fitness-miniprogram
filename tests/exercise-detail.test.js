/**
 * 票 01:共享动作详情弹层滚动与底部操作区。
 * 只断言可复核的结构 / 样式契约与组件行为。
 * 注意:契约测试不替代真机验收 —— 微信 scroll-view 的真实滚动、安全区与窄屏表现
 * 必须由人工在开发者工具/真机确认,本文件只能锁定“给 scroll-view 确定高度”这一前提条件。
 */
const fs = require('fs');
const path = require('path');

const WXML = fs.readFileSync(path.join(__dirname, '../components/exercise-detail/exercise-detail.wxml'), 'utf8');
const WXSS = fs.readFileSync(path.join(__dirname, '../components/exercise-detail/exercise-detail.wxss'), 'utf8');
const JS = fs.readFileSync(path.join(__dirname, '../components/exercise-detail/exercise-detail.js'), 'utf8');

/** 取出某个选择器的规则块:选择器必须从行首开始,避免命中同类前缀或后代选择器 */
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`^${escaped} \\{`, 'm').exec(css);
  expect(match).toBeTruthy();
  return css.slice(match.index, css.indexOf('}', match.index));
}

/** 去掉 max-height / min-height 后剩下的声明,用来判断是否写死了 height */
function withoutHeightCaps(block) {
  return block.replace(/max-height:[^;]*;?/g, '').replace(/min-height:[^;]*;?/g, '');
}

const scrollStart = WXML.indexOf('<scroll-view class="detail-scroll"');
const scrollEnd = WXML.indexOf('</scroll-view>');
const actionsStart = WXML.indexOf('<view class="detail-actions"');
const scrollBody = WXML.slice(scrollStart, scrollEnd);

describe('动作详情弹层结构契约(票 01)', () => {
  test('标题区 / 正文滚动区 / 操作区依次为兄弟节点,操作区不在滚动区内', () => {
    const headStart = WXML.indexOf('<view class="detail-head">');

    expect(headStart).toBeGreaterThan(-1);
    expect(scrollStart).toBeGreaterThan(headStart);
    expect(scrollEnd).toBeGreaterThan(scrollStart);
    // 操作区在 </scroll-view> 之后:它是正文的兄弟节点,不随正文滚动
    expect(actionsStart).toBeGreaterThan(scrollEnd);
    expect(WXML.slice(actionsStart, WXML.indexOf('</view>', actionsStart))).toContain('bindtap="onPick"');
  });

  test('卡片按 showPick 切换 .has-actions 状态类', () => {
    const cardTag = WXML.slice(WXML.indexOf('<view class="detail-card'), WXML.indexOf('>', WXML.indexOf('<view class="detail-card')));

    // 确定高度只能加在有操作区的状态上:只读态必须保持自适应
    expect(cardTag).toContain("class=\"detail-card {{showPick ? 'has-actions' : ''}}\"");
  });

  test('滚动区承载全部末尾内容:动作要领、自重备注、媒体署名都可滚到', () => {
    expect(scrollBody).toContain('detail-steps-title');
    expect(scrollBody).toContain('wx:for="{{detail.steps}}"');
    expect(scrollBody).toContain('detail-step-text');
    expect(scrollBody).toContain('detail-note');
    expect(scrollBody).toContain('isBodyWeight');
    expect(scrollBody).toContain('© Gym visual — https://gymvisual.com/');
  });

  test('末尾留白只在 showPick=true 时渲染,排在署名之后', () => {
    const spacer = WXML.indexOf('class="detail-tail-space"');

    expect(spacer).toBeGreaterThan(-1);
    expect(WXML.slice(spacer - 80, spacer)).toContain('wx:if="{{showPick}}"');
    expect(spacer).toBeGreaterThan(WXML.indexOf('© Gym visual'));
    expect(spacer).toBeLessThan(scrollEnd);
  });

  test('操作区整块由 showPick 控制,打卡页只读详情不保留按钮占位', () => {
    const actionsTag = WXML.slice(actionsStart, WXML.indexOf('>', actionsStart));

    expect(actionsTag).toContain('wx:if="{{showPick}}"');
    expect(WXML.slice(actionsStart, WXML.indexOf('</view>', actionsStart))).toContain('{{pickText}}');
  });

  test('关闭、媒体降级与选择行为绑定保持不变', () => {
    expect(WXML).toContain('bindtap="onClose"');
    expect(WXML).toContain('catchtouchmove="noop"');
    expect(WXML).toContain('hover-class="detail-primary-hover"');
    expect(scrollBody).toContain('scroll-y');
    // GIF → JPEG → glyph:级联由 stageIndex 越界触发,越界后走 wx:else 的 glyph
    expect(scrollBody).toContain('binderror="onMediaError"');
    expect(scrollBody).toContain('wx:if="{{stageIndex < mediaStages.length}}"');
    expect(scrollBody).toContain('src="{{mediaStages[stageIndex]}}"');
    expect(scrollBody).toContain('{{detail.glyph}}');
  });
});

describe('动作详情弹层样式契约(票 01)', () => {
  test('基础卡片只限高不写死高度:只读态按内容自适应,不留固定大空白', () => {
    const card = rule(WXSS, '.detail-card');

    expect(card).toMatch(/display:\s*flex/);
    expect(card).toMatch(/flex-direction:\s*column/);
    expect(card).toMatch(/max-height:\s*82vh/);
    expect(withoutHeightCaps(card)).not.toMatch(/\bheight:/);
  });

  test('has-actions 卡片取确定高度,并受 82vh 与底部安全区约束', () => {
    const picked = rule(WXSS, '.detail-card.has-actions');

    // 确定 height 是“正文区吃满剩余高度”的前提(微信 scroll-view 竖向滚动要求确定 height)
    expect(picked).toMatch(/height:\s*82vh/);
    // 窄屏 / 带 home indicator 时仍落在遮罩可视区内(遮罩上下内边距 36rpx×2)
    expect(picked).toMatch(/max-height:\s*calc\(100vh\s*-\s*72rpx\s*-\s*env\(safe-area-inset-bottom\)\)/);
  });

  test('has-actions 正文区吃满剩余高度:flex-basis 0 + height 0 给 scroll-view 确定高度', () => {
    const pickedScroll = rule(WXSS, '.detail-card.has-actions .detail-scroll');

    expect(pickedScroll).toMatch(/flex:\s*1\s+1\s+0%/);
    expect(pickedScroll).toMatch(/height:\s*0/);
  });

  test('基础正文区保持内容自适应,不设 max-height 也不写 height:0(只读态不被截断/不塌陷)', () => {
    const scroll = rule(WXSS, '.detail-scroll');

    expect(scroll).toMatch(/flex:\s*1\s+1\s+auto/);
    expect(scroll).toMatch(/min-height:\s*0/);
    // max-height 会让只读详情过早截断;height:0 会让只读态正文塌陷
    expect(scroll).not.toMatch(/max-height:/);
    expect(withoutHeightCaps(scroll)).not.toMatch(/\bheight:/);
  });

  test('标题区与操作区不参与收缩,操作区不定位、无负边距', () => {
    const head = rule(WXSS, '.detail-head');
    const actions = rule(WXSS, '.detail-actions');

    expect(head).toMatch(/flex-shrink:\s*0/);
    expect(actions).toMatch(/flex-shrink:\s*0/);
    expect(actions).toMatch(/border-top:\s*1rpx\s+solid/);
    expect(actions).toMatch(/padding-top:\s*2[0-9]rpx/);
    expect(actions).not.toMatch(/position:\s*(fixed|absolute|sticky)/);
    expect(actions).not.toMatch(/margin[^:;]*:\s*-/);
  });

  test('正文末尾留白有正高度,补足滚到底时署名与分隔线的间隔', () => {
    const spacer = rule(WXSS, '.detail-tail-space');

    expect(Number(/(\d+)rpx/.exec(spacer)[1])).toBeGreaterThan(0);
  });

  test('遮罩为卡片预留安全区,卡片宽度适配窄屏', () => {
    const mask = rule(WXSS, '.detail-mask');
    const card = rule(WXSS, '.detail-card');

    expect(mask).toContain('env(safe-area-inset-bottom)');
    expect(card).toMatch(/width:\s*100%/);
    expect(card).toMatch(/max-width:\s*\d+rpx/);
  });
});

describe('动作详情弹层中文展示契约(票 02)', () => {
  test('标题区不含英文 kicker 与英文副标题,只展示中文器械与中文动作名', () => {
    expect(WXML).not.toContain('EXERCISE DOSSIER');
    expect(WXML).not.toContain('detail.nameEn');
    expect(WXML).not.toContain('detail-subtitle');
    expect(WXML).toContain('<view class="detail-kicker">{{detail.equipmentZh}}</view>');
    expect(WXML).toContain('<view class="detail-title">{{detail.nameZh}}</view>');
  });

  test('英文副标题样式随元素移除,不留孤儿规则;组件入参不再声明 nameEn', () => {
    expect(WXSS).not.toMatch(/^\.detail-subtitle\s*\{/m);
    expect(JS).not.toContain('nameEn');
  });

  test('版权署名与网址保留在可滚动正文里', () => {
    expect(scrollBody).toContain('© Gym visual — https://gymvisual.com/');
  });
});

describe('动作详情弹层组件行为(票 01)', () => {
  let definition;

  beforeEach(() => {
    jest.resetModules();
    definition = null;
    global.Component = (def) => {
      definition = def;
    };
    require('../components/exercise-detail/exercise-detail');
  });

  afterEach(() => {
    delete global.Component;
  });

  function createInstance() {
    const instance = Object.assign({}, definition.methods, {
      data: JSON.parse(JSON.stringify(definition.data)),
      events: [],
      setData(patch) {
        this.data = Object.assign({}, this.data, patch);
      },
      triggerEvent(name, payload) {
        this.events.push({ name, payload });
      },
    });
    return instance;
  }

  const detail = {
    nameZh: '绳索直臂下压',
    glyph: '绳',
    steps: ['站姿握把', '保持肘微屈'],
    gifSrc: 'cloud://demo/exercises/videos/0238-x69MAlq.gif',
    imageSrc: 'cloud://demo/exercises/images/0238-x69MAlq.jpg',
  };

  test('关闭与选择各自透传 close / pick 事件', () => {
    const instance = createInstance();

    instance.onClose();
    instance.onPick();
    expect(instance.events).toEqual([{ name: 'close', payload: undefined }, { name: 'pick', payload: undefined }]);
  });

  test('媒体级联为 GIF → JPEG,缺项直接跳过,入参变化时重置到首级', () => {
    const instance = createInstance();

    definition.observers.detail.call(instance, detail);
    expect(instance.data.mediaStages).toEqual([detail.gifSrc, detail.imageSrc]);
    expect(instance.data.stageIndex).toBe(0);

    instance.onMediaError();
    definition.observers.detail.call(instance, { nameZh: '无媒体动作', glyph: '无' });
    expect(instance.data.mediaStages).toEqual([]);
    expect(instance.data.stageIndex).toBe(0);
  });

  test('媒体加载失败逐级后退,越过级联尽头后模板改显示 glyph', () => {
    const instance = createInstance();

    definition.observers.detail.call(instance, detail);
    instance.onMediaError();
    expect(instance.data.mediaStages[instance.data.stageIndex]).toBe(detail.imageSrc);
    // 第二级也失败:stageIndex 越界,模板 `stageIndex < mediaStages.length` 为假 → glyph
    instance.onMediaError();
    expect(instance.data.stageIndex).toBe(instance.data.mediaStages.length);
  });

  test('默认只读:showPick=false、pickText 由调用方按场景覆盖', () => {
    expect(definition.properties.showPick.value).toBe(false);
    expect(definition.properties.showPick.type).toBe(Boolean);
    expect(definition.properties.detail.value).toBe(null);
    expect(definition.properties.pickText.value).toBe('加入训练');
  });
});
