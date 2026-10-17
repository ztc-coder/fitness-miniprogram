// 应用入口:初始化云开发环境,静默 openid 登录,打开即用
const { applyTheme } = require('./utils/theme');


App({
  onLaunch() {
    applyTheme();
    return require('./utils/cloud-service').restore().then(state => {
      if (!state.owner || !state.consent || typeof wx.reLaunch !== 'function') return;
      const pending = require('./utils/owner-storage').claimPreview();
      const page = pending.plans || pending.sessions || pending.drafts ? 'me' : 'today';
      wx.reLaunch({ url: `/pages/${page}/${page}` });
    }).catch(err => {
      console.warn('云服务未启用，本地训练仍可用', err);
    });
  },

  globalData: {
    openid: '',
    activeTraining: null, // 进行中的训练草稿(供跨页共享)
  },
});
