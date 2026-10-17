/**
 * 我的 tab:设置、个人信息、存储与网络状态、媒体授权状态
 */
const queue = require('../../utils/queue');
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const service = require('../../utils/cloud-service');
const local = require('../../utils/owner-storage');

const { themePage, setTheme, applyTheme } = require('../../utils/theme');

const SETTINGS_KEY = 'fitness:settings';

Page(themePage({
  data: {
    pendingCount: 0,
    offlineMode: true,
    unit: 'kg',
    openid: '',
    networkStatus: '检测中…',
    monthSessions: 0,
    monthHours: '0.0',
    monthProgress: 0,
  },

  onShow() {
    const settings = wx.getStorageSync(SETTINGS_KEY) || {};
    const state = service.snapshot();
    this.setData({
      pendingCount: queue.getQueue().length,
      offlineMode: !state.consent,
      unit: settings.unit || 'kg',
      openid: service.ready() ? state.owner : '',
    });
    wx.getNetworkType({
      success: (res) =>
        this.setData({
          networkStatus: res.networkType === 'none' ? '当前无网络，提交将排队重试' : `当前网络：${res.networkType}`,
        }),
      fail: () => this.setData({ networkStatus: '网络状态未知' }),
    });
    return db.fetchAllSessions().then((sessions) => {
      const now = Date.now();
      const stats = domain.computeRecordStats(sessions, now);
      const date = new Date(now);
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const hours = stats.monthDurationSec / 3600;
      this.setData({
        monthSessions: stats.monthSessions,
        monthHours: hours < 10 ? hours.toFixed(1) : hours.toFixed(0),
        // 展示环：本月场次 / 当月总天数，上限 100%；不是训练目标或出勤率。
        monthProgress: Math.min(100, stats.monthSessions / daysInMonth * 100),
      });
    }).catch(() => {});
  },

  onToggleTheme(e) {
    if (setTheme(e.detail.value ? 'light' : 'dark')) applyTheme(this);
    else this.setData({ theme: this.data.theme });
  },

  saveSettings(patch) {
    const settings = Object.assign(wx.getStorageSync(SETTINGS_KEY) || {}, patch);
    wx.setStorageSync(SETTINGS_KEY, settings);
  },

  onToggleOffline(e) {
    if (service.snapshot().consent && (service.ready() || (e && e.detail.value))) {
      service.disable();
      this.setData({ offlineMode: true, openid: '', monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
      wx.showToast({ title: '已停止新增云请求；在途请求可能已完成，云数据未删除', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '启用本人云服务？',
      content: '将使用微信身份保存和同步训练计划、训练记录，并按需加载远程动作图片/GIF。不采集手机号或头像昵称。不同意仍可完整本地训练。可在此停用新增云请求；停用不会删除云数据。在途请求不能撤回。云端全量删除入口尚待交付，目前不应作为正式发布版本。产品同意不等于微信平台隐私接口授权。',
      confirmText: '同意启用',
      success: async res => {
        if (!res.confirm) { this.setData({ offlineMode: true }); return; }
        try {
          const state = await service.enable();
          this.setData({ offlineMode: false, openid: state.owner, monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
          this.onClaimLocalData();
        } catch (err) {
          this.setData({ offlineMode: false, openid: '' });
          wx.showToast({ title: '云服务身份获取失败；本地可用，点击开关重试', icon: 'none' });
        }
      },
    });
  },

  /** 手动冲刷待提交队列 */
  onFlushQueue() {
    if (!service.ready()) {
      wx.showToast({ title: '仅本地保存；请先启用或重试本人云服务', icon: 'none' });
      return;
    }
    queue.flush().then((list) => {
      this.setData({ pendingCount: list.length });
      wx.showToast({
        title: list.length === 0 ? '训练队列已同步（不代表全部计划）' : `剩余 ${list.length} 条待重试`,
        icon: 'none',
      });
    });
  },

  onShowLoginInfo() {
    wx.showModal({
      ...(this.data.theme === 'light' ? { confirmColor: '#3E5429' } : {}),
      title: '登录状态',
      content: this.data.openid
        ? `已使用静默 openid 登录:${this.data.openid.slice(0, 12)}…`
        : '仅本地模式或身份获取失败。可使用离线开关启用/重试云服务，不影响本地训练。',
      showCancel: false,
    });
  },

  onClaimLocalData() {
    if (!service.ready()) return;
    const preview = local.claimPreview();
    if (!preview.plans && !preview.sessions && !preview.drafts) return;
    wx.showModal({
      title: '认领匿名/旧版本地数据',
      content: `当前微信身份：${preview.owner}。待归属范围：${preview.plans} 个计划、${preview.sessions} 条训练记录、${preview.drafts} 份草稿。仅在确认这些数据属于你时认领，之后才允许上传；取消则保留匿名区且不展示/上传。其他所有者的数据不会被认领。`,
      confirmText: '属于我',
      success: res => {
        if (!res.confirm) return;
        try {
          local.claimAnonymous(preview.owner);
          wx.showToast({ title: '已确认归属；训练可手动同步，计划可靠重试待交付', icon: 'none' });
          this.onShow();
        } catch (err) { wx.showToast({ title: err.message, icon: 'none' }); }
      },
    });
  },

  onOpenHelp(e) {
    const section = e.currentTarget.dataset.section;
    if (!['privacy', 'data', 'help'].includes(section)) return;
    wx.navigateTo({ url: `/pages/help/help?section=${section}` });
  },

  onShowLicense() {
    wx.showModal({
      ...(this.data.theme === 'light' ? { confirmColor: '#3E5429' } : {}),
      title: '媒体授权状态',
      content: '动作示意图版权归 Gym visual。正式上线前必须取得书面授权、保留 © Gym visual — https://gymvisual.com/ 署名,并遵守 180×180 分辨率限制。',
      showCancel: false,
    });
  },
}));
