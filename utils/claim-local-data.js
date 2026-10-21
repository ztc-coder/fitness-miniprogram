/** Shared explicit ownership confirmation; never claim on enable without consent. */
const service = require('./cloud-service');
const local = require('./owner-storage');
const queue = require('./queue');
function isCurrent(token) { try { service.assertCurrent(token); return true; } catch (err) { return false; } }
module.exports = function claimLocalData() {
  if (this._disposed || !service.ready() || this._claiming || this.data.deleting) return;
  const token = service.snapshot(), version = local.version(), life = this._life || 0;
  const alive = () => !this._disposed && (this._life || 0) === life;
  const preview = local.claimPreview();
  if (!preview.plans && !preview.sessions && !preview.drafts) return;
  this._claiming = true;
  wx.showModal({
    fail: () => { this._claiming = false; },
    title: '同步本机记录？',
    content: `当前微信身份：${preview.owner}。待归属范围：${preview.plans} 个计划、${preview.sessions} 条训练记录、${preview.drafts} 份草稿。仅在确认这些数据属于你时确认归属，之后才允许上传；取消则保留匿名区且不展示/上传。其他所有者的数据不会被认领。`,
    confirmText: '属于我',
    success: async res => {
      if (!alive() || !res.confirm || !isCurrent(token) || version !== local.version()) { this._claiming = false; return; }
      try {
        await require('./personal-cloud').generation();
        if (!alive() || !isCurrent(token) || version !== local.version()) return;
        local.claimAnonymous(preview.owner);
        wx.showToast({ title: '已确认归属；计划与训练可手动重试同步', icon: 'none' });
        queue.flush().catch(() => {});
        this.onShow();
      } catch (err) {
        if (!alive()) return;
        if (this.refreshSyncView) this.refreshSyncView();
        if (this.refreshStatus) this.refreshStatus();
        if (isCurrent(token)) {
        const message = require('./sync-feedback').reason(err);
        this.setData({ dataResult: `${message}。请保留本机记录，可查看数据管理指引或联系维护者；不要为解决同步问题清除记录。` });
        wx.showToast({ title: message, icon: 'none' });
      } }
      finally { this._claiming = false; }
    },
  });
};
