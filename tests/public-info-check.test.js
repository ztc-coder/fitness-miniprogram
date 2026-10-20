const { spawnSync } = require('child_process');
const path = require('path');

/**
 * 结论必须与当前仓库配置一致：配置缺项时退出 1 并逐项指出阻断点，
 * 资料齐全时退出 0。断言不写死"当前是空的"或"当前是齐的"，
 * 因此填真实资料前后都成立，不会因配置变更而假红。
 */
test('检查脚本结论与当前配置一致：缺项退出 1 并逐项指出，齐全退出 0', () => {
  const info = require('../config/public-info');
  const { getPublicInfoIssues } = require('../utils/public-info');
  const issues = getPublicInfoIssues(info);
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/check-public-info.js')], { encoding: 'utf8' });
  if (issues.length === 0) {
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('公开资料配置检查通过');
    expect(result.stderr).toBe('');
  } else {
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('发布阻断');
    issues.forEach(issue => expect(result.stderr).toContain(issue.split('：')[0]));
  }
  expect(result.stderr).not.toContain('antiResurrection');
});

test('占位政策不能通过，完整配置仍须人工核实；核实标记只表示本项不阻断', () => {
  const { getPublicInfoIssues } = require('../utils/public-info');
  const fixture = {
    operatorName: '测试运营者',
    privacyContact: { label: '邮箱', value: 'privacy@example.com' },
    supportContact: { label: '邮箱', value: '' },
    antiResurrection: { scope: '待确认', retention: '占位' },
    verified: true,
  };
  expect(getPublicInfoIssues(fixture)).toHaveLength(4);
  const complete = {
    operatorName: 'Fixture Operator',
    privacyContact: { label: 'Email', value: 'privacy@fixture.invalid' },
    supportContact: { label: 'Email', value: 'support@fixture.invalid' },
    antiResurrection: { scope: 'Identity and deletion generation only', retention: 'Retained while obsolete writes must be rejected; reviewed on service shutdown' },
    verified: false,
  };
  expect(getPublicInfoIssues(complete)).toEqual(['verified：第06票尚未人工核实真实资料及渠道可达']);
  expect(getPublicInfoIssues({ ...complete, verified: true })).toEqual([]);
});
