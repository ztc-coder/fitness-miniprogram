// 部署配置：本项目为个人项目，这里填的就是本项目自己的值。
// envId 留空 = 未配置：启动会禁用云能力并弹窗说明，本地训练、计划、历史与动作库照常可用。
//
// 小程序运行时没有 process.env，只有 CI/测试才用得到环境变量覆盖（见文件末尾）。
//   - appId：本项目的小程序 AppID，须与 project.config.json 的 appid 一致（可留空，以工程配置为准）；
//   - envId：本项目的云开发环境 ID，留空时云同步不可用；
//   - mediaRoot：本项目有权使用的存储桶根或 HTTPS 前缀，可留空（运行时媒体降级为占位）。
const DEPLOY = {
  appId: 'wxa884033ad71b4514',
  envId: 'cloud1-d2ga0mned4bbf9b29',
  mediaRoot: 'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720',
};

// 环境变量覆盖仅供 CI 与自动化测试注入，优先级高于上面的字面量。
// 显式设成空字符串（而不是不设）表示"明确未配置"，用于测试覆盖已填好字面量的情况；
// 只有完全没设（undefined）时才回落到上面的字面量。
const env = (typeof process !== 'undefined' && process.env) || {};
const pick = (override, literal) => (override === undefined ? literal : override);

module.exports = {
  appId: pick(env.FITNESS_CLOUD_APPID, DEPLOY.appId),
  envId: pick(env.FITNESS_CLOUD_ENV_ID, DEPLOY.envId),
  mediaRoot: pick(env.FITNESS_CLOUD_MEDIA_ROOT, DEPLOY.mediaRoot),
};
