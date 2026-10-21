const service = require('../../utils/cloud-service');
const local = require('../../utils/owner-storage');
const management = require('../../utils/data-management');
const { themePage } = require('../../utils/theme');
function isCurrent(token) {
  try { service.assertCurrent(token); return true; } catch (err) { return false; }
}
function alive(page, life) { return !page._disposed && (page._life || 0) === life; }
function confirmTwice(page, title, content, action) {
  const life = page._life || 0;
  if (!alive(page, life)) return;
  page._confirming = true;
  page.setData({ deleting: true });
  const finish = () => { page._confirming = false; if (!alive(page, life)) return; page.setData({ deleting: false }); page.refreshStatus(); };
  const token = service.snapshot(), version = local.version();
  const current = () => {
    if (!alive(page, life)) return false;
    if (isCurrent(token) && version === local.version()) return true;
    page.setData({ dataResult: '身份或本机数据已变化，请重新查看范围并确认' });
    return false;
  };
  wx.showModal({ title, content, confirmText: '继续', fail: finish, success: res => {
    if (!res.confirm || !current()) { finish(); return; }
    wx.showModal({ title: '再次确认不可恢复的操作', content, confirmText: '确认执行', fail: finish, success: async result => {
      try { if (result.confirm && current()) return await action(); } finally { finish(); }
    } });
  } });
}

