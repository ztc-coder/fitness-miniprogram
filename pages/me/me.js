/**
 * 我的 tab:训练概览、偏好与云同步入口
 */
const queue = require('../../utils/queue');
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const service = require('../../utils/cloud-service');
const local = require('../../utils/owner-storage');
function isCurrent(token) { try { service.assertCurrent(token); return true; } catch (err) { return false; } }

const { themePage, setTheme, applyTheme } = require('../../utils/theme');

const SETTINGS_KEY = 'fitness:settings';

Page(themePage({
  data: {
    pendingCount: 0,
    syncStatus: { plans: { state: '仅本地', pending: 0, details: [] }, sessions: { state: '仅本地', pending: 0, details: [] } },
    readStatus: { plans: '未读取', sessions: '未读取' },
    readFailed: false, readLoading: false, showSyncBreakdown: false, syncIssue: false, syncProcessing: false,
    offlineMode: true,
    cloudFailed: false,
    unit: 'kg',
    openid: '',
    networkStatus: '检测中…',
    monthSessions: 0,
    monthHours: '0.0',
    monthProgress: 0,
    syncHeadline: '仅本地', syncSubtitle: '训练保存在本机，启用后可同步到本人云端', serviceReady: false,
  },

  onShow() {
    this._disposed = false;
    if (!this._meUnsubscribe) this._meUnsubscribe = service.subscribe(() => { this.resetPrivateView(); this.refreshSyncView(); });
    this.refreshSyncView();
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
        if (this._disposed || !isCurrent(token)) return;
        this.setData({ networkStatus: res.networkType === 'none' ? '当前无网络，提交将排队重试' : `当前网络：${res.networkType}` });
      },
      fail: () => { if (!this._disposed && isCurrent(token)) this.setData({ networkStatus: '网络状态未知' }); },
    });
    return this.loadRecords();
  },

  onReloadRecords() {
    if (this._disposed || this.data.readLoading || !service.ready()) return;
    return this.loadRecords(true);
  },

  loadRecords(retry = false) {
    const token = service.snapshot();
    this.setData({ readLoading: true });
    const plans = retry && db.getReadStatus().plans === '读取未完整，请重试' ? db.fetchPlans() : Promise.resolve();
    return Promise.all([plans, db.fetchAllSessions()]).then(([, sessions]) => {
      if (this._disposed || !isCurrent(token)) return;
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
    }).catch(() => {}).finally(() => {
      if (this._disposed || !isCurrent(token)) return;
      this.setData({ readLoading: false });
      this.refreshSyncView(this.data.syncStatus);
    });
  },

  onUnload() { this._disposed = true; this._life = (this._life || 0) + 1; this._claiming = false; if (this._meUnsubscribe) this._meUnsubscribe(); this._meUnsubscribe = null; },

  resetPrivateView() {
    if (this._disposed) return;
    this.setData({ readLoading: false, pendingCount: 0, monthSessions: 0, monthHours: '0.0', monthProgress: 0,
      openid: '', offlineMode: !service.snapshot().consent,
      readStatus: { plans: '未读取', sessions: '未读取' },
      syncStatus: { plans: { state: '仅本地', pending: 0, details: [] }, sessions: { state: '仅本地', pending: 0, details: [] } } });
  },

  refreshSyncView(status) {
    if (this._disposed) return;
    status = status || queue.getStatus();
    const state = service.snapshot();
    const readStatus = db.getReadStatus();
    const readFailed = service.ready() && Object.values(readStatus).includes('读取未完整，请重试');
    const count = status.plans.pending + status.sessions.pending;
    const syncing = status.plans.state === '同步中' || status.sessions.state === '同步中';
    const taskError = status.plans.details.concat(status.sessions.details).find(item => item.error);
    const reason = status.reason || (taskError ? require('../../utils/sync-feedback').reason(taskError.error) : '');
    const deletion = !!state.owner && !!local.getStorageSync('fitness:deletionOperation');
    const processing = deletion || (!!state.owner && !!local.getStorageSync('fitness:syncBarrier'));
    const processingReason = deletion ? '有未完成的删除，请到数据管理继续' : '删除后的本机数据需确认，请到数据管理查看';
    const preview = local.claimPreview();
    const unclaimed = !!(preview.plans + preview.sessions + preview.drafts);
    const headline = !state.consent ? '仅本地' : state.status === 'failed' ? '启用失败' :
      !service.ready() ? '同步中' : processing ? '待处理' : syncing ? '同步中' : count ? '待同步' : unclaimed ? '待处理' : reason ? '待处理' : readFailed ? '待加载' : '已同步';
    this.setData({ readStatus, readFailed, syncIssue: service.ready() && !!reason, syncProcessing: processing, syncStatus: status, pendingCount: count, serviceReady: service.ready(),
      showSyncBreakdown: service.ready() && !processing && !unclaimed && !readFailed && !reason,
      offlineMode: !state.consent, cloudFailed: state.status === 'failed', syncHeadline: headline,
      syncSubtitle: !state.consent ? '训练保存在本机，启用后可同步到本人云端' :
        state.status === 'failed' ? '暂时无法连接云服务，本地训练不受影响' :
        !service.ready() ? '正在连接本人云服务' : processing ? processingReason : syncing ? '正在等待云端确认，本机记录已保留' :
        reason ? reason : count ? '本机记录已保存，等待云端确认' : unclaimed ? '本机还有记录未加入云同步' : readFailed ? '部分云端记录未加载' : '当前计划与训练同步任务均已获云端确认' });
  },

  onToggleCloudSync(e) { this.onToggleOffline({ detail: { value: !e.detail.value } }); },

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
      this.refreshSyncView();
      wx.showToast({ title: '已停止新增云请求；在途请求可能已完成，云数据未删除', icon: 'none' });
      return;
    }
    const token = service.snapshot();
    wx.showModal({
      title: '启用本人云服务？',
      content: '将使用微信身份保存和同步训练计划、训练记录，并按需加载远程动作图片/GIF。不采集手机号或头像昵称。不同意仍可完整本地训练。可在此停用新增云请求；停用不会删除云数据。在途请求不能撤回。云端全量删除请使用独立的数据管理操作，不会自动删除云数据。产品同意不等于微信平台隐私接口授权。',
      confirmText: '同意启用',
      success: async res => {
        if (this._disposed || !isCurrent(token)) return;
        if (!res.confirm) { this.setData({ offlineMode: !service.snapshot().consent }); return; }
        try {
          const state = await service.enable();
          if (this._disposed) return;
          this.setData({ offlineMode: false, cloudFailed: false, openid: state.owner, monthSessions: 0, monthHours: '0.0', monthProgress: 0 });
          this.refreshSyncView();
          this.onClaimLocalData();
        } catch (err) {
          if (this._disposed) return;
          this.setData({ offlineMode: false, cloudFailed: true, openid: '' });
          this.refreshSyncView();
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
    this.refreshSyncView();
    return pending.then(() => {
      if (this._disposed) return;
      service.assertCurrent(token);
      const status = queue.getStatus();
      const count = status.plans.pending + status.sessions.pending;
      this.setData({ pendingCount: count, syncStatus: status, readStatus: db.getReadStatus() });
      this.refreshSyncView();
      wx.showToast({ title: status.reason || (this.data.syncIssue || this.data.syncHeadline === '待处理' ? this.data.syncSubtitle : count ? '本机记录已保存，等待云端确认' : '计划与训练同步任务已确认'), icon: 'none' });
    }).catch(() => {
      if (this._disposed) return;
      this.refreshSyncView();
      if (!isCurrent(token)) return;
      wx.showToast({ title: '同步未确认，请检查云服务状态后重试', icon: 'none' });
    });
  },

  onSyncDetails() {
    wx.showModal({ title: '同步详情',
      content: `${this.data.syncSubtitle}。本机记录仍保留。可稍后重试；若持续未完成，请通过「关于 → 隐私说明与公开支持」联系维护者。不要为解决同步问题清除本机记录。`,
      showCancel: false });
  },

  onShowLoginInfo() {
    wx.showModal({
      ...(this.data.theme === 'light' ? { confirmColor: '#3E5429' } : {}),
      title: '登录状态',
      content: this.data.openid
        ? '已连接本人云服务，使用微信身份同步，不采集头像昵称。'
        : '仅本地模式或身份获取失败。开启云同步可启用云服务；失败后请点「重试云服务」，不影响本地训练。',
      showCancel: false,
    });
  },

  onClaimLocalData: require('../../utils/claim-local-data'),

  onOpenDataManagement() { wx.navigateTo({ url: '/pages/data-management/data-management' }); },

  onOpenHelp(e) {
    const section = e.currentTarget.dataset.section;
    if (!['privacy', 'data', 'help'].includes(section)) return;
    wx.navigateTo({ url: `/pages/help/help?section=${section}` });
  },

}));
