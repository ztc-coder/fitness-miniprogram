# 动作库扩容精确 ID 提案（已冻结）

> **状态：已按用户最终授权冻结（2026-09-19）。** 本文件只记录最终白名单、策展元数据与迁移影响；
> 实现、迁移与验收拆到 `.scratch/catalog-expansion/`（`issue.md` + `issues/01..05`）。本文件不改 catalog/spec/tests/CONTEXT。
>
> **最终数量公式：`104 − 2 + 34 = 136` 条**（当前 104 条精选目录，删除 2 条，新增与恢复 34 条）。
>
> **范围与约束**：最终 136 条，全部使用上游 `hasaneyldrm/exercises-dataset` 实际四位 ID，
> 禁止按英文名自动映射重名条目；无法确认的字段写 `Unknown`。每条最终动作必须有上游 JPEG 与 GIF，
> 路径形态为 `exercises/images/<id>-<token>.jpg`、`exercises/videos/<id>-<token>.gif`。
> 真实 CloudBase 媒体同步与微信开发者工具渲染留待后续人工验收，本文件不声称完成。
>
> **最短可验证步骤**：
> 1. 按 A/B 确认最终 136 条 ID 与逐条元数据（A 保留 102 + B.1 正式新增 28 + B.2 追加新增 6）；
> 2. 按 D/E 确认 2 条删除与 9 条严格排除；
> 3. 按 F 落地 mode/tag/name/aliases 全量修正，按 G 复核数量与模式分布；
> 4. 按 H 扩 `TARGET_WHITELIST`，按 I 升 v3 迁移（无 replacement）；
> 5. 实现票 01→05 依次执行；最终由人工在真实 CloudBase 与微信开发者工具验收。

---

## A. 当前 104 条逐条复审（保留 102 条）

**结论口径**：
- **保留**：动作有独立训练价值，或代表常见器械/难度替代；必要时只改名称、mode、tags、aliases。
- **保留（热身）**：热身/激活有独立发现价值，另加 `warm-up` 标签；仍须与胸、背、肩、腿、臀或腰腹标签重叠。
- **删除**：仅 `0200`、`0673` 两条，见 E。

| ID | 当前 nameZh | 结论 | 修正 |
|---|---|---|---|
| 0019 | 辅助肱三头肌臂屈伸 (跪姿) | 保留 | tags=`[triceps]`、compound；aliases 加“辅助臂屈伸”。 |
| 0025 | 杠铃卧推 | 保留 | 无。 |
| 0027 | 杠铃俯身划船 | 保留 | 无。 |
| 0030 | 杠铃窄距卧推 | 保留 | aliases 加“窄距卧推”；mode 保持 `horizontal-push`。 |
| 0031 | 杠铃弯举 | 保留 | 无。 |
| 0032 | 杠铃硬拉 | 保留 | tags=`[legs,back,glutes]`；保持 `hip-hinge`。 |
| 0042 | 杠铃前蹲 | 保留 | 无。 |
| 0043 | 杠铃深蹲 | 保留 | 无。 |
| 0046 | 杠铃哈克深蹲 | 保留 | 无。 |
| 0047 | 杠铃上斜卧推 | 保留 | 无。 |
| 0060 | 仰卧臂屈伸 | 保留 | 无。 |
| 0085 | 罗马尼亚硬拉 | 保留 | 无。 |
| 0088 | 杠铃坐姿提踵 | 保留 | 重名组中按 ID 保留 0088，不按 name 反查。 |
| 0091 | 杠铃坐姿过头推举 | 保留 | aliases 加“坐姿杠铃推肩”。 |
| 0092 | 杠铃过头臂屈伸 | 保留 | aliases 加“杠铃颈后臂屈伸”。 |
| 0117 | 杠铃相扑硬拉 | 保留 | 无。 |
| 0120 | 杠铃直立划船 | 保留 | mode=`upright-row`；不归 `vertical-push`。 |
| 0165 | 绳索锤式弯举 | 保留 | aliases 加“绳索绳柄锤式弯举”。 |
| 0171 | 绳索上斜飞鸟 | 保留 | mode 改 `chest-fly`；tags=`[chest]`。 |
| 0175 | 绳索卷腹 | 保留 | 无。 |
| 0178 | 绳索侧平举 | 保留 | 无。 |
| 0188 | 绳索夹胸 | 保留 | mode=`chest-fly`；aliases 加“龙门架夹胸”。 |
| 0194 | 绳索过头臂屈伸 | 保留 | 无。 |
| 0196 | 绳索穿腿后拉 (带绳索) | 保留 | nameZh 改为“绳索穿腿后拉”；aliases 保留“绳索拉裆”；去掉附件赘词。 |
| 0198 | 高位下拉 | 保留 | aliases 加“下拉”。 |
| 0201 | 绳索下压 | 保留 | 0200 已删除，本条为唯一绳索下压，nameZh 不加附件后缀；aliases 加“直杆下压”。 |
| 0213 | 绳索 V 杆划船 | 保留 | aliases 加“V 杆高位划船”。 |
| 0227 | 绳索站姿飞鸟 | 保留 | 用户最终决定保留；mode 改 `chest-fly`（飞鸟不得留在 `horizontal-push`）。 |
| 0228 | 绳索后踢腿 | 保留 | aliases 加“绳索髋伸展”。 |
| 0233 | 绳索面拉 | 保留（热身） | tags=`[shoulders,back,warm-up]`；aliases=`面拉、绳索肩胛后拉`。 |
| 0238 | 绳索直臂下拉 | 保留 | 无。 |
| 0243 | 绳索转体 | 保留 | 无。 |
| 0251 | 双杠臂屈伸 | 保留 | mode=`dip`；tags=`[chest,triceps]`、compound。 |
| 0274 | 卷腹 | 保留 | 无。 |
| 0276 | 死虫式 | 保留（热身） | tags=`[waist,warm-up]`；aliases=`死虫`。 |
| 0289 | 哑铃卧推 | 保留 | 无。 |
| 0293 | 哑铃俯身划船 | 保留 | aliases=`哑铃划船`。 |
| 0294 | 哑铃弯举 | 保留 | 无。 |
| 0297 | 哑铃集中弯举 | 保留 | 用户最终决定保留；aliases 加“集中弯举”。 |
| 0308 | 哑铃飞鸟 | 保留 | mode=`chest-fly`；aliases=`平板哑铃飞鸟`。 |
| 0310 | 哑铃前平举 | 保留 | 用户最终决定保留；aliases 加“前平举”；保持 `shoulder-flexion`。 |
| 0313 | 锤式弯举 | 保留 | aliases=`哑铃锤式弯举`。 |
| 0314 | 上斜哑铃推举 | 保留 | nameZh 改为“上斜哑铃卧推”（上游为 incline bench press）；aliases=`上斜哑铃推举`。 |
| 0315 | 哑铃上斜弯举 | 保留 | 无。 |
| 0319 | 哑铃上斜飞鸟 | 保留 | mode=`chest-fly`；aliases=`上斜哑铃飞鸟`。 |
| 0333 | 哑铃后摆臂屈伸 | 保留 | 用户最终决定保留；aliases 加“哑铃回扣”。 |
| 0334 | 哑铃侧平举 | 保留 | 无。 |
| 0372 | 哑铃牧师凳弯举 | 保留 | 无。 |
| 0405 | 哑铃推举 | 保留 | aliases=`哑铃推肩、坐姿哑铃推肩`。 |
| 0417 | 哑铃站姿提踵 | 保留 | 无。 |
| 0431 | 哑铃登阶 | 保留 | nameZh 保持“哑铃登阶”；mode=`step-up`，不标普通 `lunge`。 |
| 0432 | 哑铃直腿硬拉 | 保留 | aliases=`直腿硬拉`。 |
| 0447 | 曲杠弯举 | 保留 | aliases=`EZ 杠弯举、曲杆弯举`。 |
| 0464 | 平板支撑 | 保留 | nameZh 改为“平板支撑带转体”；mode=`trunk-rotation`；tags=`[waist]`；**不标热身**。 |
| 0472 | 悬垂举腿 | 保留 | 按上游说明书冻结：`instruction_steps.zh` 明写“保持伸直”，姿态是直腿悬垂举腿；nameZh 冻结为“悬垂举腿”，不得写成“屈膝举腿”；mode=`hip-flexion`；aliases=`悬垂抬腿、悬挂抬脚`。 |
| 0489 | 山羊挺身 | 保留 | tags=`[back,glutes,legs]`（补臀标签）；mode=`trunk-extension`。 |
| 0493 | 上斜俯卧撑 | 保留 | mode=`incline-push`。 |
| 0499 | 反向划船 | 保留 | aliases=`澳式引体`。 |
| 0507 | 折刀式仰卧起坐 | 保留 | aliases=`折刀起坐`。 |
| 0573 | 器械山羊挺身 | 保留 | tags=`[back,glutes,legs]`；mode=`trunk-extension`。 |
| 0576 | 器械推胸 | 保留 | 重名组按 ID 0576 保留，不按 name 反查。 |
| 0584 | 器械侧平举 | 保留 | 无。 |
| 0585 | 器械腿屈伸 | 保留 | 无。 |
| 0586 | 俯卧腿弯举 | 保留 | 无。 |
| 0592 | 器械牧师凳弯举 | 保留 | aliases=`器械牧师弯举`；保留 `elbow-flexion`。 |
| 0596 | 器械夹胸 | 保留 | mode=`chest-fly`；aliases=`蝴蝶机飞鸟、pec deck`。 |
| 0597 | 器械髋外展 | 保留 | aliases=`坐姿髋外展`。 |
| 0598 | 器械髋内收 | 保留 | aliases=`坐姿髋内收、腿内收`；保留 `hip-adduction`。 |
| 0599 | 器械坐姿腿弯举 | 保留 | aliases=`坐姿腿弯举`。 |
| 0602 | 器械反向飞鸟 | 保留 | aliases=`蝴蝶机反向飞鸟`。 |
| 0603 | 器械肩推 | 保留 | aliases=`器械推举`。 |
| 0605 | 站姿提踵 | 保留 | aliases=`器械站姿提踵`。 |
| 0606 | T 杆划船 | 保留 | aliases=`T 杠划船`。 |
| 0607 | 器械臂屈伸 | 保留 | 无。 |
| 0620 | 仰卧举腿 | 保留 | mode=`hip-flexion`；aliases=`躺姿抬腿`。 |
| 0628 | 怪物行走 | 保留（热身） | tags=`[glutes,legs,warm-up]`；保留原 equipment=`body weight`，不擅自改数据。 |
| 0652 | 引体向上 | 保留 | aliases=`正手引体`。 |
| 0662 | 俯卧撑 | 保留 | 无。 |
| 0687 | 俄罗斯转体 | 保留 | 无。 |
| 0705 | 侧平板支撑 | 保留（热身） | tags=`[waist,warm-up]`；aliases=`侧桥支撑`。 |
| 0735 | 仰卧起坐 | 保留 | 无。 |
| 0739 | 腿举 | 保留 | aliases=`倒蹬、器械倒蹬、45°腿举`。 |
| 0743 | 雪橇机哈克深蹲 | 保留 | aliases=`哈克机深蹲`。 |
| 0748 | 史密斯卧推 | 保留 | aliases=`史密斯机卧推`。 |
| 0757 | 史密斯上斜卧推 | 保留 | aliases=`史密斯机上斜卧推`。 |
| 0766 | 史密斯肩推 | 保留 | aliases=`史密斯机肩推`。 |
| 0770 | 史密斯深蹲 | 保留 | aliases=`史密斯机深蹲`。 |
| 0814 | 肱三头肌臂屈伸 | 保留 | aliases=`双杠三头臂屈伸`；tags=`[triceps]`、compound。 |
| 0861 | 坐姿划船 | 保留 | aliases=`坐姿绳索划船、低位划船`。 |
| 0868 | 绳索弯举 | 保留 | aliases=`龙门架弯举、直杆绳索弯举`。 |
| 0872 | 反向卷腹 | 保留 | 无。 |
| 1299 | 器械上斜推胸 | 保留 | mode=`incline-push`，不写成 `horizontal-push`。 |
| 1326 | 反握引体向上 | 保留 | aliases=`反手引体、chin-up`；保持 `vertical-pull`。 |
| 1350 | 器械坐姿划船 | 保留 | aliases=`坐姿器械划船`。 |
| 1409 | 杠铃臀桥 | 保留 | aliases=`负重臀桥`；不得伪称“杠铃臀推”。 |
| 1457 | 杠铃推举 | 保留 | aliases=`站姿推举、实力推、过顶推`。 |
| 1460 | 弓步蹲 | 保留 | aliases=`行走箭步蹲、walking lunge`。 |
| 1760 | 哑铃高脚杯深蹲 | 保留 | aliases=`高脚杯深蹲`。 |
| 2137 | 哑铃阿诺德推举 | 保留 | aliases=`阿诺德推举`。 |
| 2292 | 俯身哑铃飞鸟 | 保留 | aliases=`俯身反向飞鸟、俯身哑铃侧平举`。 |
| 2368 | 保加利亚分腿蹲 | 保留 | aliases=`保加利亚深蹲、分腿蹲`。 |
| 3013 | 臀桥 | 保留 | aliases=`自重臀桥、地面臀桥`。 |

