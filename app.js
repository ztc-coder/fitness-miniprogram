// 应用入口：初始化自己的云开发环境，静默 openid 登录；未配置时禁用云能力并保持本地可用。
const { applyTheme } = require('./utils/theme');

App({
  onLaunch() {
    applyTheme();
    const service = require('./utils/cloud-service');
    const issues = service.configIssues();
    if (issues.length) {
      // 硬拦截：没填自己的环境之前不初始化云、不恢复旧同意，也不做任何云跳转。
      if (typeof wx.showModal === 'function') {
        wx.showModal({
          title: '云能力已禁用',
          content: [
            '本机还没配置自己的微信云环境，云同步与远程动作媒体不会启用；本地训练、计划、历史与动作库照常可用。',
            '',
            issues.join('\n'),
            '',
            '填好 config/cloud-env.js 与 project.config.json 后重启即可。步骤见 README「部署配置」。',
          ].join('\n'),
          showCancel: false,
        });
      }
      return Promise.resolve(service.snapshot());
    }
    return service.restore().then(state => {
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
