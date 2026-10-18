# 第05票：独立部署与发布专项验收证据

**结论：open / ready-for-human / Blocked，不是 done。** 文档和本地检查已交付，真实双身份/设备、独立云规则/SDK及最终编译包体验证均未进行。两个P1聚焦修复仍由另一代理处理（data-management / personal-cloud / me / 删除测试）；本票不重复修复。最终合并后须重新跑完整运行证据及最终双轴审查，不能宣称发布范围无 P0–P2。

## 版本、环境和实际结果

- 实际检查日期取自 `date -u '+%Y-%m-%dT%H:%M:%SZ'`：2026-10-18T01:34:13Z 至 2026-10-18T01:35:37Z（后续文档回归见下）。不是手填固定“当前日期”。
- `git rev-parse HEAD`：`4d645c99f6d01566b5989a15c52bb172b07fb96e`，即03集成源码基线；文档改动位于此基线之上，不包含后续P1修复。
- 分配 worktree 初始 detached HEAD、clean；建立文档分支 `docs/ticket05-deploy-acceptance`，未改变共享主目录。`git rev-parse feat/public-release` 与 `git merge-base HEAD feat/public-release` 在01:35:37Z均为上述SHA，确认当前基线就是当时集成 tip。交付前再核对，若父分支随后前进，本结果不自动覆盖新 tip。
- Darwin 隔离 worktree；`node --version` = `v22.22.3`；`npm --version` = `10.9.8`。无本 worktree node_modules，借用已安装 Jest 可执行路径运行本 worktree源码；未安装依赖、未请求云或媒体、未生产构建、未push。

| 实际命令 | 结果与证据范围 | 原始本机日志（临时，不承诺他人可访问） |
|---|---|---|
| `PATH="/Users/ztc/fitness-miniprogram/node_modules/.bin:$PATH" npm test -- --runInBand --silent` | exit0；41套通过，564通过/29既有skip/593总计，无snapshot；3.65s。wx/云/存储模拟结果，不是真实云/设备 | `/tmp/ticket05-tests.log` |
| `npm run check:package` | exit0；1,212,695 bytes，87文件，低于2MiB；仅候选源码估算 | `/tmp/ticket05-package.log` |
| `npm run check:public-info` | **exit1，预期Blocked**；operatorName、privacyContact、supportContact、verified四项缺失/未核实；不伪造成功 | `/tmp/ticket05-public-info.log` |
| 下列静态循环 | exit0；全部95个跟踪JS语法检查、19个跟踪JSON解析通过 | 本节稳定计数 |
| `git diff --check` | exit0；无空白错误 | 本节 |
| `git ls-files '*LICENSE*' '*license*'` | 无输出；根LICENSE缺失，不代表第三方无许可要求 | 维护者决定授权，未补造LICENSE |

可复现静态检查（只读文件；不执行业务JS）：

```bash
node <<'NODE'
const fs = require('fs'), cp = require('child_process');
const files = cp.execSync('git ls-files -z').toString().split('\0').filter(Boolean);
let js = 0, json = 0;
for (const file of files) {
  if (file.endsWith('.js')) { cp.execFileSync(process.execPath, ['--check', file]); js++; }
  if (file.endsWith('.json')) { JSON.parse(fs.readFileSync(file, 'utf8')); json++; }
}
console.log(`PASS tracked JS syntax: ${js}; JSON parse: ${json}`);
NODE
git diff --check
git rev-parse HEAD feat/public-release
git merge-base HEAD feat/public-release
```

没有新增检查器或功能测试：本票只改文档，不为凑数新增 mock 验收。现有相关边界回归包括 consent-owner、personal-cloud、durable-sync、data-deletion、public-info-check/public-help-page、training/records/theme/media 系列；全量通过不表示每个真实场景已验收。

## 真实验收前置与证据格式

先完成 [独立部署指南](independent-deployment.md) 三项配置替换及隔离规则，得到另行明确测试授权。当前没有隔离环境、真实身份、设备、可用稳定URL/设计数据或最终编译包，以下**每行真实结果均为 Blocked/未执行**，绝非测试通过清单。

每条未来执行记录至少包含：用例ID、UTC日期、源码完整SHA/云函数部署版本/实际SDK及运行时、自己的脱敏环境标识、规则/索引快照、A/B身份的受控别名、设备OS/微信/基础库/开发者工具版本、步骤、预期/实际结果、脱敏截图及请求/错误证据路径、执行人。不得把真实openid、生产数据、私密联系方式或token提交仓库。失败保留原始证据，不放开规则救测试。

