#!/usr/bin/env node
// 仅检查，不构建、不部署；不能代替第06票人工核实。
const info = require('../config/public-info');
const { getPublicInfoIssues } = require('../utils/public-info');
const issues = getPublicInfoIssues(info);
if (issues.length) {
  console.error(`发布阻断：公开隐私/支持资料未齐\n${issues.map(issue => `- ${issue}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('公开资料配置检查通过；不代表整体验收或正式可发布。');
}
