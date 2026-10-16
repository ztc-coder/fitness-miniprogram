// 应用入口:初始化云开发环境,静默 openid 登录,打开即用
const { applyTheme } = require('./utils/theme');
const queue = require('./utils/queue');

const ENV_ID = 'cloud1-d2ga0mned4bbf9b29'; // 云开发环境 ID

App({
  onLaunch() {
    applyTheme();
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: ENV_ID,
      traceUser: true,
    });

    // 静默 openid 登录,无登录墙
    wx.cloud
      .callFunction({ name: 'login' })
      .then((res) => {
        this.globalData.openid = (res.result && res.result.openid) || '';
      })
      .catch((err) => {
        console.warn('openid 登录失败,不影响本地训练记录', err);
      });

    // 网络恢复时自动重试待提交队列
    queue.watchNetwork();
  },

  globalData: {
    openid: '',
    activeTraining: null, // 进行中的训练草稿(供跨页共享)
  },
});
