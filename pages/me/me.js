/**
 * 我的 tab:设置、个人信息、存储与网络状态、媒体授权状态
 */
const queue = require('../../utils/queue');
const db = require('../../utils/db');
const domain = require('../../utils/domain');

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
    const app = getApp();
    this.setData({
      pendingCount: queue.getQueue().length,
      offlineMode: settings.offlineMode !== false,
      unit: settings.unit || 'kg',
      openid: app.globalData.openid || '',
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
    });
  },

  onToggleTheme(e) {
    if (setTheme(e.detail.value ? 'light' : 'dark')) applyTheme(this);
    else this.setData({ theme: this.data.theme });
  },

  saveSettings(patch) {
    const settings = Object.assign(wx.getStorageSync(SETTINGS_KEY) || {}, patch);
    wx.setStorageSync(SETTINGS_KEY, settings);
  },

  onToggleOffline() {
    const next = !this.data.offlineMode;
    this.setData({ offlineMode: next });
    this.saveSettings({ offlineMode: next });
  },

  /** 手动冲刷待提交队列 */
  onFlushQueue() {
    queue.flush().then((list) => {
      this.setData({ pendingCount: list.length });
      wx.showToast({
        title: list.length === 0 ? '已全部提交' : `剩余 ${list.length} 条待重试`,
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
        : '静默登录进行中,不影响本地训练记录。',
      showCancel: false,
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
