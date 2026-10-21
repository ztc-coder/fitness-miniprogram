/** Allowlisted user-facing reasons; never render raw SDK messages or record identifiers. */
function reason(error) {
  const message = typeof error === 'string' ? error : [error && error.message, error && error.errMsg].filter(value => typeof value === 'string').join('\n');
  if (/FUNCTIONS?_NOT_FOUND|FunctionName parameter could not be found|Function not found:/i.test(message)) return '云同步服务尚未配置，请联系维护者';
  if (/当前微信已有记录，不能直接加入/.test(message)) return '当前微信已有记录，不能直接加入；两份记录均已保留';
  if (/请先重试删除|有未完成的删除/.test(message)) return '有未完成的删除，请到数据管理继续';
  if (/删除屏障|协调本机数据|删除后的本机数据/.test(message)) return '删除后的本机数据需确认，请到数据管理查看';
  if (/匿名数据属于旧代际/.test(message)) return '本机记录属于删除前的数据，已保留；请联系维护者';
  if (/版本已过期或计划已删除/.test(message)) return '云端计划已变化，本机修改已保留，请联系维护者';
  return '同步未完成，可查看详情';
}
module.exports = { reason };