## 父规格全部场景与专项矩阵

“本地线索”仅帮助定位自动测试，不能作为真实结果；每行末列须人工填入实际结果后才可改变。

| ID / 父场景 | 独立环境操作与接受判据 | 本地线索（均非真实证明） | 真实结果 |
|---|---|---|---|
| M01 未同意/拒绝/旧无同意安装 | 清测试安装存储，拒绝产品同意；建计划→逐组→结束→历史；记录请求，身份/同步/媒体预热与图片GIF请求均为0，训练可用 | consent-owner、training | Blocked |
| M02 主动同意与重启 | 先显示用途/归属，再主动同意；匿名计划/成绩数量可查，取消认领不迁移；重启恢复明确同意，网络监听不重复 | consent-owner | Blocked |
| M03 身份失败/身份不匹配 | 模拟真实函数失败、空身份；保留本地，显示失败不报同步成功；A→B或未知身份冷启动不显示/上传A缓存、草稿、任务；不自动认领匿名旧数据 | consent-owner、personal-cloud | Blocked |
| M04 真实A/B隔离 | 两个真实微信身份分别建同逻辑ID计划/成绩；list只本人。B猜A实际文档ID及logicalID执行读/set/remove/deleteAll，或伪造owner/_openid参数，不能改删A；A删除不影响B | personal-cloud、data-deletion 的模拟A/B | Blocked |
| M05 缺身份/旧版本协议/客户端直写 | 从真实小程序调用链核查无可信身份被拒（控制台调用不冒充微信身份）；旧无版本add/update、旧generation/revision写被拒；分别对三个集合直接query/get/add/set/update/remove均拒绝；管理RPC正常，保存规则/请求证据 | personal-cloud、规则JSON | Blocked |
| M06 离线完成→联网 | 断网开练逐组/完成，持久成绩/队列；杀进程重开并联网手动/自动重试；一条场次、只推进一次游标，状态从待同步到对应确认后的成功 | durable-sync、training-submission | Blocked |
| M07 计划编辑/删除失败→重启 | 离线建/改/删，重启保留任务/墓碑；联网收敛；旧云读不能盖未确认编辑或回退revision；过期冲突保留待处理，不支持并发编辑 | durable-sync、personal-cloud | Blocked |
| M08 超单页数据/中断读取 | 建超过SDK单页的计划及历史，逐页比总数、顺序与统计；中间页断网，保留本地与未同步修改、标未完整；删除中拒部分列表 | durable-sync、session-history-read、data-deletion | Blocked |
| M09 响应丢失/重复提交 | 服务端成功后丢客户端响应，重启/重复flush；只有一条成绩/一次游标；旧版已成功场次相同快照确认，不改写，不同快照拒绝 | personal-cloud、durable-sync | Blocked |
| M10 撤回同意 | 同步/媒体请求在途时撤回，不再发新身份/同步/媒体；旧响应不回写UI/缓存，保留本地云端数据；在途可能已执行，不宣称取消云请求 | data-deletion | Blocked |
| M11 清本机 | 离线且有草稿/未同步数据，二次确认明确损失；清全部身份与匿名训练/草稿/任务/同步状态，保留主题单位并撤回同意；旧页面/任务不回写；明确云端保留，再同意可能下载 | data-deletion | Blocked |
| M12 全部删除失败/中断/重试 | 删除专用身份授权不启常规上传；显示本人/二次确认。断网、云中断、响应丢失、本机清理失败都不报假成功；稳定operationId幂等重试；云确认后才清当前owner本机，其他owner/匿名及B数据不动 | data-deletion | Blocked |
| M13 删除在途写/迟到worker | 控制A旧写与delete开始/物理清理/finalize交错；所有写争同owner事务锁；旧写不能复活、迟到删除worker不能删新代际数据；删除中读取不显示半份列表 | data-deletion、真实事务待核 | Blocked |
| M14 删除后旧设备/旧路径 | A设备1保留离线任务/草稿；设备2全删；设备1联网识别屏障、拒旧队列且不重绑generation，显式协调前不能普通访问；旧客户端直DB/旧协议同时拒绝。离线缓存不能被远程即时物理擦除 | data-deletion | Blocked |
| M15 删除后新建/元数据披露 | 完成删除后停云，主动同意/协调后新建正常同步；元数据字段及服务存续期策略与实际一致，不承诺全技术痕迹消失；B和公共媒体不受影响 | data-deletion、public-help-page | Blocked |
| M16 新用户演示计划 | 新测试安装种入示例，无他人记录，可编辑删除；认领需明确确认，未知代际匿名数据不暗迁移 | consent-owner、db | Blocked |
| M17 真机核心流程/历史游标 | 计划→训练→完成→历史；修改计划不改历史快照，取消/漏练不推进，负重容量与自重次数分开；暂停/继续/冷启动恢复不重复完成 | domain、training、records | Blocked |
| M18 间歇/声音/振动 | 真机前后台/静音/锁屏、暂停/独立暂停/继续、取消勾选及编辑成绩；休息提示与倒计时正确，记录不中断；记录OS限制，不承诺后台准点提醒 | training-flow | Blocked |
| M19 浅深主题与媒体降级 | 今天/计划/记录/我的/训练/详情/弹层/nav/tabBar两主题核对；正常媒体、断网失败、GIF失败占位，保留署名/原色且不挡训练；不以单测当视觉验收 | theme/media系列 | Blocked |
| M20 帮助/隐私/反馈/危险文案 | 与实际撤回/清本机/删除范围相符；真实运营者、权益/支持联系实测可达，后台指引核对；版权范围覆盖展示/分发，不填假资料 | public-info check 当前阻断 | Blocked |
| M21 开发者工具最终包/预览 | 记录工具/基础库/源码版本；在获得授权后检查最终编译代码包大小、依赖分析、预览及真机资源；当前1,212,695 bytes源码不代替最终包 | check:package仅估算 | Blocked |
| M22 配置/资源/平台/许可/审查 | 独立AppID/环境/ROOT、规则SDK及额度预警实收；主体备案/隐私指引/许可版权/公开渠道；最终集成后双轴只读审查、P0–P2闭环复测，人工授权具体生产版本 | 见独立指南及06票 | Blocked |