**A 小结**：保留基线 **102 条**（104 − 0200 − 0673）。
用户最终决定保留 `0227 / 0297 / 0310 / 0333`，因此本轮不再删除这 4 条；
`0200` 因与唯一标准绳索下压 `0201` 只差附件而删除（见 E）。

---

## B. 精确新增 ID 表（34 条）

下表的 `target` 是上游原值；`mode/tags/compound` 是本文件的人工策展元数据；
`证据` 采用“小红书发现 + 训练模式复核”，不把单一笔记当作充分证据。
`JPEG/GIF` 均为已在上游树中核验存在，最终落盘时由脚本写为 `exercises/images/...` 与 `exercises/videos/...`。

### B.1 正式新增（28 条）

| ID | nameZh | aliases | 英文名 | equipment | target | mode | tags | compound | 证据 | JPEG/GIF |
|---|---|---|---|---|---|---|---|---|---|---|
| 0009 | 辅助双杠臂屈伸 | 辅助双杠、跪姿辅助臂屈伸 | assisted chest dip (kneeling) | leverage machine | pectorals | dip | chest,triceps | true | 辅助/新手推日；胸式 dip 的标准难度退阶。 | `exercises/images/0009-PAgTVaK.jpg` / `exercises/videos/0009-PAgTVaK.gif` |
| 0017 | 辅助引体向上 | 辅助引体、辅助正手引体 | assisted pull-up | leverage machine | lats | vertical-pull | back | true | 垂直拉的辅助难度位，与 0652/1326 组成自重谱。 | `exercises/images/0017-kiJ4Z2K.jpg` / `exercises/videos/0017-kiJ4Z2K.gif` |
| 0216 | 绳索坐姿肩内旋 | 坐姿绳索内旋、肩袖内旋 | cable seated shoulder internal rotation | cable | delts | shoulder-internal-rotation | shoulders,warm-up | false | 肩袖内旋高证据；上游无弹力带版，用绳索替代。 | `exercises/images/0216-YPoVrBi.jpg` / `exercises/videos/0216-YPoVrBi.gif` |
| 0223 | 绳索侧卷腹 | 侧向绳索卷腹 | cable side crunch | cable | abs | trunk-lateral-flexion | waist | false | 补侧屈/侧链模式；不是主动转体。 | `exercises/images/0223-q2ADGqV.jpg` / `exercises/videos/0223-q2ADGqV.gif` |
| 0226 | 站姿绳索卷腹 | 龙门架站姿卷腹 | cable standing crunch | cable | abs | trunk-flexion | waist | false | 核心日明确出现；与 0175 跪姿卷腹姿态不同。 | `exercises/images/0226-jpgqxiS.jpg` / `exercises/videos/0226-jpgqxiS.gif` |
| 0235 | 绳索站姿肩外旋 | 绳索肩外旋、肩袖外旋 | cable standing shoulder external rotation | cable | delts | shoulder-external-rotation | shoulders,warm-up | false | 肩袖外旋高证据；上游无弹力带版，用绳索替代。 | `exercises/images/0235-FWdVhcW.jpg` / `exercises/videos/0235-FWdVhcW.gif` |
| 0246 | 绳索直立划船 | 龙门架直立划船 | cable upright row | cable | delts | upright-row | shoulders | true | 与 0120/0437 组成杠铃/绳索/哑铃器械位。 | `exercises/images/0246-cALKspW.jpg` / `exercises/videos/0246-cALKspW.gif` |
| 0336 | 哑铃箭步蹲 | 箭步蹲、哑铃行走箭步 | dumbbell lunge | dumbbell | glutes | lunge | legs,glutes | true | 腿日；提供自重 1460 之外的可负重标准。 | `exercises/images/0336-RRWFUcw.jpg` / `exercises/videos/0336-RRWFUcw.gif` |
| 0381 | 反向箭步蹲 | 后撤箭步蹲、哑铃反向箭步 | dumbbell rear lunge | dumbbell | glutes | lunge | legs,glutes | true | 腿日；单侧方向有独立稳定/膝负荷差异。 | `exercises/images/0381-SSsBDwB.jpg` / `exercises/videos/0381-SSsBDwB.gif` |
| 0407 | 站姿哑铃侧屈 | 哑铃体侧屈 | dumbbell side bend | dumbbell | abs | trunk-lateral-flexion | waist | false | 核心侧链，不归主动旋转。 | `exercises/images/0407-IpONWYv.jpg` / `exercises/videos/0407-IpONWYv.gif` |
| 0437 | 哑铃直立划船 | — | dumbbell upright row | dumbbell | delts | upright-row | shoulders | true | 与 0120/0246 形成杠铃/绳索/哑铃器械位。 | `exercises/images/0437-ainizkb.jpg` / `exercises/videos/0437-ainizkb.gif` |
| 0475 | 悬垂直腿举腿 | 悬垂直腿抬腿 | hanging straight leg raise | body weight | abs | hip-flexion | waist | false | 与 0472 保留难度差异；实施前须读上游说明书确认 0472/0475 姿态区分。 | `exercises/images/0475-4Ml7QFO.jpg` / `exercises/videos/0475-4Ml7QFO.gif` |
| 0575 | 器械弯举 | 器械二头弯举 | lever bicep curl | leverage machine | biceps | elbow-flexion | biceps | false | 普通器械弯举与牧师凳器械 0592 不同，二者均保留。 | `exercises/images/0575-q6y3OhV.jpg` / `exercises/videos/0575-q6y3OhV.gif` |
| 0710 | 站姿髋外展 | 自重髋外展 | side hip abduction | body weight | abductors | hip-abduction | glutes,legs,warm-up | false | 上游说明书实际是站姿单腿外展；展示名按说明书冻结，不写“侧卧抬腿”。 | `exercises/images/0710-7WaDzyL.jpg` / `exercises/videos/0710-7WaDzyL.gif` |
| 0864 | 哑铃站姿肩外旋 | 哑铃肩袖外旋、站姿哑铃外旋 | dumbbell upright shoulder external rotation | dumbbell | delts | shoulder-external-rotation | shoulders,warm-up | false | 肩袖外旋的哑铃器械替代；不收 0863 仰卧重复。 | `exercises/images/0864-x306lCW.jpg` / `exercises/videos/0864-x306lCW.gif` |
| 0979 | 水平弹力带 Pallof 推 | 水平 Pallof、抗旋转推 | band horizontal pallof press | band | abs | anti-rotation | waist | false | 用户指定核心新增；抗旋转独立于转体；**不标热身**。 | `exercises/images/0979-9pa4H5m.jpg` / `exercises/videos/0979-9pa4H5m.gif` |
| 0993 | 弹力带拉开 | 弹力带反向飞鸟、水平扩胸 | band reverse fly | band | delts | shoulder-horizontal-abduction | shoulders,back,warm-up | false | 小红书“弹力带水平扩胸/拉开”多条证据；上游无 `pull-apart` 字面 ID，按说明书采用 0993，映射置信度中。 | `exercises/images/0993-sTfvVsG.jpg` / `exercises/videos/0993-sTfvVsG.gif` |
| 1361 | 史密斯反手划船 | 史密斯机反手划船 | smith reverse grip bent over row | smith machine | upper back | horizontal-pull | back | true | 主要模式补史密斯，且是器械 + 反握组合。 | `exercises/images/1361-aaxA3cm.jpg` / `exercises/videos/1361-aaxA3cm.gif` |
| 1604 | 世界最伟大拉伸 | 伟大拉伸、World’s Greatest Stretch | world greatest stretch | body weight | hamstrings | mobility-flow | legs,glutes,warm-up | false | 热身流程明确列出；全身活动度，保留腿/臀重叠标签。 | `exercises/images/1604-DFGXwZr.jpg` / `exercises/videos/1604-DFGXwZr.gif` |
| 1757 | 单腿硬拉 | 单腿罗马尼亚硬拉、哑铃单腿硬拉 | dumbbell single leg deadlift | dumbbell | glutes | hip-hinge | legs,glutes | true | 恢复/稳定/单侧价值独立，不能按双侧硬拉替代。 | `exercises/images/1757-gKozT8X.jpg` / `exercises/videos/1757-gKozT8X.gif` |
| 2133 | 农夫行走 | 农夫走、Farmer’s Walk | farmers walk | dumbbell | quads | carry | legs,back,waist,glutes | true | 负重行走 = 核心稳定 + 腿/腰腹复合；target 保留上游 `quads`，tags 是产品重叠发现。 | `exercises/images/2133-qPEzJjA.jpg` / `exercises/videos/2133-qPEzJjA.gif` |
| 2188 | 哑铃颈后臂屈伸 | 坐姿哑铃臂屈伸、哑铃过头臂屈伸 | dumbbell seated triceps extension | dumbbell | triceps | elbow-extension | triceps | false | 补齐三头自由重量器械位。 | `exercises/images/2188-kont8Ut.jpg` / `exercises/videos/2188-kont8Ut.gif` |
| 2616 | V 杆窄距高位下拉 | V 杆下拉、窄距下拉 | cable lateral pulldown with v-bar | cable | lats | vertical-pull | back | true | 标准下拉 + V 杆窄距；与宽距、反握区分。 | `exercises/images/2616-4c9BhzB.jpg` / `exercises/videos/2616-4c9BhzB.gif` |
| 3006 | 弹力带坐姿髋外展 | 弹力带髋外展 | resistance band seated hip abduction | resistance band | abductors | hip-abduction | glutes,legs,warm-up | false | 臀中肌热身；与器械 0597、自重 0710 保留器械/难度差异。 | `exercises/images/3006-0xDpB4L.jpg` / `exercises/videos/3006-0xDpB4L.gif` |
| 3012 | 站姿肩胛后缩撑起 | 肩胛后缩、肩胛控制 | scapula dips | body weight | traps | scapular-retraction | back,shoulders,warm-up | false | 已读说明书：站姿前屈肩胛后缩，不是双杠 dip；须扩 `TARGET_WHITELIST` 放行 `traps`。 | `exercises/images/3012-7xeukSt.jpg` / `exercises/videos/3012-7xeukSt.gif` |
| 3021 | 肩胛俯卧撑 | 前锯肌俯卧撑 | scapula push-up | body weight | serratus anterior | scapular-protraction | chest,shoulders,warm-up | false | 明确“推前当作热身/前锯肌激活”；须扩 `TARGET_WHITELIST` 放行 `serratus anterior`。 | `exercises/images/3021-jV65tKx.jpg` / `exercises/videos/3021-jV65tKx.gif` |
| 3561 | 臀桥行军 | 交替臀桥、臀桥抬膝 | glute bridge march | body weight | glutes | hip-thrust | glutes,legs,warm-up | true | 臀桥顶端交替抬膝，单侧稳定与热身价值独立；与 3013 不是纯命名重复。 | `exercises/images/3561-GibBPPg.jpg` / `exercises/videos/3561-GibBPPg.gif` |
| 3699 | 交替触肩 | 肩碰肩、Shoulder Tap | shoulder tap | body weight | abs | anti-extension | waist | false | 已核验实际动作是高位平板交替触碰对侧肩；归 `anti-extension`，不是转体，**不标热身**。 | `exercises/images/3699-yRpV5TC.jpg` / `exercises/videos/3699-yRpV5TC.gif` |

