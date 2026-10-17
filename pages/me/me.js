/**
 * 我的 tab:设置、个人信息、存储与网络状态、媒体授权状态
 */
const queue = require('../../utils/queue');
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const service = require('../../utils/cloud-service');
const local = require('../../utils/owner-storage');
const management = require('../../utils/data-management');
function isCurrent(token) {
  try { service.assertCurrent(token); return true; } catch (err) { return false; }
}
function confirmTwice(page, title, content, action) {
  const token = service.snapshot(), version = local.version();
  const current = () => {
    if (isCurrent(token) && version === local.version()) return true;
    page.setData({ dataResult: '身份或本机数据已变化，请重新查看范围并确认' });
    return false;
  };
  wx.showModal({ title, content, confirmText: '继续', success: res => {
    if (!res.confirm || !current()) return;
    wx.showModal({ title: '再次确认不可恢复的操作', content, confirmText: '确认执行', success: result => {
      if (result.confirm && current()) return action();
    } });
  } });
}

const { themePage, setTheme, applyTheme } = require('../../utils/theme');

const SETTINGS_KEY = 'fitness:settings';

Page(themePage({
  data: {
    pendingCount: 0,
    syncStatus: { plans: { state: '仅本地', pending: 0, details: [] }, sessions: { state: '仅本地', pending: 0, details: [] } },
    readStatus: { plans: '未读取', sessions: '未读取' },
    offlineMode: true,
    cloudFailed: false,
    unit: 'kg',
    openid: '',
    networkStatus: '检测中…',
    monthSessions: 0,
    monthHours: '0.0',
    monthProgress: 0,
    dataResult: '',
    deleting: false,
  },

  onShow() {
    if (!this._meUnsubscribe) this._meUnsubscribe = service.subscribe(() => this.resetPrivateView());
    const token = service.snapshot();
    const settings = wx.getStorageSync(SETTINGS_KEY) || {};
    const state = service.snapshot();
    this.setData({
      pendingCount: queue.getStatus().plans.pending + queue.getStatus().sessions.pending,
      syncStatus: queue.getStatus(),
      readStatus: db.getReadStatus(),
      offlineMode: !state.consent,
      cloudFailed: state.status === 'failed',
      unit: settings.unit || 'kg',
      openid: service.ready() ? state.owner : '',
    });
    wx.getNetworkType({
      success: (res) => {
        if (!isCurrent(token)) return;
        this.setData({ networkStatus: res.networkType === 'none' ? '当前无网络，提交将排队重试' : `当前网络：${res.networkType}` });
      },
      fail: () => { if (isCurrent(token)) this.setData({ networkStatus: '网络状态未知' }); },
    });
    return db.fetchAllSessions().then((sessions) => {
      if (!isCurrent(token)) return;
      const now = Date.now();
      const stats = domain.computeRecordStats(sessions, now);
      const date = new Date(now);
      const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      const hours = stats.monthDurationSec / 3600;
      this.setData({
        readStatus: db.getReadStatus(),
        monthSessions: stats.monthSessions,
        monthHours: hours < 10 ? hours.toFixed(1) : hours.toFixed(0),
        // 展示环：本月场次 / 当月总天数，上限 100%；不是训练目标或出勤率。
        monthProgress: Math.min(100, stats.monthSessions / daysInMonth * 100),
      });
    }).catch(() => {});
  },

  onUnload() { if (this._meUnsubscribe) this._meUnsubscribe(); },

  resetPrivateView() {
    this.setData({ pendingCount: 0, monthSessions: 0, monthHours: '0.0', monthProgress: 0,
      openid: '', offlineMode: !service.snapshot().consent,
      readStatus: { plans: '未读取', sessions: '未读取' },
      syncStatus: { plans: { state: '仅本地', pending: 0, details: [] }, sessions: { state: '仅本地', pending: 0, details: [] } } });
  },

  onWithdrawConsent() {
    management.withdraw();
    this.resetPrivateView();
    this.setData({ dataResult: '已撤回同意，停止新增身份、同步及远程媒体请求。本地训练保留；云数据未删除，已在途请求不能取消、可能已执行。' });
  },

  onClearLocal() {
    const loss = management.preview(true);
    confirmTwice(this, '清除本机全部训练数据？',
      `将丢失本机全部身份及匿名区的计划、历史、${loss.drafts} 份进行中草稿、${loss.pending} 项待同步任务及同步状态。保留主题和单位偏好，撤回云服务同意。仅清本机，不删除云端；再次同意可能下载云数据。已在途请求不能取消。`, () => {
        try {
          management.clearLocal(); this.resetPrivateView();
          this.setData({ dataResult: '本机全部训练数据已清除；偏好保留，同意已撤回。云端未删除，在途请求可能已执行。' });
        } catch (err) { this.setData({ dataResult: `本机清理未完成：${err.message}，请重试` }); }
      });
  },

  async onDeleteAll() {
    if (this.data.deleting) return;
    this.setData({ deleting: true, dataResult: '仅为删除校验本人身份，不开启同步或上传本地数据…' });
    try {
      const token = await management.authorizeDeletion();
      const loss = management.preview();
      confirmTwice(this, '删除本人全部个人数据？',
        `当前本人身份：${token.owner}。将联网删除本人云计划和历史，确认完成后才清除此身份本机的计划、历史、${loss.drafts} 份进行中草稿、${loss.pending} 项待同步任务。不会清除其他身份或匿名区，不影响公共媒体。保留主题和单位，撤回同意；本次联网仅用于删除。已在途请求不能取消，离线设备不能即时远程擦除，下次联网才识别屏障。失败需重试，不代表已删除。`, async () => {
          this.setData({ deleting: true, dataResult: '删除中；尚未确认完成，请勿视为已删除' });
          const result = await management.deleteAll(token);
          this.resetPrivateView();
          this.setData({ deleting: false, dataResult: result.status === 'deleted'
            ? '本人云端删除已确认，当前身份本机数据已清除；偏好保留、同意已撤回。其他离线设备无法即时擦除，必要防复活技术元数据仍保留。'
            : (result.message || '删除尚未确认，请重新确认并重试') });
        });
    } catch (err) { this.setData({ dataResult: `删除授权失败：${err.message}；本机未清理，可重试` }); }
    finally { this.setData({ deleting: false }); }
  },

  onReconcile() {
    confirmTwice(this, '确认删除屏障后的重新使用？',
      '云端删除完成后，清除当前身份本机残留的计划、历史、草稿和任务，再采用新代际。旧任务不会改绑重传，其他身份及匿名区不受影响。需要先主动同意云服务；此操作不恢复已删数据。', async () => {
        try { await management.reconcile(); this.resetPrivateView(); this.setData({ dataResult: '已采用当前代际，可主动新建数据并同步' }); }
        catch (err) { this.setData({ dataResult: err.message }); }
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

  onToggleOffline(e) {
    if (service.snapshot().consent && (service.ready() || (e && e.detail && e.detail.value))) {
      service.disable();
      this.setData({ offlineMode: true, cloudFailed: false, openid: '', monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
      wx.showToast({ title: '已停止新增云请求；在途请求可能已完成，云数据未删除', icon: 'none' });
      return;
    }
    const token = service.snapshot();
    wx.showModal({
      title: '启用本人云服务？',
      content: '将使用微信身份保存和同步训练计划、训练记录，并按需加载远程动作图片/GIF。不采集手机号或头像昵称。不同意仍可完整本地训练。可在此停用新增云请求；停用不会删除云数据。在途请求不能撤回。云端全量删除请使用独立的数据管理操作，不会自动删除云数据。产品同意不等于微信平台隐私接口授权。',
      confirmText: '同意启用',
      success: async res => {
        if (!isCurrent(token)) return;
        if (!res.confirm) { this.setData({ offlineMode: !service.snapshot().consent }); return; }
        try {
          const state = await service.enable();
          this.setData({ offlineMode: false, cloudFailed: false, openid: state.owner, monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
          this.onClaimLocalData();
        } catch (err) {
          this.setData({ offlineMode: false, cloudFailed: true, openid: '' });
          wx.showToast({ title: '身份获取失败；本地可用，请点「重试云服务」', icon: 'none' });
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
    const token = service.snapshot();
    const pending = queue.flush();
    this.setData({ syncStatus: queue.getStatus() });
    return pending.then(() => {
      service.assertCurrent(token);
      const status = queue.getStatus();
      const count = status.plans.pending + status.sessions.pending;
      this.setData({ pendingCount: count, syncStatus: status, readStatus: db.getReadStatus() });
      wx.showToast({ title: count ? `仍有 ${count} 项待处理，请查看失败详情` : '计划与训练同步任务已确认', icon: 'none' });
    }).catch(() => {
      this.setData({ syncStatus: queue.getStatus() });
      wx.showToast({ title: '同步未确认，请检查云服务状态后重试', icon: 'none' });
    });
  },

  onShowLoginInfo() {
    wx.showModal({
      ...(this.data.theme === 'light' ? { confirmColor: '#3E5429' } : {}),
      title: '登录状态',
      content: this.data.openid
        ? `已使用静默 openid 登录:${this.data.openid.slice(0, 12)}…`
        : '仅本地模式或身份获取失败。关闭离线开关可启用云服务；失败后请点「重试云服务」，不影响本地训练。',
      showCancel: false,
    });
  },

  onClaimLocalData() {
    if (!service.ready()) return;
    const token = service.snapshot(), version = local.version();
    const preview = local.claimPreview();
    if (!preview.plans && !preview.sessions && !preview.drafts) return;
    wx.showModal({
      title: '认领匿名/旧版本地数据',
      content: `当前微信身份：${preview.owner}。待归属范围：${preview.plans} 个计划、${preview.sessions} 条训练记录、${preview.drafts} 份草稿。仅在确认这些数据属于你时认领，之后才允许上传；取消则保留匿名区且不展示/上传。其他所有者的数据不会被认领。`,
      confirmText: '属于我',
      success: async res => {
        if (!res.confirm || !isCurrent(token) || version !== local.version()) return;
        try {
          await require('../../utils/personal-cloud').generation();
          if (!isCurrent(token) || version !== local.version()) return;
          local.claimAnonymous(preview.owner);
          wx.showToast({ title: '已确认归属；计划与训练可手动重试同步', icon: 'none' });
          queue.flush().catch(() => {});
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