Page(themePage({
  data: { consented: false, serviceReady: false, pendingDeletion: false, canCheckDeletion: false, canReconcile: false, canClaim: false, localSummary: '', serviceLabel: '仅本地', dataResult: '', deleting: false },
  onShow() {
    this._disposed = false;
    if (!this._unsubscribe) this._unsubscribe = service.subscribe(() => this.refreshStatus());
    this.refreshStatus();
  },
  onUnload() { this._disposed = true; this._life = (this._life || 0) + 1; this._confirming = false; this._claiming = false; this.data.deleting = false; if (this._unsubscribe) this._unsubscribe(); this._unsubscribe = null; },
  refreshStatus() {
    if (this._disposed) return;
    const state = service.snapshot(), loss = management.preview(), preview = local.claimPreview();
    const pendingDeletion = !!management.getDeletion();
    this.setData({ consented: state.consent, serviceReady: service.ready(), pendingDeletion, canCheckDeletion: !state.owner,
      canReconcile: !!local.getStorageSync('fitness:syncBarrier') && service.ready() && !pendingDeletion,
      canClaim: service.ready() && !pendingDeletion && !local.getStorageSync('fitness:syncBarrier') && !!(preview.plans + preview.sessions + preview.drafts),
      serviceLabel: !state.consent ? '仅本地' : state.status === 'failed' ? '启用失败' : service.ready() ? '云服务已启用' : '正在连接云服务',
      localSummary: `当前本机可见 ${loss.plans} 个计划、${loss.drafts} 份进行中草稿` });
  },
  resetPrivateView() { this.refreshStatus(); },
  onClaimLocalData: require('../../utils/claim-local-data'),
  onOpenHelp() { wx.navigateTo({ url: '/pages/help/help?section=data' }); },
  onWithdrawConsent() {
    if (this._disposed || this.data.deleting) return;
    management.withdraw();
    this.resetPrivateView();
    this.setData({ dataResult: '已撤回同意，停止新增身份、同步及远程媒体请求。本地训练保留；云数据未删除，已在途请求不能取消、可能已执行。' });
  },

  onClearLocal() {
    if (this._disposed || this.data.deleting) return;
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
    if (this._disposed || this.data.deleting) return;
    const life = this._life || 0;
    this.setData({ deleting: true, dataResult: '仅为删除校验本人身份，不开启同步或上传本地数据…' });
    try {
      const token = await management.authorizeDeletion();
      if (!alive(this, life) || !isCurrent(token)) return;
      const loss = management.preview();
      confirmTwice(this, '删除本人全部个人数据？',
        `当前本人身份：${token.owner}。将联网删除本人云计划和历史，确认完成后才清除此身份本机的计划、历史、${loss.drafts} 份进行中草稿、${loss.pending} 项待同步任务。不会清除其他身份或匿名区，不影响公共媒体。保留主题和单位，撤回同意；本次联网仅用于删除。已在途请求不能取消，离线设备不能即时远程擦除，下次联网才识别屏障。失败需重试，不代表已删除。`, async () => {
          this.setData({ deleting: true, dataResult: '删除中；尚未确认完成，请勿视为已删除' });
          const result = await management.deleteAll(token);
          if (!alive(this, life)) return;
          this.resetPrivateView();
          this.setData({ deleting: false, dataResult: result.status === 'deleted'
            ? '本人云端删除已确认，当前身份本机数据已清除；偏好保留、同意已撤回。其他离线设备无法即时擦除，必要防复活技术元数据仍保留。'
            : (result.message || '删除尚未确认，请重新确认并重试') });
        });
    } catch (err) { if (alive(this, life)) this.setData({ dataResult: `删除授权失败：${err.message}；本机未清理，可重试` }); }
    finally { if (alive(this, life)) { if (!this._confirming) this.setData({ deleting: false }); this.refreshStatus(); } }
  },

  async onCheckDeletion() {
    if (this._disposed || this.data.deleting || service.snapshot().owner) return;
    const life = this._life || 0;
    this.setData({ deleting: true, dataResult: '仅为检查删除校验本人身份，不开启同步或上传本地数据…' });
    try {
      const token = await management.authorizeDeletion();
      if (!alive(this, life) || !isCurrent(token)) return;
      this.refreshStatus();
      this.setData({ dataResult: management.getDeletion() ? '发现本机未完成的删除，请选择继续处理' : '未发现本机待处理的删除' });
    } catch (err) { if (alive(this, life)) this.setData({ dataResult: '检查未完成，请联网后重试' }); }
    finally { if (alive(this, life)) this.setData({ deleting: false }); }
  },

  async onRecoverDeletion() {
    if (this._disposed || this.data.deleting) return;
    const life = this._life || 0;
    this.setData({ deleting: true, dataResult: '检查云端当前删除任务；尚未清理本机…' });
    try {
      const token = await management.authorizeDeletion();
      if (!alive(this, life) || !isCurrent(token)) return;
      const inspection = await management.inspectDeletion(token);
      if (!alive(this, life)) return;
      const loss = management.preview();
      confirmTwice(this, '处理本机旧数据？',
        `当前本人身份：${token.owner}。另一设备已完成删除，本机旧数据仍需处理。不会复用旧完成结果，不会删除当前云端新数据。仅放弃当前身份本机 ${loss.plans} 个计划、历史、${loss.drafts} 份进行中草稿、${loss.pending} 项待同步任务及旧删除任务，采用当前代际。不会清除其他身份或匿名区，保留偏好、保持停云；取消则保留本机。执行前将再次联网核实。已在途请求不能取消，其他离线设备不能即时擦除，必要防复活技术元数据仍保留。`, async () => {
          this.setData({ deleting: true });
          const result = await management.recoverDeletion(inspection);
          if (!alive(this, life)) return;
          if (!result.scope || !isCurrent(result.scope)) { this.setData({ deleting: false }); return; }
          this.resetPrivateView();
          this.setData({ deleting: false, dataResult: result.status === 'recovered'
            ? '已协调当前身份本机；当前云任务完成已核实，未执行新一轮云删除。其他身份及匿名区保留，云服务仍停用。'
            : `协调未完成：${result.message}；请重新检查，不代表已清理` });
        });
    } catch (err) { if (alive(this, life)) this.setData({ dataResult: `检查未完成：${err.message}` }); }
    finally { if (alive(this, life)) { if (!this._confirming) this.setData({ deleting: false }); this.refreshStatus(); } }
  },

  onReconcile() {
    if (this._disposed || this.data.deleting) return;
    const life = this._life || 0;
    confirmTwice(this, '确认重新使用云同步？',
      '云端删除完成后，清除当前身份本机残留的计划、历史、草稿和任务，再采用新代际。旧任务不会改绑重传，其他身份及匿名区不受影响。需要先主动同意云服务；此操作不恢复已删数据。', async () => {
        try { await management.reconcile(); if (!alive(this, life)) return; this.resetPrivateView(); this.setData({ dataResult: '已采用当前代际，可主动新建数据并同步' }); }
        catch (err) { if (alive(this, life)) this.setData({ dataResult: err.message }); }
      });
  },

}));