> **B.1 小结**：正式新增 **28 条**。表内没有伪 ID；0175 已在当前目录，见 A。

### B.2 追加新增（6 条）

这 6 条与 B.1 一样是精确 ID 且 JPEG/GIF 双存在，不是凑数：分别对应肩关节绕环、
肩胛前伸/后缩的难度链与自重退阶。全部纳入最终 136 条。

| ID | nameZh | aliases | 英文名 | equipment | target | mode | tags | compound | 证据 | JPEG/GIF |
|---|---|---|---|---|---|---|---|---|---|---|
| 2143 | 哑铃肩绕环 | 哑铃绕肩、Around the World | dumbbell standing around world | dumbbell | delts | shoulder-circumduction | shoulders,warm-up | false | 肩部热身明确出现绕肩；补肩关节环绕而非重复侧平举。 | `exercises/images/2143-RSOsp5d.jpg` / `exercises/videos/2143-RSOsp5d.gif` |
| 3011 | 上斜肩胛俯卧撑 | 上斜肩胛推、入门肩胛俯卧撑 | incline scapula push up | body weight | serratus anterior | scapular-protraction | chest,shoulders,warm-up | false | 自重肩胛俯卧撑退阶；与 3021 形成难度链；须扩 `TARGET_WHITELIST`。 | `exercises/images/3011-GdMa1ET.jpg` / `exercises/videos/3011-GdMa1ET.gif` |
| 0688 | 肩胛引体 | 肩胛下沉、Scapular Pull-up | scapular pull-up | body weight | traps | scapular-retraction | back,shoulders,warm-up | true | 自重垂直拉/肩胛控制进阶；与 0652/0017 形成标准+辅助+肩胛控制链；须扩 `TARGET_WHITELIST`。 | `exercises/images/0688-uTBt1HV.jpg` / `exercises/videos/0688-uTBt1HV.gif` |
| 0624 | 靠墙坐姿行军 | 靠墙静蹲抬膝 | march sit (wall) | body weight | glutes | squat | legs,glutes | true | 自重腿部退阶；实施前须读上游说明书复核姿态；**不标热身**。 | `exercises/images/0624-sVQCCeG.jpg` / `exercises/videos/0624-sVQCCeG.gif` |
| 0659 | 靠墙俯卧撑 | 墙壁俯卧撑 | push-up (wall) | body weight | pectorals | horizontal-push | chest,shoulders | true | 俯卧撑自重退阶，补“标准+退阶”链；**不标热身**。 | `exercises/images/0659-LEH9jxP.jpg` / `exercises/videos/0659-LEH9jxP.gif` |
| 1017 | 弹力带 Y 字举 | 弹力带 Y raise、肩胛 Y 举 | band y-raise | band | delts | shoulder-abduction | shoulders,back,warm-up | false | 肩背热身 Y/W 类肩胛激活；与 0993 水平扩胸不是同轨迹；target 在白名单内。 | `exercises/images/1017-9vH5M5R.jpg` / `exercises/videos/1017-9vH5M5R.gif` |

