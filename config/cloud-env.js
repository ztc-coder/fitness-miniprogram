// 部署配置：默认全部为空 = 未配置。
// 空值不是"能用但没换"，也不是可以忽略的占位：启动时会禁用云能力并弹窗说明，
// 本地训练、计划、历史与动作库照常可用（与未同意时的边界一致）。
// 自行部署者必须在这里填自己的值，步骤见 README「安全起点」与 docs/independent-deployment.md 第 1 节：
//  - appId：自己的小程序 AppID，须与 project.config.json 的 appid 一致（可留空，以工程配置为准）；
//  - envId：自己的云开发环境 ID，缺失或仍是原运营者环境时云同步不可用；
//  - mediaRoot：自己有权使用的存储桶根或 HTTPS 前缀，可留空（运行时媒体降级为占位）。
// 环境变量覆盖仅供 CI 与自动化测试注入；小程序运行时没有 process.env，条件保护后回落空值。
const env = (typeof process !== 'undefined' && process.env) || {};

module.exports = {
  appId: env.FITNESS_CLOUD_APPID || '',
  envId: env.FITNESS_CLOUD_ENV_ID || '',
  mediaRoot: env.FITNESS_CLOUD_MEDIA_ROOT || '',
};
