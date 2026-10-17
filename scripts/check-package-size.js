#!/usr/bin/env node
/** 按打包排除规则统计源码体积；不编译、不上传，不等同于微信编译后包体。 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LIMIT = 2 * 1024 * 1024;
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'));
const options = config.packOptions || {};

if ((options.include || []).length || (config.miniprogramRoot && config.miniprogramRoot !== './')) {
  throw new Error('打包目录或 include 已变化，请同步更新包体检查。');
}

const rules = (options.ignore || []).map(({ type, value }) => {
  const normalized = value.replace(/^\//, '').replace(/\/$/, '');
  if (type === 'folder') return (file) => file === normalized || file.startsWith(normalized + '/');
  if (type === 'file') return (file) => file === normalized;
  if (type === 'suffix') return (file) => file.endsWith(value);
  throw new Error(`未支持的打包排除类型：${type}`);
});

// 微信默认不打包版本库与 node_modules；其他开发文件由项目显式排除。
const ignored = (file) => /(^|\/)(\.git|node_modules)(\/|$)/.test(file) || rules.some((match) => match(file));
const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(path.join(ROOT, directory), { withFileTypes: true })) {
    const file = path.posix.join(directory, entry.name);
    if (ignored(file)) continue;
    if (entry.isSymbolicLink()) throw new Error(`包内不应包含符号链接：${file}`);
    if (entry.isDirectory()) walk(file);
    else files.push({ file, size: fs.statSync(path.join(ROOT, file)).size });
  }
}
walk('');

const total = files.reduce((sum, item) => sum + item.size, 0);
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ total, limit: LIMIT, files }));
  process.exit(total > LIMIT ? 1 : 0);
}
const groups = new Map();
for (const { file, size } of files) {
  const group = file.includes('/') ? file.split('/')[0] + '/' : '(root)';
  groups.set(group, (groups.get(group) || 0) + size);
}
for (const [group, size] of [...groups].sort((a, b) => b[1] - a[1])) {
  console.log(`${(size / 1024).toFixed(1).padStart(8)} KiB  ${group}`);
}
console.log(`打包候选源码：${total} bytes / ${(total / 1024).toFixed(1)} KiB，${files.length} 个文件`);
console.log(`2 MiB 预算剩余：${((LIMIT - total) / 1024).toFixed(1)} KiB`);
if (total > LIMIT) {
  console.error('FAIL：源码超过 2 MiB；请清理资源或调整打包范围。');
  process.exitCode = 1;
} else {
  console.log('PASS：源码低于 2 MiB；最终包体以微信开发者工具代码包分析为准。');
}