### B.3 明确不作为新增的 ID

`0241`（绳索 V 杆下压）：虽是 V 杆窄距中立位，但本轮最终新增集合不含它，**不新增、不占数量**；
其余排除项见 D。

---

## C. 热身标签（最终 18 条）

热身标签不是独立筛选层，而是与部位标签重叠的可发现入口；正式收录的热身动作必须同时保留至少一个具体部位标签。

**最终热身集合（18 条）**：

- 既有：`0233` 绳索面拉、`0276` 死虫式、`0628` 怪物行走、`0705` 侧平板支撑；
- 新增：`0216`、`0235`、`0710`、`0864`、`0993`、`1604`、`3006`、`3012`、`3021`、`3561`；
- 追加新增：`2143`、`1017`、`3011`、`0688`。

**明确不标热身**：`0464` 平板支撑带转体（核心主动转体，归 `trunk-rotation`）、
`0979` 水平弹力带 Pallof 推（核心抗旋转）、`3699` 交替触肩（核心抗伸展）、
`0624` 靠墙坐姿行军、`0659` 靠墙俯卧撑（自重退阶动作，非激活热身）。

**不收录**：跑步机、开合跳、波比跳或有氧器械一律不进动作库。

**上游没有精确条目的热身动作**：弹力带拉开字面名（用 `0993` 等价发现，置信度中）、
弹力带肩内外旋字面名（用 `0216/0235` 绳索版替代）、弹力带侧步走/蚌式开合/髋飞机/90-90 转髋
（上游无精确条目，`0628` 已承担怪物走/侧步走等价发现）——禁止伪造自定义 ID。

---

## D. 严格排除项

**用户最终授权严格排除（9 条，不得进入最终目录，也不得计入任何数量公式）**：

| ID | 名称 | 排除原因 |
|---|---|---|
| 1015 | 垂直弹力带 Pallof 推 | 与 0979 只差锚点方向；抗旋转本轮只保留 1 条。 |
| 0222 | 绳索侧屈 | 与 0223 侧卷腹、0407 哑铃侧屈重复侧链模式。 |
| 2399 | 坐姿绳索转体 | 与 0243 绳索转体重复主动旋转模式。 |
| 3697 | 跪姿绳索面拉 | 面拉只保留既有 0233 一个 ID。 |
| 0549 | 壶铃摇摆 | 不进本轮最终清单。 |
| 2571 | 青蛙趴摇摆 | 髋部活动度由 1604 代表。 |
| 1419 | 铁十字髋部拉伸 | 与 1604 同为动态髋/腿活动度，本轮不占位。 |
| 1314 | 瑞士球背伸展 | 平衡设备；已有 0489/0573 常见山羊挺身。 |
| 0241 | 绳索 V 杆下压 | 本轮不新增（三头已有标准下压 0201、过头 0194/0092/2188、器械 0607）。 |

**其他排除**：

1. **不上游的动作**：杠铃臀推/臀冲、蚌式开合、弹力带侧步走（独立字面条目）、静蹲、平板蝴蝶收腹、
   跪姿侧抬腿、弹力带拉开字面条目、弹力带肩内外旋字面条目、髋飞机、90/90 转髋、猫牛式、泡沫轴上推。
   不得为这些动作伪造上游四位 ID；若要自定义动作，必须另行公共契约/ADR 决策。
2. **不收前臂专项、不收耸肩**：`0095` 杠铃耸肩、`0406` 哑铃耸肩不进最终清单。
   即便上游 target=`traps`，也不因 H 放行 `traps` 而顺带加入。
3. **不收凳上反屈伸 `0129`**。
4. **下拉附件只收标准 + V 杆窄距**：保留正手引体 0652、辅助引体 0017、反握引体 1326、
   标准下拉 0198 与新增 2616；排除宽距 0150、反握下拉 0245，并删除现有反握器械下拉 0673。
5. **不收同名重复 ID**：重名条目按精确 ID 审计。保留 `0088` 而非 `1371`、`0576` 而非 `0577`；不按英文名自动映射。
6. **不收平衡设备/版本号/性别后缀/奇异爆发动作**：`v.2`/`v.3`、male/female 同动作、药球爆发、跳跃与冷门动作。
7. **不把“举”扩成抓举/高翻/挺举**：`vertical-push` 只对应肩上推举；直立划船是 `upright-row`。
8. **不把训练模式当有氧**：农夫行走 `carry` 是负重行走复合动作，可进入计划。
9. **不按名字猜动作**：`3012` 上游名 `scapula dips` 但说明书是站姿肩胛后缩；`3699` 实际是高位平板交替触肩；
   `3292 elevator` 说明书是站姿体前屈，绝不能当肩胛控制收录。

---

## E. 删除清单（2 条，v3 迁移直接移除，无 replacement）

| ID | 当前动作 | 删除原因 | replacement |
|---|---|---|---|
| 0200 | 绳索下压 (带绳索附件) | 与 0201 标准直杆下压只差附件，属纯附件重复；用户最终决定删除。 | 无；v3 迁移直接移除 |
| 0673 | 反握器械背阔肌下拉 | 用户决策为标准下拉 + V 杆窄距，反握不收；0198 与 2616 已覆盖垂直拉。 | 无 |

**不删除但也不新增**：`0233` 面拉、`0628` 怪物行走、`1409` 杠铃臀桥、`3013` 臀桥、
以及用户最终保留的 `0227 / 0297 / 0310 / 0333`。

**旧移除 ID 不创建 replacement**：历史计划只按最终 catalog 可用性裁剪，历史 Session 不回写。
`0200/0673` 从旧计划中直接移除，用户可在编辑计划时重新选择新动作。

