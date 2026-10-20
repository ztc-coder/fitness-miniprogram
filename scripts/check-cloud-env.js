#!/usr/bin/env node
// 仅检查部署配置，不构建、不部署、不连接云；不能代替人工核对控制台归属与权限。
const fs = require('fs');
const path = require('path');
const config = require('../config/cloud-env');
const {
  getCloudIssues,
  getMediaNotices,
  isAppIdLike,
  isLegacyMediaRoot,
  text,
} = require('../utils/cloud-env');

function readProjectAppId() {
  const projectPath = path.join(__dirname, '..', 'project.config.json');
  const raw = fs.readFileSync(projectPath, 'utf8');
  return text(JSON.parse(raw).appid);
}

function collect(projectAppId) {
  const issues = getCloudIssues(config, { appId: projectAppId });
  const configuredAppId = text(config.appId);
  if (!projectAppId) {
    issues.push('appId：project.config.json 的 appid 为空，需填自己的小程序 AppID');
  } else if (!isAppIdLike(projectAppId)) {
    issues.push('appId：project.config.json 的 appid 不像小程序 AppID（wx + 16 位十六进制）');
  }
  if (configuredAppId && !isAppIdLike(configuredAppId)) {
    issues.push('appId：config/cloud-env.js 的 appId 不像小程序 AppID（wx + 16 位十六进制）');
  }
  if (configuredAppId && projectAppId && configuredAppId !== projectAppId) {
    issues.push('appId：config/cloud-env.js 与 project.config.json 的 appid 不一致');
  }
  if (isLegacyMediaRoot(config.mediaRoot)) {
    issues.push('mediaRoot：仍指向原运营者存储桶，会误连他人存储');
  }
  return { issues, notes: getMediaNotices(config) };
}

function main() {
  let projectAppId;
  try {
    projectAppId = readProjectAppId();
  } catch (err) {
    console.error('发布阻断：无法读取 project.config.json 的 appid\n- ' + (err && err.message ? err.message : err));
    process.exitCode = 1;
    return;
  }
  const { issues, notes } = collect(projectAppId);
  notes.forEach(note => console.log('提示：' + note));
  if (issues.length) {
    console.error('发布阻断：部署配置未填写自己的值\n' + issues.map(issue => '- ' + issue).join('\n'));
    console.error('填好 config/cloud-env.js 与 project.config.json 后重跑；这只查配置，不代表云环境已可用。');
    process.exitCode = 1;
    return;
  }
  console.log('部署配置检查通过；仍需在控制台核对环境归属、权限与配额，不代表整体验收或正式可发布。');
}

main();

module.exports = { collect, readProjectAppId };
