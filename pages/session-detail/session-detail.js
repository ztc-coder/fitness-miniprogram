/**
 * 训练快照详情:忠实展示当次 session 的独立副本,不受后续计划修改影响
 */
const db = require('../../utils/db');
const domain = require('../../utils/domain');
const fmt = require('../../utils/format');

Page({
  data: {
    session: null,
    exercises: [],
    totalVolume: '',
    duration: '',
    dateLine: '',
  },

  onLoad(options) {
    db.fetchSessions(50).then((sessions) => {
      const s = sessions.find((item) => (item._id || item.id) === options.id);
      if (!s) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 600);
        return;
      }
      const durationSec = Math.max(0, Math.round(((s.submittedAt || Date.now()) - s.startedAt) / 1000));
      this.setData({
        session: s,
        dateLine: fmt.formatDateLine(s.submittedAt || s.startedAt),
        totalVolume: fmt.formatNumber(domain.computeSessionTotalVolume(s)),
        duration: fmt.formatDuration(durationSec),
        exercises: (s.exercises || []).map((ex) => ({
          name: ex.name,
          skipped: !!ex.skipped,
          isBodyWeight: domain.isBodyWeight(ex),
          volume: domain.computeVolume(ex),
          sets: (ex.sets || []).map((set, i) => ({
            num: i + 1,
            text: `${set.weight || 0} kg × ${set.reps || 0}`,
          })),
        })),
      });
    });
  },
});
