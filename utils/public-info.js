// 配置与页面、发布检查共用的纯数据接口；不代表法律审核或渠道可达验证。
function isRealText(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    !/待[填补确认提供核实]|占位|示例|example\.(com|org|net)|todo|placeholder|xxx|测试/i.test(value);
}

function getPublicInfoIssues(info) {
  const issues = [];
  if (!isRealText(info.operatorName)) issues.push('operatorName：缺少真实运营者');
  ['privacyContact', 'supportContact'].forEach(key => {
    const contact = info[key] || {};
    if (!isRealText(contact.label) || !isRealText(contact.value)) issues.push(`${key}：缺少真实公开渠道名称及联系方式`);
  });
  const metadata = info.antiResurrection || {};
  if (!isRealText(metadata.scope) || !isRealText(metadata.retention)) issues.push('antiResurrection：第03票须提供最小技术元数据范围及保存策略');
  if (info.verified !== true) issues.push('verified：第06票尚未人工核实真实资料及渠道可达');
  return issues;
}

module.exports = { getPublicInfoIssues, isRealText };