---

## F. mode / tag / name / aliases 修正

### F.1 mode 受控词表（最终 39 个）

`anti-extension`, `anti-rotation`, `carry`, `chest-fly`, `dip`, `elbow-extension`, `elbow-flexion`,
`hip-abduction`, `hip-adduction`, `hip-extension`, `hip-flexion`, `hip-hinge`, `hip-thrust`,
`horizontal-pull`, `horizontal-push`, `incline-push`, `knee-extension`, `knee-flexion`, `lunge`,
`mobility-flow`, `plantar-flexion`, `scapular-protraction`, `scapular-retraction`, `shoulder-abduction`,
`shoulder-circumduction`, `shoulder-extension`, `shoulder-external-rotation`, `shoulder-flexion`,
`shoulder-horizontal-abduction`, `shoulder-internal-rotation`, `squat`, `step-up`, `trunk-extension`,
`trunk-flexion`, `trunk-lateral-flexion`, `trunk-rotation`, `upright-row`, `vertical-pull`, `vertical-push`。

关键归类：

- **`chest-fly`**：`0171, 0188, 0227, 0308, 0319, 0596`。原来误用 `horizontal-push` 的飞鸟/夹胸全部纠正（含保留的 0227）。
- **`step-up`**：`0431` 登阶，不归普通 `lunge`。
- **`incline-push`**：`1299` 器械上斜推胸；`0493` 上斜俯卧撑；`0047/0314/0757`。
- **`hip-flexion`**：`0472, 0475, 0620` 抬腿/举腿；不再塞进 `trunk-flexion`。
- **`trunk-lateral-flexion`**：`0223, 0407` 侧屈，不归 `trunk-rotation`。
- **`trunk-rotation`**：`0243, 0464, 0687`；`0464` 带转体平板支撑按上游 `front plank with twist` 归类。
- **`anti-rotation`**：`0979` Pallof 推（1015 已排除）。
- **`carry`**：`2133` 农夫行走。
- **`scapular-protraction/retraction`**：`3021/3011`、`3012/0688`；肩胛动作不归普通胸推或背拉。
- **`mobility-flow`**：`1604` 世界最伟大拉伸（2571/1419 已排除）。
- **`shoulder-circumduction`**：`2143` 哑铃肩绕环。
- **`shoulder-external/internal-rotation`**：`0235/0864`、`0216`。

### F.2 tags 规则

- **筛选顺序冻结为 11 项**：`全部 / 胸 / 背 / 肩 / 二头肌 / 三头肌 / 腿 / 腰腹 / 臀 / 热身 / 复合动作`。
  即 `PART_LABELS` 顺序为 `chest, back, shoulders, biceps, triceps, legs, waist, glutes, warm-up, compound`，
  `PART_FILTERS = ['全部'].concat(Object.keys(PART_LABELS))` 长度为 11。
- **`warm-up` 是新增产品标签，必须与具体部位重叠**，最终 18 条见 C；不把热身做成互斥部位。
- `0489, 0573` 补 `glutes`，因为背伸展在训练模式上有臀/后链价值；保留 `back`。
- `2133` tags=`legs,back,waist,glutes`，并加 `compound`；上游 `target=quads` 原样保存。
- `0009` tags=`chest,triceps`；`0017` tags=`back`；`3699` tags=`waist`（不因“触肩”归肩）。
- `compound` 只标多关节/负重移动；肩袖、卷腹、侧屈、面拉、肩胛激活不标复合。
- 不新增 `forearms` 或 `traps` 用户标签；不收前臂专项和耸肩。
  `3012/0688` 的上游 `target=traps`、`3011/3021` 的 `target=serratus anterior` 只影响生成器粗筛（见 H），产品 tags 仍为部位重叠标签。

### F.3 name / nameZh / aliases 规则

- `nameZh` 只放一个健身房常用规范展示名；别名进 `aliases`，不把别名串在展示名中。
- **必须修正**：`0314` → “上斜哑铃卧推”；`0196` → “绳索穿腿后拉”（去附件赘词）；
  `0464` → “平板支撑带转体”；`0472` → 冻结“悬垂举腿”（上游说明书为双腿伸直，不得写“屈膝”）；
  `0201` 保持“绳索下压”（0200 已删，不再需要附件后缀）；`0431` 确认“哑铃登阶”；`1299` 保持“器械上斜推胸”。
- **`aliases` 当前未实现**：生成链需要新增该字段并让搜索命中（见票 01）；无实际检索价值的条目不硬凑别名。
- 常用中文 aliases 至少覆盖：`高位下拉/下拉`、`V 杆下拉/窄距下拉`、`牧师椅/牧师凳弯举`、`龙门架`、
  `倒蹬`、`哈克机`、`澳式引体`、`自重臀桥`；`1409` 只称臀桥，绝不写成臀推。
- 每条的 `tags` 数组顺序沿用现状（保留项）或本文件表格顺序（新增项），`partTagsLabel` 展示顺序即该数组顺序，本轮不改展示顺序规则。

---

## G. 最终数量公式与模式审计

### G.1 公式

```
当前精选目录                       104
删除（E：0200、0673）              −2
正式新增（B.1）                    +28
追加新增（B.2）                    +6
------------------------------------------------
最终                            = 136 条
```

- 136 落在既有“约 100–140 条”范围内；不设硬下限，也不以低价值动作凑数。
- 排除项（D）不参与任何数量计算：`1015, 0222, 2399, 3697, 0549, 2571, 1419, 1314, 0241`。

### G.2 模式分布（最终 136 条，39 个 mode）

| mode | 数量 | 代表 ID |
|---|---:|---|
| horizontal-push | 7 | 0025, 0030, 0289, 0576, 0659, 0662, 0748 |
| incline-push | 5 | 0047, 0314, 0493, 0757, 1299 |
| vertical-push | 6 | 0091, 0405, 0603, 0766, 1457, 2137 |
| chest-fly | 6 | 0171, 0188, 0227, 0308, 0319, 0596 |
| dip | 4 | 0009, 0019, 0251, 0814 |
| horizontal-pull | 8 | 0027, 0213, 0293, 0499, 0606, 0861, 1350, 1361 |
| vertical-pull | 5 | 0017, 0198, 0652, 1326, 2616 |
| upright-row | 3 | 0120, 0246, 0437 |
| shoulder-abduction | 4 | 0178, 0334, 0584, 1017 |
| shoulder-horizontal-abduction | 4 | 0233, 0602, 0993, 2292 |
| shoulder-flexion / -extension | 1 / 1 | 0310 / 0238 |
| shoulder-external-rotation | 2 | 0235, 0864 |
| shoulder-internal-rotation | 1 | 0216 |
| shoulder-circumduction | 1 | 2143 |
| elbow-flexion | 11 | 0031, 0165, 0294, 0297, 0313, 0315, 0372, 0447, 0575, 0592, 0868 |
| elbow-extension | 7 | 0060, 0092, 0194, 0201, 0333, 0607, 2188 |
| squat | 8 | 0042, 0043, 0046, 0624, 0739, 0743, 0770, 1760 |
| lunge | 4 | 0336, 0381, 1460, 2368 |
| step-up | 1 | 0431 |
| knee-extension / knee-flexion | 1 / 2 | 0585 / 0586, 0599 |
| hip-hinge | 6 | 0032, 0085, 0117, 0196, 0432, 1757 |
| hip-thrust | 3 | 1409, 3013, 3561 |
| hip-abduction | 4 | 0597, 0628, 0710, 3006 |
| hip-adduction / hip-extension | 1 / 1 | 0598 / 0228 |
| plantar-flexion | 3 | 0088, 0417, 0605 |
| trunk-flexion | 6 | 0175, 0226, 0274, 0507, 0735, 0872 |
| hip-flexion | 3 | 0472, 0475, 0620 |
| anti-extension | 3 | 0276, 0705, 3699 |
| anti-rotation | 1 | 0979 |
| trunk-rotation | 3 | 0243, 0464, 0687 |
| trunk-lateral-flexion | 2 | 0223, 0407 |
| trunk-extension | 2 | 0489, 0573（产品 tags 为背/臀/腿，不计入腰腹标签） |
| scapular-protraction | 2 | 3011, 3021 |
| scapular-retraction | 2 | 0688, 3012 |
| mobility-flow | 1 | 1604 |
| carry | 1 | 2133 |

