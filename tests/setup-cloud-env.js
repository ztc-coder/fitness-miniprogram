// jest setupFiles：给测试进程注入一套"已部署"的云配置，
// 免得每条用例都去改 config/cloud-env.js。用 process.env 是因为大量用例会
// jest.resetModules()，模块内状态无法跨重载保留；部署者真实部署时仍然只改配置文件。
// 这些值是测试专用的假环境，与仓库里填的项目真实值区分开即可。
process.env.FITNESS_CLOUD_APPID = 'wx0000000000000000';
process.env.FITNESS_CLOUD_ENV_ID = 'test-env-id';
process.env.FITNESS_CLOUD_MEDIA_ROOT = 'cloud://test-env-id.636c-test-env-id-1234567890';