## 未关闭与交接

- 文档与本机检查可交付；05保持open/ready-for-human，真实项不得勾选。01/02/03的全局真实验收、06和父issue均不关闭。
- 等待另一个worker的两项P1合并，父代理必须在最终集成SHA上重跑测试、包体、静态、公开信息检查，并完成最终双轴审查；本票不声明最终P0–P2审查通过。
- 用户选择保留默认配置的风险被明确披露，但没有运行时强制保护；自行部署者必须先人工替换全部三项。无独立云/设备、最终编译包、媒体书面授权、真实联系人、平台材料/许可及生产操作授权，均继续阻断。

## 文档完成后的复跑与基线确认

2026-10-18T01:36:52Z（实际 `date -u`）：上述相同 `PATH=… npm test -- --runInBand --silent` 再跑 exit0，41套通过、564通过/29既有skip/593总计，耗时2.714s，日志 `/tmp/ticket05-final-tests.log`。`git diff --check` exit0。此时 `git rev-parse HEAD feat/public-release` 和 `git merge-base HEAD feat/public-release` 三个结果仍均为 `4d645c99f6d01566b5989a15c52bb172b07fb96e`，确认文档基于交付检查时的集成tip，尚未包含后续P1修复。只运行本地测试，不是最终合并后运行证据。

## 删除 P1 修复合并后的集成验证

以下覆盖上述旧基线之后的代码，不能将旧结果与本节混写：

- UTC 实际执行时间：`2026-10-18T01:41:03Z` 起；源码完整 SHA：`07a23a6915fed89334a068a53781e9d84822489a`，包含 `8c7ccf9` 删除恢复/失败本地保护修复及第05票文档。
- 主工作区 `feat/public-release`，Node `v22.22.3`、npm `10.9.8`；无额外安装。
- `npm test -- --runInBand --silent`：exit0，**41套通过，577通过、29既有跳过，共606项**；日志 `/tmp/public-release-final-tests.log`。
- `npm run check:package`：exit0，**1,217,757 bytes / 87文件**，低于2MiB，日志 `/tmp/public-release-final-package.log`。仅源码体积，未编译。
- `npm run check:public-info`：预期 exit1，仍阻断真实运营者、隐私联系、支持联系、人工 verified 四项；日志 `/tmp/public-release-final-public-info.log`。
- 全部跟踪 **95个JS语法、19个JSON解析**通过；`git diff --check` 通过；`git worktree list` 只剩主工作区，临时实施 worktree 已由工具清理，主工作区 clean（本节文档编辑前）。
- 最终双轴审查正在执行，固定起点 `f049ef5dc2951169aac2938a65d81d762b0579da`，审查源码树 `8c7ccf9` 与上述合并提交一致。未在结果返回前宣称审查通过。

本节仍只涵盖本地源码/mock与静态检查；22项真实矩阵、人工资料与授权阻断不变。