**腰腹标签合计 19 条**；核心类模式合计 20 条（含 `trunk-extension` 2 条标为背/臀/腿）。
`anti-rotation` 因 `1015` 被严格排除只有 1 条，`trunk-lateral-flexion` 因 `0222` 被排除只有 2 条——
这是用户最终决策的直接结果，不用冷门动作补位。

### G.3 tags 分布

| tag | 数量 |
|---|---:|
| chest | 22 |
| back | 23 |
| shoulders | 27 |
| biceps | 11 |
| triceps | 14 |
| legs | 38 |
| waist | 19 |
| glutes | 31 |
| warm-up | 18 |
| compound | 62 |

---

## H. TARGET_WHITELIST 影响

`scripts/build-exercises.js` 的 `TARGET_WHITELIST` 当前 14 项，而 `data/exercises.js` 的 `TARGET_LABELS`
已有 18 项目标枚举，其中包含 `serratus anterior`、`traps`——UI 有中文标签但粗筛不放行，口径不一致。

最终清单中 target 落在白名单外的只有：

| ID | 上游 target | 动作 |
|---|---|---|
| 0688 | `traps` | 肩胛引体 |
| 3012 | `traps` | 站姿肩胛后缩撑起 |
| 3011 | `serratus anterior` | 上斜肩胛俯卧撑 |
| 3021 | `serratus anterior` | 肩胛俯卧撑 |

**要求**：把 `serratus anterior`、`traps` 加入 `TARGET_WHITELIST`（14 → 16 项），并保留既有 `TARGET_LABELS`。
否则白名单里虽有 ID，生成器会在粗筛阶段静默不产出，`absent` 检查失败。

**边界**：这次放行只服务于上述肩胛动作，**不收录耸肩 `0095/0406`**、**不新增前臂专项**、
**不新增 `forearms`/`traps` 用户标签**。`CURATED_EXERCISES` 仍是最终目录的唯一闸门。

---

## I. v3 迁移影响

1. **目录版本**：`utils/db.js` 的 `PLAN_MIGRATION_VERSION` 由 v2 升为 **v3**。
   v3 不是“ID replacement 表”，而是按最终目录可查性直接裁剪。
2. **计划动作**：对每个已有 Plan/训练日，保留最终 catalog 能 `findById` 的动作；
   E 中删除的 `0200/0673` 及任何未进入最终白名单的动作直接移除。新增动作不自动注入既有计划。
3. **空容器清理**：先移除无效动作，再删除空训练日，再删除空计划；游标重新落在可用训练日上。
4. **无 replacement**：旧 ID 删除不迁移成相似新 ID，不写替换映射。
5. **Session 不变**：历史 Session 零写入、零变更，保留其当时的 `exerciseId/name/equipment` 快照。
6. **离线安全**：本地 v3 迁移可先完成；云端同步状态独立记录，网络恢复后再同步裁剪后的计划；
   云端失败不撤销本地结果；迁移幂等。
7. **媒体影响**：最终清单确认前不删除 CloudBase 媒体；确认后仅在 `exercises/images`、`exercises/videos`
   两个受管前缀中按最终 JPEG/GIF 集合清理。真实 CloudBase 上传/删除必须后续人工验收。
8. **旧 slug**：旧 slug 只在仍能解析到保留 ID 时继续工作；被移除的动作不创建 replacement slug。
9. **客户端数据契约**：不改变 Plan/Session 结构、volume 规则或主键格式；
   `equipment === 'body weight'` 仍是自重口径唯一判断。

---

## J. 冻结决策记录（原待审阅问题的最终结论）

| # | 原问题 | 最终结论 |
|---|---|---|
| 1 | 最终数量 | **136 条**：`104 − 2 + 34`；B.1 全收 + B.2 全收；不设下限、不凑数。 |
| 2 | 1015 垂直 Pallof | **排除**，抗旋转只保留 0979。 |
| 3 | 3697 跪姿面拉 | **排除**，面拉只保留既有 0233。 |
| 4 | 0993 展示为“弹力带拉开” | **接受**，别名注明“弹力带反向飞鸟、水平扩胸”，映射置信度中。 |
| 5 | 0216/0235 绳索肩袖内外旋替代弹力带 | **接受**，不伪造 band 版 ID。 |
| 6 | 0464 名称与 mode | nameZh=“平板支撑带转体”，mode=`trunk-rotation`，tags=`[waist]`，**不标热身**。 |
| 7 | 0472 姿态 | **按上游说明书冻结**：`instruction_steps.zh` 明写“保持伸直”，nameZh=“悬垂举腿”，不得写“屈膝举腿”；mode=`hip-flexion`。 |
| 8 | 0710 展示名 | **“站姿髋外展”**（上游说明书是站姿单腿外展），别名“自重髋外展”，不写“侧卧抬腿”。 |
| 9 | 0222/0223/0407 的 `trunk-lateral-flexion`、0475 的 `hip-flexion` | **接受**；但 0222 被严格排除，侧屈最终为 0223/0407 两条。 |
| 10 | 3012 展示名 | **“站姿肩胛后缩撑起”**，不展示“肩胛双杠臂屈伸”。 |
| 11 | `TARGET_WHITELIST` 扩 `traps`/`serratus anterior` | **接受**（14 → 16），仍不收耸肩、不新增前臂专项。 |
| 12 | 3011/0688/0624/0659 | **全部纳入**；`0129` 仍不加。 |
| 13 | 2143/1017/3011/0688 | **纳入**；2571/1419 被排除。 |
| 14 | 1314 瑞士球背伸展 | **排除**（平衡设备）。 |
| 15 | 0549 壶铃摇摆 | **排除**，不进本轮最终清单。 |
| 16 | 0088/0576/1326 按 ID 保留 | **确认**。 |
| 17 | 授权实施 | **已授权**：拆到 `.scratch/catalog-expansion/` 的 01–05 票实施；真实 CloudBase 与微信开发者工具验收留人工。 |

---

## K. 冻结最终清单（136 条，权威元数据表）

- 排序按 ID；`equipment`/`target` 为上游原值；`mode`/`tags`/`compound` 为策展元数据；`aliases` 仅参与搜索。
- 表格与 `data/curated-catalog.js` 的现有条目一一对应：保留项 = 现状 + 本表所列修正，新增项 = 本表整行。
- 最终目录必须与 `CURATED_EXERCISES` 白名单严格一一对应（136 = 136）。

