const { spawnSync } = require('child_process');
const path = require('path');

test('未提供真实公开资料时检查以失败退出并逐项指出发布阻断', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/check-public-info.js')], { encoding: 'utf8' });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('operatorName');
  expect(result.stderr).toContain('privacyContact');
  expect(result.stderr).toContain('supportContact');
  expect(result.stderr).toContain('antiResurrection');
  expect(result.stderr).toContain('发布阻断');
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
