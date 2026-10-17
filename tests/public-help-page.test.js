function loadPage() {
  let definition;
  global.Page = value => { definition = value; };
  require('../pages/help/help');
  return Object.assign({}, definition, {
    data: { ...definition.data },
    setData(patch) { Object.assign(this.data, patch); },
  });
}

beforeEach(() => {
  jest.resetModules();
  global.wx = {
    getStorageSync: () => ({ theme: 'light' }),
    setClipboardData: jest.fn(),
    showToast: jest.fn(),
  };
});
afterEach(() => { delete global.wx; delete global.Page; });

test('打开说明页显示真实缺失状态、无联系方式时不复制；返回再显示应用当前主题', () => {
  const page = loadPage();
  page.onLoad({ section: 'privacy' });
  page.onShow();
  expect(page.data.theme).toBe('light');
  expect(page.data.releaseBlocked).toBe(true);
  expect(page.data.operatorName).toContain('未提供');
  expect(page.data.missingInfo.join(' ')).not.toContain('antiResurrection');
  ['operatorName', 'privacyContact', 'supportContact', 'verified'].forEach(key =>
    expect(page.data.missingInfo.join(' ')).toContain(key));
  expect(page.data.metadataScope).toContain('personalDataMeta');
  expect(page.data.metadataScope).toContain('当前或最近一次删除操作标识');
  expect(page.data.metadataRetention).toContain('服务存续期间持续保留');
  const info = require('../config/public-info');
  expect(info.operatorName).toBe('');
  expect(info.privacyContact.value).toBe('');
  expect(info.supportContact.value).toBe('');
  expect(info.verified).toBe(false);
  page.onCopyContact({ currentTarget: { dataset: { contact: 'supportContact' } } });
  expect(wx.setClipboardData).not.toHaveBeenCalled();
  expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '公开联系方式尚未提供' }));
  wx.getStorageSync = () => ({ theme: 'dark' });
  page.onShow();
  expect(page.data.theme).toBe('dark');
});

test('已配置渠道可复制，复制失败提示手动复制，不触发云请求', () => {
  const info = require('../config/public-info');
  // 测试夹具，不写入发布配置。
  info.supportContact = { label: '公开支持邮箱', value: 'support@fixture.invalid' };
  const page = loadPage();
  page.onShow();
  page.onCopyContact({ currentTarget: { dataset: { contact: 'supportContact' } } });
  expect(wx.setClipboardData).toHaveBeenCalledWith(expect.objectContaining({ data: 'support@fixture.invalid' }));
  wx.setClipboardData.mock.calls[0][0].fail();
  expect(wx.showToast).toHaveBeenCalledWith(expect.objectContaining({ title: '复制失败，请手动复制页面联系方式' }));
});

test('我的三个说明入口使用普通导航，说明页定位相应章节', () => {
  let definition;
  global.Page = value => { definition = value; };
  wx.navigateTo = jest.fn();
  require('../pages/me/me');
  ['privacy', 'data', 'help'].forEach(section => {
    definition.onOpenHelp({ currentTarget: { dataset: { section } } });
    expect(wx.navigateTo).toHaveBeenLastCalledWith({ url: `/pages/help/help?section=${section}` });
  });
  const page = loadPage();
  wx.pageScrollTo = jest.fn();
  page.onLoad({ section: 'data' });
  page.onReady();
  expect(wx.pageScrollTo).toHaveBeenCalledWith({ selector: '#data', duration: 0 });
});

test('页面说明如实区分撤回、清本机与删除，不承诺备份或擦除全部痕迹', () => {
  const page = loadPage();
  page.onShow();
  const text = page.data.sections.flatMap(section => section.paragraphs).join('\n');
  [
    '同意前可在本机', '不获取微信身份', 'openid', 'CloudBase', '© Gym visual',
    '不自动删除云数据', '已在途请求可能已经执行', '不会删除云端数据',
    '先确认本人云端删除完成再清本地', '失败或中断不能视为成功',
    '无法远程即时物理擦除', '旧队列不得改绑新代际重传',
    '本地保存不等于云端备份', '不支持文件备份', '不支持多设备并发编辑',
    '不提供医疗诊断', '不适时立即停止训练',
  ].forEach(required => expect(text).toContain(required));
  expect(page.data.metadataRetention).toContain('不承诺所有技术痕迹均已擦除');
});
