// 静默 openid 登录:无登录墙,打开即用
const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  if (typeof wxContext.OPENID !== 'string' || !wxContext.OPENID.trim()) {
    throw new Error('缺少可信微信身份');
  }
  return { openid: wxContext.OPENID };
};
