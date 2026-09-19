describe('训练页动作详情媒体反查', () => {
  let page;

  beforeEach(() => {
    jest.resetModules();
    global.Page = (definition) => {
      page = definition;
    };
    global.wx = {};
    require('../pages/training/training');
    page = Object.assign({}, page, {
      data: JSON.parse(JSON.stringify(page.data)),
    });
    page.setData = (patch) => {
      page.data = Object.assign({}, page.data, patch);
    };
  });

  afterEach(() => {
    delete global.Page;
    delete global.wx;
  });

  test('详情展示精选部位标签而不是上游粗粒度 bodyPart', () => {
    page.data.session = {
      exercises: [
        { exerciseId: '0025', name: '杠铃卧推', equipment: 'barbell', skipped: false },
      ],
    };

    page.onExerciseTap({ currentTarget: { dataset: { ex: 0 } } });

    expect(page.data.detail.bodyPartZh).toBe('胸 · 复合动作');
    expect(page.data.detail.gifSrc).toMatch(/\.gif$/);
    expect(page.data.detail.imageSrc).toMatch(/\.jpg$/);
  });
});
