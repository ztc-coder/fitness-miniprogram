/**
 * 我的 tab:设置、个人信息、存储与网络状态、媒体授权状态
 */
const queue = require('../../utils/queue');

const SETTINGS_KEY = 'fitness:settings';

Page({
  data: {
    pendingCount: 0,
    offlineMode: true,
    unit: 'kg',
    openid: '',
    networkStatus: '检测中…',
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
          networkStatus: res.networkType === 'none' ? '当前无网络,提交将排队重试' : '云开发连接正常',
        }),
      fail: () => this.setData({ networkStatus: '网络状态未知' }),
    });
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
      title: '登录状态',
      content: this.data.openid
        ? `已使用静默 openid 登录:${this.data.openid.slice(0, 12)}…`
        : '静默登录进行中,不影响本地训练记录。',
      showCancel: false,
    });
  },

  onShowLicense() {
    wx.showModal({
      title: '媒体授权状态',
      content: '动作示意图版权归 Gym visual。正式上线前必须取得书面授权、保留 © Gym visual — https://gymvisual.com/ 署名,并遵守 180×180 分辨率限制。',
      showCancel: false,
    });
  },
});