| ID | nameZh | aliases | equipment | target | mode | tags | compound |
|---|---|---|---|---|---|---|---|
| 0009 | 辅助双杠臂屈伸 | 辅助双杠、跪姿辅助臂屈伸 | leverage machine | pectorals | dip | chest, triceps | true |
| 0017 | 辅助引体向上 | 辅助引体、辅助正手引体 | leverage machine | lats | vertical-pull | back | true |
| 0019 | 辅助肱三头肌臂屈伸 (跪姿) | 辅助臂屈伸 | leverage machine | triceps | dip | triceps | true |
| 0025 | 杠铃卧推 | — | barbell | pectorals | horizontal-push | chest | true |
| 0027 | 杠铃俯身划船 | — | barbell | upper back | horizontal-pull | back | true |
| 0030 | 杠铃窄距卧推 | 窄距卧推 | barbell | triceps | horizontal-push | triceps, chest | true |
| 0031 | 杠铃弯举 | — | barbell | biceps | elbow-flexion | biceps | false |
| 0032 | 杠铃硬拉 | — | barbell | glutes | hip-hinge | legs, back, glutes | true |
| 0042 | 杠铃前蹲 | — | barbell | glutes | squat | legs, glutes | true |
| 0043 | 杠铃深蹲 | — | barbell | glutes | squat | legs, glutes | true |
| 0046 | 杠铃哈克深蹲 | — | barbell | glutes | squat | legs, glutes | true |
| 0047 | 杠铃上斜卧推 | — | barbell | pectorals | incline-push | chest | true |
| 0060 | 仰卧臂屈伸 | — | barbell | triceps | elbow-extension | triceps | false |
| 0085 | 罗马尼亚硬拉 | — | barbell | glutes | hip-hinge | legs, glutes | true |
| 0088 | 杠铃坐姿提踵 | — | barbell | calves | plantar-flexion | legs | false |
| 0091 | 杠铃坐姿过头推举 | 坐姿杠铃推肩 | barbell | delts | vertical-push | shoulders | true |
| 0092 | 杠铃过头臂屈伸 | 杠铃颈后臂屈伸 | barbell | triceps | elbow-extension | triceps | false |
| 0117 | 杠铃相扑硬拉 | — | barbell | glutes | hip-hinge | legs, glutes | true |
| 0120 | 杠铃直立划船 | — | barbell | delts | upright-row | shoulders | true |
| 0165 | 绳索锤式弯举 | 绳索绳柄锤式弯举 | cable | biceps | elbow-flexion | biceps | false |
| 0171 | 绳索上斜飞鸟 | — | cable | pectorals | chest-fly | chest | false |
| 0175 | 绳索卷腹 | — | cable | abs | trunk-flexion | waist | false |
| 0178 | 绳索侧平举 | — | cable | delts | shoulder-abduction | shoulders | false |
| 0188 | 绳索夹胸 | 龙门架夹胸 | cable | pectorals | chest-fly | chest | false |
| 0194 | 绳索过头臂屈伸 | — | cable | triceps | elbow-extension | triceps | false |
| 0196 | 绳索穿腿后拉 | 绳索拉裆 | cable | glutes | hip-hinge | glutes, legs | true |
| 0198 | 高位下拉 | 下拉 | cable | lats | vertical-pull | back | true |
| 0201 | 绳索下压 | 直杆下压 | cable | triceps | elbow-extension | triceps | false |
| 0213 | 绳索 V 杆划船 | V 杆高位划船 | cable | lats | horizontal-pull | back | true |
| 0216 | 绳索坐姿肩内旋 | 坐姿绳索内旋、肩袖内旋 | cable | delts | shoulder-internal-rotation | shoulders, warm-up | false |
| 0223 | 绳索侧卷腹 | 侧向绳索卷腹 | cable | abs | trunk-lateral-flexion | waist | false |
| 0226 | 站姿绳索卷腹 | 龙门架站姿卷腹 | cable | abs | trunk-flexion | waist | false |
| 0227 | 绳索站姿飞鸟 | — | cable | pectorals | chest-fly | chest | false |
| 0228 | 绳索后踢腿 | 绳索髋伸展 | cable | glutes | hip-extension | glutes, legs | false |
| 0233 | 绳索面拉 | 面拉、绳索肩胛后拉 | cable | delts | shoulder-horizontal-abduction | shoulders, back, warm-up | false |
| 0235 | 绳索站姿肩外旋 | 绳索肩外旋、肩袖外旋 | cable | delts | shoulder-external-rotation | shoulders, warm-up | false |
| 0238 | 绳索直臂下拉 | — | cable | lats | shoulder-extension | back | false |
| 0243 | 绳索转体 | — | cable | abs | trunk-rotation | waist | false |
| 0246 | 绳索直立划船 | 龙门架直立划船 | cable | delts | upright-row | shoulders | true |
| 0251 | 双杠臂屈伸 | — | body weight | pectorals | dip | chest, triceps | true |
| 0274 | 卷腹 | — | body weight | abs | trunk-flexion | waist | false |
| 0276 | 死虫式 | 死虫 | body weight | abs | anti-extension | waist, warm-up | false |
| 0289 | 哑铃卧推 | — | dumbbell | pectorals | horizontal-push | chest | true |
| 0293 | 哑铃俯身划船 | 哑铃划船 | dumbbell | upper back | horizontal-pull | back | true |
| 0294 | 哑铃弯举 | — | dumbbell | biceps | elbow-flexion | biceps | false |
| 0297 | 哑铃集中弯举 | 集中弯举 | dumbbell | biceps | elbow-flexion | biceps | false |
| 0308 | 哑铃飞鸟 | 平板哑铃飞鸟 | dumbbell | pectorals | chest-fly | chest | false |
| 0310 | 哑铃前平举 | 前平举 | dumbbell | delts | shoulder-flexion | shoulders | false |
| 0313 | 锤式弯举 | 哑铃锤式弯举 | dumbbell | biceps | elbow-flexion | biceps | false |
| 0314 | 上斜哑铃卧推 | 上斜哑铃推举 | dumbbell | pectorals | incline-push | chest | true |
| 0315 | 哑铃上斜弯举 | — | dumbbell | biceps | elbow-flexion | biceps | false |
| 0319 | 哑铃上斜飞鸟 | 上斜哑铃飞鸟 | dumbbell | pectorals | chest-fly | chest | false |
| 0333 | 哑铃后摆臂屈伸 | 哑铃回扣 | dumbbell | triceps | elbow-extension | triceps | false |
| 0334 | 哑铃侧平举 | — | dumbbell | delts | shoulder-abduction | shoulders | false |
| 0336 | 哑铃箭步蹲 | 箭步蹲、哑铃行走箭步 | dumbbell | glutes | lunge | legs, glutes | true |
| 0372 | 哑铃牧师凳弯举 | — | dumbbell | biceps | elbow-flexion | biceps | false |
| 0381 | 反向箭步蹲 | 后撤箭步蹲、哑铃反向箭步 | dumbbell | glutes | lunge | legs, glutes | true |
| 0405 | 哑铃推举 | 哑铃推肩、坐姿哑铃推肩 | dumbbell | delts | vertical-push | shoulders | true |
| 0407 | 站姿哑铃侧屈 | 哑铃体侧屈 | dumbbell | abs | trunk-lateral-flexion | waist | false |
| 0417 | 哑铃站姿提踵 | — | dumbbell | calves | plantar-flexion | legs | false |
| 0431 | 哑铃登阶 | 登阶 | dumbbell | glutes | step-up | legs, glutes | true |
| 0432 | 哑铃直腿硬拉 | 直腿硬拉 | dumbbell | glutes | hip-hinge | legs, glutes | true |
| 0437 | 哑铃直立划船 | — | dumbbell | delts | upright-row | shoulders | true |
| 0447 | 曲杠弯举 | EZ 杠弯举、曲杆弯举 | ez barbell | biceps | elbow-flexion | biceps | false |
| 0464 | 平板支撑带转体 | 带转体平板支撑 | body weight | abs | trunk-rotation | waist | false |
| 0472 | 悬垂举腿 | 悬垂抬腿、悬挂抬脚 | body weight | abs | hip-flexion | waist | false |
| 0475 | 悬垂直腿举腿 | 悬垂直腿抬腿 | body weight | abs | hip-flexion | waist | false |
| 0489 | 山羊挺身 | — | body weight | spine | trunk-extension | back, glutes, legs | false |
| 0493 | 上斜俯卧撑 | — | body weight | pectorals | incline-push | chest, triceps | true |
| 0499 | 反向划船 | 澳式引体 | body weight | upper back | horizontal-pull | back | true |
| 0507 | 折刀式仰卧起坐 | 折刀起坐 | body weight | abs | trunk-flexion | waist | false |
| 0573 | 器械山羊挺身 | — | leverage machine | spine | trunk-extension | back, glutes, legs | false |
| 0575 | 器械弯举 | 器械二头弯举 | leverage machine | biceps | elbow-flexion | biceps | false |
| 0576 | 器械推胸 | — | leverage machine | pectorals | horizontal-push | chest | true |
| 0584 | 器械侧平举 | — | leverage machine | delts | shoulder-abduction | shoulders | false |
| 0585 | 器械腿屈伸 | — | leverage machine | quads | knee-extension | legs | false |
| 0586 | 俯卧腿弯举 | — | leverage machine | hamstrings | knee-flexion | legs | false |
| 0592 | 器械牧师凳弯举 | 器械牧师弯举 | leverage machine | biceps | elbow-flexion | biceps | false |
| 0596 | 器械夹胸 | 蝴蝶机飞鸟、pec deck | leverage machine | pectorals | chest-fly | chest | false |
| 0597 | 器械髋外展 | 坐姿髋外展 | leverage machine | abductors | hip-abduction | glutes, legs | false |
| 0598 | 器械髋内收 | 坐姿髋内收、腿内收 | leverage machine | adductors | hip-adduction | legs | false |
| 0599 | 器械坐姿腿弯举 | 坐姿腿弯举 | leverage machine | hamstrings | knee-flexion | legs | false |
| 0602 | 器械反向飞鸟 | 蝴蝶机反向飞鸟 | leverage machine | delts | shoulder-horizontal-abduction | shoulders | false |
| 0603 | 器械肩推 | 器械推举 | leverage machine | delts | vertical-push | shoulders | true |
| 0605 | 站姿提踵 | 器械站姿提踵 | leverage machine | calves | plantar-flexion | legs | false |
| 0606 | T 杆划船 | T 杠划船 | leverage machine | upper back | horizontal-pull | back | true |
| 0607 | 器械臂屈伸 | — | leverage machine | triceps | elbow-extension | triceps | false |
| 0620 | 仰卧举腿 | 躺姿抬腿 | body weight | abs | hip-flexion | waist | false |
| 0624 | 靠墙坐姿行军 | 靠墙静蹲抬膝 | body weight | glutes | squat | legs, glutes | true |
| 0628 | 怪物行走 | 弹力带侧走、螃蟹步 | body weight | glutes | hip-abduction | glutes, legs, warm-up | false |
| 0652 | 引体向上 | 正手引体 | body weight | lats | vertical-pull | back | true |
| 0659 | 靠墙俯卧撑 | 墙壁俯卧撑 | body weight | pectorals | horizontal-push | chest, shoulders | true |
| 0662 | 俯卧撑 | — | body weight | pectorals | horizontal-push | chest, triceps | true |
| 0687 | 俄罗斯转体 | — | body weight | abs | trunk-rotation | waist | false |
| 0688 | 肩胛引体 | 肩胛下沉、Scapular Pull-up | body weight | traps | scapular-retraction | back, shoulders, warm-up | true |
| 0705 | 侧平板支撑 | 侧桥支撑 | body weight | abs | anti-extension | waist, warm-up | false |
| 0710 | 站姿髋外展 | 自重髋外展 | body weight | abductors | hip-abduction | glutes, legs, warm-up | false |
| 0735 | 仰卧起坐 | — | body weight | abs | trunk-flexion | waist | false |
| 0739 | 腿举 | 倒蹬、器械倒蹬、45°腿举 | sled machine | glutes | squat | legs, glutes | true |
| 0743 | 雪橇机哈克深蹲 | 哈克机深蹲 | sled machine | glutes | squat | legs, glutes | true |
| 0748 | 史密斯卧推 | 史密斯机卧推 | smith machine | pectorals | horizontal-push | chest | true |
| 0757 | 史密斯上斜卧推 | 史密斯机上斜卧推 | smith machine | pectorals | incline-push | chest | true |
| 0766 | 史密斯肩推 | 史密斯机肩推 | smith machine | delts | vertical-push | shoulders | true |
| 0770 | 史密斯深蹲 | 史密斯机深蹲 | smith machine | glutes | squat | legs, glutes | true |
| 0814 | 肱三头肌臂屈伸 | 双杠三头臂屈伸 | body weight | triceps | dip | triceps | true |
| 0861 | 坐姿划船 | 坐姿绳索划船、低位划船 | cable | upper back | horizontal-pull | back | true |
| 0864 | 哑铃站姿肩外旋 | 哑铃肩袖外旋、站姿哑铃外旋 | dumbbell | delts | shoulder-external-rotation | shoulders, warm-up | false |
| 0868 | 绳索弯举 | 龙门架弯举、直杆绳索弯举 | cable | biceps | elbow-flexion | biceps | false |
| 0872 | 反向卷腹 | — | body weight | abs | trunk-flexion | waist | false |
| 0979 | 水平弹力带 Pallof 推 | 水平 Pallof、抗旋转推 | band | abs | anti-rotation | waist | false |
| 0993 | 弹力带拉开 | 弹力带反向飞鸟、水平扩胸 | band | delts | shoulder-horizontal-abduction | shoulders, back, warm-up | false |
| 1017 | 弹力带 Y 字举 | 弹力带 Y raise、肩胛 Y 举 | band | delts | shoulder-abduction | shoulders, back, warm-up | false |
| 1299 | 器械上斜推胸 | — | leverage machine | pectorals | incline-push | chest | true |
| 1326 | 反握引体向上 | 反手引体、chin-up | body weight | lats | vertical-pull | back | true |
| 1350 | 器械坐姿划船 | 坐姿器械划船 | leverage machine | upper back | horizontal-pull | back | true |
| 1361 | 史密斯反手划船 | 史密斯机反手划船 | smith machine | upper back | horizontal-pull | back | true |
| 1409 | 杠铃臀桥 | 负重臀桥 | barbell | glutes | hip-thrust | glutes, legs | true |
| 1457 | 杠铃推举 | 站姿推举、实力推、过顶推 | barbell | delts | vertical-push | shoulders | true |
| 1460 | 弓步蹲 | 行走箭步蹲、walking lunge | body weight | glutes | lunge | legs, glutes | true |
| 1604 | 世界最伟大拉伸 | 伟大拉伸、World’s Greatest Stretch | body weight | hamstrings | mobility-flow | legs, glutes, warm-up | false |
| 1757 | 单腿硬拉 | 单腿罗马尼亚硬拉、哑铃单腿硬拉 | dumbbell | glutes | hip-hinge | legs, glutes | true |
| 1760 | 哑铃高脚杯深蹲 | 高脚杯深蹲 | dumbbell | quads | squat | legs, glutes | true |
| 2133 | 农夫行走 | 农夫走、Farmer’s Walk | dumbbell | quads | carry | legs, back, waist, glutes | true |
| 2137 | 哑铃阿诺德推举 | 阿诺德推举 | dumbbell | delts | vertical-push | shoulders | true |
| 2143 | 哑铃肩绕环 | 哑铃绕肩、Around the World | dumbbell | delts | shoulder-circumduction | shoulders, warm-up | false |
| 2188 | 哑铃颈后臂屈伸 | 坐姿哑铃臂屈伸、哑铃过头臂屈伸 | dumbbell | triceps | elbow-extension | triceps | false |
| 2292 | 俯身哑铃飞鸟 | 俯身反向飞鸟、俯身哑铃侧平举 | dumbbell | delts | shoulder-horizontal-abduction | shoulders | false |
| 2368 | 保加利亚分腿蹲 | 保加利亚深蹲、分腿蹲 | body weight | quads | lunge | legs, glutes | true |
| 2616 | V 杆窄距高位下拉 | V 杆下拉、窄距下拉 | cable | lats | vertical-pull | back | true |
| 3006 | 弹力带坐姿髋外展 | 弹力带髋外展 | resistance band | abductors | hip-abduction | glutes, legs, warm-up | false |
| 3011 | 上斜肩胛俯卧撑 | 上斜肩胛推、入门肩胛俯卧撑 | body weight | serratus anterior | scapular-protraction | chest, shoulders, warm-up | false |
| 3012 | 站姿肩胛后缩撑起 | 肩胛后缩、肩胛控制 | body weight | traps | scapular-retraction | back, shoulders, warm-up | false |
| 3013 | 臀桥 | 自重臀桥、地面臀桥 | body weight | glutes | hip-thrust | glutes, legs | true |
| 3021 | 肩胛俯卧撑 | 前锯肌俯卧撑 | body weight | serratus anterior | scapular-protraction | chest, shoulders, warm-up | false |
| 3561 | 臀桥行军 | 交替臀桥、臀桥抬膝 | body weight | glutes | hip-thrust | glutes, legs, warm-up | true |
| 3699 | 交替触肩 | 肩碰肩、Shoulder Tap | body weight | abs | anti-extension | waist | false |

---

## 审计备注

- 本文件只写冻结方案；没有执行代码生成，没有上传/删除 CloudBase 媒体，没有改动 spec/tests/CONTEXT。
- 上游媒体核验结论来自研究文件：B.1/B.2 所列候选 JPEG/GIF 均存在；最终实施仍需在生成前再次校验上游版本漂移。
- 任何未来新增必须沿用“精确 ID + 实际说明书 + JPEG/GIF 双存在 + 常用中文展示名/aliases + mode/tags/compound”的闭环；
  遇到重名、说明书与名字矛盾或 target 不在粗筛白名单时，标 `Unknown` 或停下审阅，不猜。
- 数量护栏：最终 136 条在“约 100–140”范围内；`0222/0223/0407/0475/0979` 等核心模式条数因排除项低于原提案的 3–6 目标，
  这是用户最终决策的直接结果，已如实记录，不用冷门动作补位。
