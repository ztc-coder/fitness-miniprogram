// 部署配置：默认全部为空 = 未配置。
// 空值不是"能用但没换"，也不是可以忽略的占位：启动时会禁用云能力并弹窗说明，
// 本地训练、计划、历史与动作库照常可用（与未同意时的边界一致）。
//
// 自行部署者要改的就是下面 DEPLOY 的三个字面量（写成普通字符串，不要设环境变量——
// 小程序运行时没有 process.env，只有 CI/测试才用得到环境变量覆盖）。
//   - appId：自己的小程序 AppID，须与 project.config.json 的 appid 一致（可留空，以工程配置为准）；
//   - envId：自己的云开发环境 ID，缺失或仍是原运营者环境时云同步不可用；
//   - mediaRoot：自己有权使用的存储桶根或 HTTPS 前缀，可留空（运行时媒体降级为占位）。
const DEPLOY = {
  appId: '',
  envId: '',
  mediaRoot: '',
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
