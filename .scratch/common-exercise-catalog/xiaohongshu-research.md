# 小红书健身房常见训练动作调研（三分化 / 四分化 / 推拉蹲髋）

- **检索日期**：2026-09-19（笔记发布时间跨度 2024-03 ～ 2026-09-17）
- **平台与后端**：小红书，Agent Reach → OpenCLI（`opencli xiaohongshu search/note -f yaml`），复用浏览器登录态
- **语料规模**：6 次关键词搜索共命中 105 条笔记；实际逐条读取 **36 条**笔记正文（含点赞 7329 / 6841 / 5251 / 4907 / 3539 等高互动样本），覆盖 20+ 位不同博主，不以单一博主为依据
- **对照基线**：`data/curated-catalog.js`（104 条精选，27 个 mode）、`data/exercises.js`、上游 `hasaneyldrm/exercises-dataset`（1,324 条，本地比对 `data/exercises.json`）
- **上游数据获取方式**：Agent Reach → gh CLI（`gh api .../contents/data/exercises.json`，17.4 MB，与 ADR-0007 记载的体量一致），ID 映射全部由该数据集实际内容核对，非按名字猜测

---

## 1. 结论摘要

1. **小红书健身房分化的主流共识是「按发力模式分」而不是「按肌群分」**：三分化以 **推 / 拉 / 腿（PPL）** 为绝对主导，四分化主流是 **胸 / 背 / 肩 / 腿（+手臂、+核心）**，二分化是 **上肢 / 下肢（躯干日 / 四肢日）**。任务提到的「推 / 拉 / 举」「推拉蹲髋」在小红书语境中对应两种说法：PPL 的推拉腿，以及功能性训练教材里的**五大动作模式：上肢推、上肢拉、旋转、下肢推（蹲/跨步）、下肢拉（髋铰链/硬拉）**。
2. **动作层面高度集中在少数几个「王牌动作」**：深蹲、硬拉、卧推、划船、下拉、飞鸟、弯举、臂屈伸、侧平举、反向飞鸟在 36 条笔记中分别被 5～16 条提及，是跨博主的高频共识；器械类（史密斯、哈克、倒蹬、器械推胸/划船/夹胸）作为「替代方案」被系统性列出。
3. **当前 `data/curated-catalog.js`（104 条）已覆盖绝大多数高频共识动作**：本次核对 137 条候选，**104 条已在库内**、27 条上游存在但未精选、6 条上游根本不存在。主要缺口是：**辅助/自重变体（辅助双杠臂屈伸、辅助引体向上、凳上反屈伸）、下拉握距变体（宽距下拉、V 杆窄距下拉、反握下拉）、单侧腿动作（单腿硬拉、哑铃箭步蹲、反向箭步蹲）、站姿绳索卷腹、站姿哑铃侧屈、侧卧抬腿、农夫行走、耸肩（斜方肌）**。
4. **有 6 个小红书出现的动作在上游数据集里根本不存在**，无法通过「补白名单 ID」解决：**杠铃臀推 / 臀冲（hip thrust）、蚌式开合（clamshell）、弹力带侧步走（band lateral walk）、静蹲（wall sit）、平板蝴蝶收腹（plank jack）、跪姿侧抬腿**。其中**臀推缺失最值得注意**——它是小红书臀腿日的核心动作，上游只有「臀桥」和一条 `resistance band hip thrusts on knees (female)` 的边缘变体。
5. **上游数据集存在 6 组重名条目**（如 `0088`/`1371` 都叫 `barbell seated calf raise`，`0576`/`0577` 都叫 `lever chest press`），因此**任何按英文名自动映射 ID 的做法都不安全**，必须按 ID 人工确认。本次映射已逐条用数据集内容核对。

---

## 2. 分化结构：小红书共识

### 2.1 三分化（PPL 推/拉/腿）——最高共识

| 训练日 | 肌群组合 | 笔记中的原话依据 |
|---|---|---|
| Day1 推日 | 胸 + 三角肌中束 + 肱三头肌 | 「推肌群一天、拉肌群一天、下肢一天，同发力模式肌肉放同一天训练」 |
| Day2 拉日 | 背 + 三角肌后束 + 肱二头肌 | 「练背所有拉拽动作天然借力肩后束、肱二头肌」 |
| Day3 臀腿日 | 臀 + 股四头肌 + 腘绳肌（+小腿） | 「下肢大肌群单独一天，大腿前侧股四、后侧腘绳+臀部集中轰炸」 |

- 循环方式有两种主流变体：**练 3 休 1 再循环（3+1）**，或**一周 6 练（连续 3 天 + 休 1 + 再 3 天）**。
- 也存在「按肌群不按模式」的三分化变体：**胸+三头 / 背+二头 / 腿+肩**（一周 3 练，0–6 个月新手），以及**胸肩三头 / 背二头肩后束 / 大腿臀部核心**。
- 参数共识：每个动作 3–4 组、8–12 次为主；组间休息推/拉日 60–90 秒，腿日 90–120 秒。

### 2.2 四分化

| 流派 | 安排 | 出现情况 |
|---|---|---|
| **胸 / 背 / 肩 / 臀腿**（主流） | 周一胸、周二背、周三肩、周四臀腿；或「周一胸+三头、周二背+二头、周四肩、周五臀腿」 | 最多笔记采用，被描述为「健身爱好者通用」「训练压力适中，恢复友好」 |
| **胸 / 背 / 肩+手臂 / 腿** | 四天覆盖胸背肩腿 + 手臂 | 「最适合入门的科学方案」 |
| **上肢 / 下肢（上/下 2×2）** | 周一上肢、周二下肢、周四上肢、周五下肢 | 明确被称为「四天上下肢训练计划」「增肌效果最好的训练方式之一」 |
| **胸 / 背 / 臀 / 肩**（居家哑铃版） | 一天专攻一个部位 | 女性/居家哑铃语境常见 |

### 2.3 二分化（上下肢）——四分化上下肢流的同一套动作库

- **躯干日**：杠铃卧推、坐姿哑铃推肩、高位下拉、坐姿划船、澳式引体（反向划船）、交替触肩
- **四肢日**：高脚杯深蹲、保加利亚深蹲、罗马尼亚硬拉、杠铃弯举、龙门直杆臂屈伸、静蹲
- 女性上肢 2 分化版本：宽距高位下拉、哑铃坐姿推肩、蝴蝶机反向飞鸟、上斜俯卧撑、窄距卧推、反向臂屈伸

### 2.4 五分化（对照，用于判断动作覆盖度）

- 周一胸 / 周二背 / 周三肩 / 周四手臂 / 周五腿 / 周末休息；被描述为「单肌群大容量刺激，适合训练 1 年以上」。
- 另一版本：周一胸、周二背、周三肩、周四臂、周五腿。

### 2.5 动作模式视角（「推拉蹲髋」的出处）

小红书有健身教练培训向笔记把基础动作明确拆成**五大动作模式（IFT 模型）**：

| 模式 | 笔记给出的代表动作 | 对应本仓 mode 词表 |
|---|---|---|
| 上肢推 | 俯卧撑、卧推、过顶推 | `horizontal-push` / `incline-push` / `vertical-push` / `dip` |
| 上肢拉 | 划船、下拉 | `horizontal-pull` / `vertical-pull` |
| 旋转 | 转体、抛球、抗旋转 | `trunk-rotation`（**抗旋转 anti-rotation 当前词表缺失**） |
| 下肢推 | 深蹲、蹬地、跨步站起 | `squat` / `lunge` / `knee-extension` |
| 下肢拉 | 硬拉、髋铰链 | `hip-hinge` / `hip-thrust` / `knee-flexion` |

另有笔记把「推拉蹲」作为最简训练日划分（推日/拉日/蹲日），并把「推拉蹲转」合称训练地图。**任务里的「推 / 拉 / 举」在小红书语料中并未作为固定分化名称出现**；「举」通常并入「推日」的过顶推举，或指「拉日」的划船类上举动作。

---

## 3. 动作清单（按训练日）

**列说明**：`模式` 用 `data/curated-catalog.js` 的受控词表，词表外的标注「新增」；`确定性` 指中文名 → 上游 4 位 ID 的映射置信度（高 = 上游英文名唯一精确匹配；中 = 名称变体或概念等价；低 = 上游无对应动作）。

### 3.1 推日（胸 / 肩 / 三头）

| 中文名 | 常见别名 | 所属分化/训练日 | 模式 | 器械 | 目标部位 | 复合 | 上游 ID | 确定性 |
|---|---|---|---|---|---|---|---|---|
| 杠铃卧推 | 平板卧推、bench press | 推日 / 胸日 | horizontal-push | 杠铃 | 胸 | 是 | 0025 | 高 |
| 哑铃卧推 | — | 推日 / 胸日 | horizontal-push | 哑铃 | 胸 | 是 | 0289 | 高 |
| 上斜杠铃卧推 | 上斜卧推 | 推日 / 胸日 | incline-push | 杠铃 | 胸 | 是 | 0047 | 高 |
| 上斜哑铃卧推 | — | 推日 / 胸日 | incline-push | 哑铃 | 胸 | 是 | 0314 | 高 |
| 器械推胸 | 悍马机推胸 | 推日 / 胸日 | horizontal-push | 器械 | 胸 | 是 | 0576 | 高（0577 重名） |
| 器械上斜推胸 | — | 推日 / 胸日 | incline-push | 器械 | 胸 | 是 | 1299 | 高 |
| 史密斯卧推 | 史密斯机卧推 | 推日 / 胸日 | horizontal-push | 史密斯 | 胸 | 是 | 0748 | 高 |
| 史密斯上斜卧推 | — | 推日 / 胸日 | incline-push | 史密斯 | 胸 | 是 | 0757 | 高 |
| 器械夹胸 | 蝴蝶机飞鸟、pec deck | 推日 / 胸日 | horizontal-push | 器械 | 胸 | 否 | 0596 | 高 |
| 哑铃飞鸟 | 平板飞鸟 | 推日 / 胸日 | horizontal-push | 哑铃 | 胸 | 否 | 0308 | 高 |
| 上斜哑铃飞鸟 | — | 推日 / 胸日 | incline-push | 哑铃 | 胸 | 否 | 0319 | 高 |
| 绳索夹胸 | 龙门架绳索夹胸 | 推日 / 胸日 | horizontal-push | 绳索 | 胸 | 否 | 0188 | 高 |
| 绳索上斜飞鸟 | — | 推日 / 胸日 | incline-push | 绳索 | 胸 | 否 | 0171 | 高 |
| 绳索站姿飞鸟 | — | 推日 / 胸日 | horizontal-push | 绳索 | 胸 | 否 | 0227 | 高 |
| 双杠臂屈伸 | 胸式臂屈伸 | 推日 / 胸日 | dip | 自重 | 胸 + 三头 | 是 | 0251 | 高 |
| 辅助双杠臂屈伸 | 辅助双杠（跪姿） | 推日 / 胸日 | dip | 辅助器械 | 胸 | 是 | 0009 | 高 |
| 俯卧撑 | — | 推日 / 胸日 | horizontal-push | 自重 | 胸 + 三头 | 是 | 0662 | 高 |
| 上斜俯卧撑 | — | 推日 / 胸日 | incline-push | 自重 | 胸 + 三头 | 是 | 0493 | 高 |
| 窄距卧推 | 杠铃窄距卧推 | 推日 / 三头 | horizontal-push | 杠铃 | 三头 + 胸 | 是 | 0030 | 高 |
| 杠铃推举 | 站姿推举、实力推、过顶推 | 推日 / 肩日 | vertical-push | 杠铃 | 肩 | 是 | 1457 | 高 |
| 杠铃坐姿过头推举 | 坐姿推举 | 推日 / 肩日 | vertical-push | 杠铃 | 肩 | 是 | 0091 | 高 |
| 哑铃推举 | 哑铃推肩、坐姿哑铃推肩 | 推日 / 肩日 | vertical-push | 哑铃 | 肩 | 是 | 0405 | 高 |
| 器械肩推 | 器械推举 | 推日 / 肩日 | vertical-push | 器械 | 肩 | 是 | 0603 | 高 |
| 史密斯肩推 | — | 推日 / 肩日 | vertical-push | 史密斯 | 肩 | 是 | 0766 | 高 |
| 阿诺德推举 | — | 推日 / 肩日 | vertical-push | 哑铃 | 肩 | 是 | 2137 | 高 |
| 哑铃侧平举 | — | 推日 / 肩日 | shoulder-abduction | 哑铃 | 肩中束 | 否 | 0334 | 高 |
| 绳索侧平举 | 龙门架侧平举 | 推日 / 肩日 | shoulder-abduction | 绳索 | 肩中束 | 否 | 0178 | 高 |
| 器械侧平举 | — | 推日 / 肩日 | shoulder-abduction | 器械 | 肩中束 | 否 | 0584 | 高 |
| 哑铃前平举 | — | 推日 / 肩日 | shoulder-flexion | 哑铃 | 肩前束 | 否 | 0310 | 高 |
| 杠铃直立划船 | 直立划船 | 推日 / 肩日 | upright-row | 杠铃 | 肩 | 是 | 0120 | 高 |
| Y 字侧平举 | Y raise | 推日 / 肩日 | shoulder-abduction（新增 y-raise） | 哑铃 | 肩中束 | 否 | 3541 | 中（上游 target=upper back） |
| 绳索下压 | 龙门架下压、三头下压 | 推日 / 三头 | elbow-extension | 绳索 | 三头 | 否 | 0201 | 高 |
| 绳索下压（绳索附件） | 绳索臂屈伸 | 推日 / 三头 | elbow-extension | 绳索 | 三头 | 否 | 0200 | 高 |
| 绳索 V 杆下压 | V-bar 下压 | 推日 / 三头 | elbow-extension | 绳索 | 三头 | 否 | 0241 | 高 |
| 仰卧臂屈伸 | 碎颅式、skull crusher | 推日 / 三头 | elbow-extension | 杠铃 | 三头 | 否 | 0060 | 高 |
| 杠铃过头臂屈伸 | 坐姿过头臂屈伸 | 推日 / 三头 | elbow-extension | 杠铃 | 三头 | 否 | 0092 | 高 |
| 绳索过头臂屈伸 | 龙门架过头臂屈伸 | 推日 / 三头 | elbow-extension | 绳索 | 三头 | 否 | 0194 | 高 |
| 哑铃颈后臂屈伸 | 坐姿哑铃臂屈伸 | 推日 / 三头 | elbow-extension | 哑铃 | 三头 | 否 | 2188 | 高 |
| 哑铃后摆臂屈伸 | 哑铃俯身臂屈伸、哑铃回扣 | 推日 / 三头 | elbow-extension | 哑铃 | 三头 | 否 | 0333 | 高 |
| 器械臂屈伸 | — | 推日 / 三头 | elbow-extension | 器械 | 三头 | 否 | 0607 | 高 |
| 肱三头肌臂屈伸 | 双杠（三头侧重） | 推日 / 三头 | dip | 自重 | 三头 | 是 | 0814 | 高 |
| 辅助肱三头肌臂屈伸 | 辅助臂屈伸（跪姿） | 推日 / 三头 | dip | 辅助器械 | 三头 | 是 | 0019 | 高 |
| 凳上反屈伸 | 反向臂屈伸、bench dip | 推日 / 三头 | dip | 自重 | 三头 | 是 | 0129 | 高 |

### 3.2 拉日（背 / 后束 / 二头）

| 中文名 | 常见别名 | 所属分化/训练日 | 模式 | 器械 | 目标部位 | 复合 | 上游 ID | 确定性 |
|---|---|---|---|---|---|---|---|---|
| 引体向上 | 正手引体 | 拉日 / 背日 | vertical-pull | 自重 | 背 | 是 | 0652 | 高 |
| 反握引体向上 | 反手引体、chin-up | 拉日 / 背日 / 二头 | vertical-pull | 自重 | 背 + 二头 | 是 | 1326 | 高 |
| 辅助引体向上 | 辅助引体 | 拉日 / 背日 | vertical-pull | 辅助器械 | 背 | 是 | 0017 | 高 |
| 高位下拉 | 下拉、lat pulldown | 拉日 / 背日 | vertical-pull | 绳索 | 背阔肌 | 是 | 0198 | 高 |
| 宽距下拉 | 宽距高位下拉 | 拉日 / 背日 | vertical-pull | 绳索 | 背阔肌 | 是 | 0150 | 中（上游名 cable bar lateral pulldown） |
| V 杆 / 窄距下拉 | 窄距下拉 | 拉日 / 背日 | vertical-pull | 绳索 | 背阔肌 | 是 | 2616 | 中 |
| 反握下拉 | 反手高位下拉 | 拉日 / 背日 | vertical-pull | 绳索 | 背阔肌 | 是 | 0245 | 中 |
| 反握器械背阔肌下拉 | 器械下拉 | 拉日 / 背日 | vertical-pull | 器械 | 背阔肌 | 是 | 0673 | 高 |
| 杠铃俯身划船 | 杠铃划船、俯身划船 | 拉日 / 背日 | horizontal-pull | 杠铃 | 上背 | 是 | 0027 | 高 |
| 哑铃俯身划船 | 单臂哑铃划船、哑铃划船 | 拉日 / 背日 | horizontal-pull | 哑铃 | 上背 | 是 | 0293 | 高 |
| 反握杠铃俯身划船 | 反手杠铃划船 | 拉日 / 背日 | horizontal-pull | 杠铃 | 上背 | 是 | 0118 | 高 |
| 史密斯反手划船 | 史密斯机反手划船 | 拉日 / 背日 | horizontal-pull | 史密斯 | 上背 | 是 | 1361 | 高 |
| 坐姿划船 | 坐姿绳索划船、低位划船 | 拉日 / 背日 | horizontal-pull | 绳索 | 上背 | 是 | 0861 | 高 |
| 器械坐姿划船 | 坐姿器械划船 | 拉日 / 背日 | horizontal-pull | 器械 | 上背 | 是 | 1350 | 高 |
| T 杆划船 | T 字杠划船 | 拉日 / 背日 | horizontal-pull | 器械 | 上背 | 是 | 0606 | 高 |
| 绳索 V 杆划船 | 高位划船、V 杆划船 | 拉日 / 背日 | horizontal-pull | 绳索 | 背阔肌 | 是 | 0213 | 高 |
| 反向划船 | 澳式引体、inverted row | 拉日 / 背日、躯干日 | horizontal-pull | 自重 | 上背 | 是 | 0499 | 高 |
| 直臂下拉 | 直臂绳索下压 | 拉日 / 背日 | shoulder-extension | 绳索 | 背阔肌 | 否 | 0238 | 高 |
| 绳索面拉 | 面拉、face pull | 拉日 / 后束 | shoulder-horizontal-abduction | 绳索 | 肩后束 | 否 | 0233 | 中（上游无 face pull 名） |
| 俯身哑铃飞鸟 | 俯身反向飞鸟、俯身哑铃侧平举 | 拉日 / 后束 | shoulder-horizontal-abduction | 哑铃 | 肩后束 | 否 | 2292 | 高 |
| 器械反向飞鸟 | 蝴蝶机反向飞鸟 | 拉日 / 后束 | shoulder-horizontal-abduction | 器械 | 肩后束 | 否 | 0602 | 高 |
| 杠铃弯举 | — | 拉日 / 二头 | elbow-flexion | 杠铃 | 二头 | 否 | 0031 | 高 |
| 曲杠弯举 | EZ 杠弯举 | 拉日 / 二头 | elbow-flexion | 曲杠 | 二头 | 否 | 0447 | 高 |
| 哑铃弯举 | — | 拉日 / 二头 | elbow-flexion | 哑铃 | 二头 | 否 | 0294 | 高 |
| 哑铃上斜弯举 | 上斜弯举 | 拉日 / 二头 | elbow-flexion | 哑铃 | 二头 | 否 | 0315 | 高 |
| 哑铃集中弯举 | 集中弯举 | 拉日 / 二头 | elbow-flexion | 哑铃 | 二头 | 否 | 0297 | 高 |
| 锤式弯举 | 哑铃锤式弯举 | 拉日 / 二头 | elbow-flexion | 哑铃 | 二头 | 否 | 0313 | 高 |
| 绳索锤式弯举 | 绳索锤式弯举（绳索附件） | 拉日 / 二头 | elbow-flexion | 绳索 | 二头 | 否 | 0165 | 高 |
| 哑铃牧师凳弯举 | 牧师椅弯举 | 拉日 / 二头 | elbow-flexion | 哑铃 | 二头 | 否 | 0372 | 高 |
| 器械牧师凳弯举 | 器械弯举 | 拉日 / 二头 | elbow-flexion | 器械 | 二头 | 否 | 0592 | 高 |
| 绳索弯举 | 龙门架钢线弯举、直杆绳索弯举 | 拉日 / 二头 | elbow-flexion | 绳索 | 二头 | 否 | 0868 | 高 |
| 器械弯举 | — | 拉日 / 二头 | elbow-flexion | 器械 | 二头 | 否 | 0575 | 高 |
| 山羊挺身 | 罗马椅挺身、背伸展 | 拉日 / 背日、腿日 | trunk-extension | 自重 | 竖脊肌 | 否 | 0489 | 高 |
| 器械山羊挺身 | 器械背伸展 | 拉日 / 背日 | trunk-extension | 器械 | 竖脊肌 | 否 | 0573 | 高 |
| 杠铃耸肩 | 耸肩 | 拉日 / 斜方肌 | shoulder-shrug（新增） | 杠铃 | 斜方肌 | 否 | 0095 | 高（target=traps 在白名单外） |
| 哑铃耸肩 | 耸肩 | 拉日 / 斜方肌 | shoulder-shrug（新增） | 哑铃 | 斜方肌 | 否 | 0406 | 高（同上） |
| 交替触肩 | shoulder tap | 躯干日 / 核心 | anti-extension | 自重 | 核心 | 否 | 3699 | 高 |

### 3.3 腿 / 臀日

| 中文名 | 常见别名 | 所属分化/训练日 | 模式 | 器械 | 目标部位 | 复合 | 上游 ID | 确定性 |
|---|---|---|---|---|---|---|---|---|
| 杠铃深蹲 | 深蹲、后蹲 | 腿日 | squat | 杠铃 | 腿 + 臀 | 是 | 0043 | 高 |
| 杠铃前蹲 | 颈前深蹲 | 腿日 | squat | 杠铃 | 腿 + 臀 | 是 | 0042 | 高 |
| 杠铃哈克深蹲 | 哈克深蹲 | 腿日 | squat | 杠铃 | 腿 + 臀 | 是 | 0046 | 高 |
| 哈克深蹲（雪橇机） | 哈克机反向深蹲 | 腿日 | squat | 雪橇机 | 腿 + 臀 | 是 | 0743 | 高 |
| 史密斯深蹲 | — | 腿日 | squat | 史密斯 | 腿 + 臀 | 是 | 0770 | 高 |
| 哑铃高脚杯深蹲 | 高脚杯深蹲 | 四肢日 / 腿日 | squat | 哑铃 | 股四头肌 | 是 | 1760 | 高 |
| 腿举 | 倒蹬、器械倒蹬、45° 腿举 | 腿日 | squat | 雪橇机 | 腿 + 臀 | 是 | 0739 | 高 |
| 保加利亚分腿蹲 | 保加利亚深蹲、分腿蹲 | 腿日 / 四肢日 | lunge | 自重 / 哑铃 | 股四 + 臀 | 是 | 2368 | 高 |
| 弓步蹲 | 行走箭步蹲、walking lunge | 腿日 | lunge | 自重 | 腿 + 臀 | 是 | 1460 | 高 |
| 哑铃箭步蹲 | 箭步蹲 | 腿日 | lunge | 哑铃 | 腿 + 臀 | 是 | 0336 | 高 |
| 反向箭步蹲 | 后撤箭步蹲 | 腿日 | lunge | 哑铃 | 腿 + 臀 | 是 | 0381 | 高 |
| 哑铃登阶 | 登阶、step up | 腿日 | lunge | 哑铃 | 腿 + 臀 | 是 | 0431 | 高 |
| 器械腿屈伸 | 坐姿腿屈伸 | 腿日 | knee-extension | 器械 | 股四头肌 | 否 | 0585 | 高 |
| 俯卧腿弯举 | 腿弯举 | 腿日 | knee-flexion | 器械 | 腘绳肌 | 否 | 0586 | 高 |
| 坐姿腿弯举 | 坐姿腿弯举 | 腿日 | knee-flexion | 器械 | 腘绳肌 | 否 | 0599 | 高 |
| 杠铃硬拉 | 硬拉 | 腿日 / 拉日 | hip-hinge | 杠铃 | 腿 + 臀 + 背 | 是 | 0032 | 高 |
| 罗马尼亚硬拉 | RDL | 腿日 | hip-hinge | 杠铃 | 腿 + 臀 | 是 | 0085 | 高 |
| 哑铃直腿硬拉 | 直腿硬拉 | 腿日 | hip-hinge | 哑铃 | 腿 + 臀 | 是 | 0432 | 高 |
| 相扑硬拉 | 宽站距硬拉 | 腿日 | hip-hinge | 杠铃 | 腿 + 臀 | 是 | 0117 | 高 |
| 单腿硬拉 | 单腿罗马尼亚硬拉 | 腿日 | hip-hinge | 哑铃 | 臀 + 腘绳 | 是 | 1757 | 高 |
| 器械髋内收 | 坐姿髋内收、腿内收 | 腿日 / 臀 | hip-adduction | 器械 | 内收肌 | 否 | 0598 | 高 |
| 器械髋外展 | 坐姿髋外展 | 腿日 / 臀 | hip-abduction | 器械 | 臀中肌 | 否 | 0597 | 高 |
| 侧卧抬腿 | 自重髋外展 | 臀 / 腿日 | hip-abduction | 自重 | 臀中肌 | 否 | 0710 | 中（上游名 side hip abduction） |
| 杠铃坐姿提踵 | 坐姿提踵 | 腿日 | plantar-flexion | 杠铃 | 小腿 | 否 | 0088 | 高（1371 重名） |
| 站姿提踵 | 器械站姿提踵 | 腿日 | plantar-flexion | 器械 | 小腿 | 否 | 0605 | 高 |
| 哑铃站姿提踵 | — | 腿日 | plantar-flexion | 哑铃 | 小腿 | 否 | 0417 | 高 |
| 杠铃臀桥 | 臀桥、臀冲（部分博主混用） | 臀 / 腿日 | hip-thrust | 杠铃 | 臀 | 是 | 1409 | 高 |
| 臀桥 | 自重臀桥、地面臀桥 | 臀 / 腿日 | hip-thrust | 自重 | 臀 | 是 | 3013 | 高 |
| 臀桥（双腿垫高） | 垫高臀桥 | 臀日 | hip-thrust | 杠铃 | 臀 | 是 | 3562 | 高 |
| 绳索穿腿后拉 | 绳索拉裆、pull through | 臀日 | hip-hinge | 绳索 | 臀 | 是 | 0196 | 高 |
| 绳索后踢腿 | 绳索髋伸展、kickback | 臀日 | hip-extension | 绳索 | 臀 | 否 | 0228 | 高 |
| 怪物行走 | 弹力带行走 | 臀日 | hip-abduction | 自重 / 弹力带 | 臀 | 否 | 0628 | 高 |
| 农夫行走 | 单臂农夫行走、farmer's walk | 核心 / 全身 | carry（新增） | 哑铃 | 竖脊肌 + 前臂 | 是 | 2133 | 高 |
| 壶铃摇摆 | 壶铃摆荡、swing | 腿日 / 后链 | hip-hinge | 壶铃 | 臀 + 腘绳 | 是 | 0549 | 高（壶铃→「其他」桶） |

### 3.4 核心（腰腹）

| 中文名 | 常见别名 | 所属分化/训练日 | 模式 | 器械 | 目标部位 | 复合 | 上游 ID | 确定性 |
|---|---|---|---|---|---|---|---|---|
| 卷腹 | — | 核心日 | trunk-flexion | 自重 | 腹直肌 | 否 | 0274 | 高 |
| 仰卧起坐 | sit-up | 核心日 | trunk-flexion | 自重 | 腹直肌 | 否 | 0735 | 高 |
| 折刀式仰卧起坐 | 折刀起坐 | 核心日 | trunk-flexion | 自重 | 腹直肌 | 否 | 0507 | 高 |
| 仰卧举腿 | 躺姿抬腿 | 核心日 | trunk-flexion | 自重 | 下腹 | 否 | 0620 | 高 |
| 悬垂举腿 | 悬挂抬脚、悬垂抬腿 | 核心日 | trunk-flexion | 自重 | 下腹 | 否 | 0472 | 高 |
| 悬垂直腿举腿 | 悬垂直腿抬脚 | 核心日 | trunk-flexion | 自重 | 下腹 | 否 | 0475 | 高 |
| 反向卷腹 | — | 核心日 | trunk-flexion | 自重 | 下腹 | 否 | 0872 | 高 |
| 绳索卷腹 | 跪姿绳索卷腹 | 核心日 | trunk-flexion | 绳索 | 上腹 | 否 | 0175 | 高 |
| 站姿绳索卷腹 | 龙门架站姿卷腹 | 核心日 | trunk-flexion | 绳索 | 上腹 | 否 | 0226 | 高 |
| 俄罗斯转体 | — | 核心日 | trunk-rotation | 自重 / 药球 | 腹斜肌 | 否 | 0687 | 高 |
| 绳索转体 | 站姿绳索转体 | 核心日 | trunk-rotation | 绳索 | 腹斜肌 | 否 | 0243 | 高 |
| 平板支撑 | 平板、plank | 核心日 | anti-extension | 自重 | 核心 | 否 | 0464 | 高 |
| 侧平板支撑 | 侧桥支撑、side plank | 核心日 | anti-extension | 自重 | 腹斜肌 | 否 | 0705 | 高 |
| 死虫式 | 死虫 | 核心日 | anti-extension | 自重 | 核心 | 否 | 0276 | 高 |
| 站姿哑铃侧屈 | 哑铃体侧屈 | 核心日 | trunk-rotation（侧屈，词表待定） | 哑铃 | 腹斜肌 | 否 | 0407 | 高 |
| 背伸展（瑞士球） | 俯卧背伸展 | 核心日 | trunk-extension | 瑞士球 | 竖脊肌 | 否 | 1314 | 中（上游名 back extension on exercise ball） |
| 绳索侧卷腹 | 侧向绳索卷腹 | 核心日 | trunk-flexion（侧向） | 绳索 | 腹斜肌 | 否 | 0223 | 高 |

### 3.5 上游数据集不存在、无法直接补 ID 的动作

| 中文名 | 常见别名 | 所属分化/训练日 | 模式 | 器械 | 目标部位 | 复合 | 上游 ID | 确定性 |
|---|---|---|---|---|---|---|---|---|
| 杠铃臀推 / 臀冲 | 臀推、hip thrust | 臀 / 腿日 | hip-thrust | 杠铃 | 臀 | 是 | — | 低（上游无 barbell hip thrust，仅 3236 弹力带跪姿变体） |
| 蚌式开合 | 蚌式、clamshell | 臀日 | hip-abduction | 自重 / 弹力带 | 臀中肌 | 否 | — | 低（上游无） |
| 弹力带侧步走 | 侧向行走、lateral band walk | 臀日 | hip-abduction | 弹力带 | 臀中肌 | 否 | — | 低（上游无） |
| 静蹲 | 靠墙静蹲、wall sit | 四肢日 / 腿日 | squat（等长） | 自重 | 股四头肌 | 否 | — | 低（上游无） |
| 平板蝴蝶收腹 | plank jack | 核心日 | anti-extension（动态） | 自重 | 核心 | 否 | — | 低（上游无） |
| 跪姿侧抬腿 | 四点跪姿髋外展 | 臀日 | hip-abduction | 自重 | 臀中肌 | 否 | — | 低（上游无精确对应） |

---

## 4. 频次分层（依据：36 条笔记正文的词频统计）

统计口径：某动作/模式在 **多少条不同笔记** 的正文中被明确提到（不是出现次数），因此可跨博主去重。

### 4.1 高频共识（≥5 条笔记提及）——可直接视为「健身房必备」

| 动作/模式 | 提及笔记数 | 当前精选库状态 |
|---|---|---|
| 深蹲（含各变体） | 16 | 已覆盖（0043/0042/0046/0743/0770/1760） |
| 硬拉（含各变体） | 14 | 已覆盖（0032/0085/0432/0117） |
| 下拉（含各握距） | 13 | 部分覆盖（仅 0198/0673，缺宽距/V杆/反握） |
| 划船（含各器械） | 13 | 已覆盖（0027/0293/0861/1350/0606/0213/0499） |
| 卧推（含各角度） | 12 | 已覆盖（0025/0289/0047/0314/0748/0757/0576/1299） |
| 飞鸟 / 夹胸 | 10 | 已覆盖（0308/0319/0171/0188/0227/0596） |
| 弯举（含各器械） | 10 | 已覆盖（0031/0447/0294/0315/0297/0313/0165/0372/0592/0868） |
| 臂屈伸（含下压/过头/双杠） | 9 | 已覆盖（0060/0092/0194/0201/0200/0607/0333/0814/0019） |
| 高位下拉 | 9 | 已覆盖（0198） |
| 侧平举 | 8 | 已覆盖（0334/0178/0584） |
| 反向飞鸟 / 后束 | 7 | 已覆盖（2292/0602/0233） |
| 坐姿划船 | 7 | 已覆盖（0861/1350） |
| 三头下压 | 6 | 已覆盖（0201/0200） |
| 推举（肩推 / 过顶推） | 5 | 已覆盖（1457/0091/0405/0603/0766/2137） |
| 引体向上 | 5 | 已覆盖（0652/1326） |
| 杠铃划船 | 5 | 已覆盖（0027） |
| 夹胸（器械/绳索） | 5 | 已覆盖（0596/0188） |

### 4.2 常见替代（2–4 条笔记提及）——「器械/条件不足时用什么替代」

| 动作/模式 | 提及笔记数 | 精选库状态 |
|---|---|---|
| 双杠臂屈伸 | 4 | 已覆盖（0251） |
| 腿弯举（俯卧/坐姿） | 4 | 已覆盖（0586/0599） |
| 腿举 / 倒蹬 | 4 | 已覆盖（0739） |
| 面拉 | 3 | 已覆盖（0233，作为「绳索面拉」） |
| 保加利亚分腿蹲 | 3 | 已覆盖（2368） |
| 臀桥 | 3 | 已覆盖（1409/3013） |
| 窄距（卧推 / 下拉） | 3 | 窄距卧推已覆盖（0030）；窄距下拉**缺失** |
| 哑铃侧平举 | 3 | 已覆盖（0334） |
| 哈克深蹲 | 3 | 已覆盖（0046/0743） |
| 卷腹 | 3 | 已覆盖（0274） |
| 哑铃推肩 | 3 | 已覆盖（0405） |
| 俯卧撑 | 3 | 已覆盖（0662） |
| 哑铃飞鸟 | 3 | 已覆盖（0308） |
| 锤式弯举 | 2 | 已覆盖（0313/0165） |
| 箭步蹲 | 2 | 已覆盖（1460）；**哑铃/反向箭步蹲缺失** |
| 山羊挺身 | 2 | 已覆盖（0489/0573） |
| 窄距卧推 | 2 | 已覆盖（0030） |
| 哑铃卧推 | 2 | 已覆盖（0289） |
| 倒蹬 | 2 | 已覆盖（0739） |
| 髋外展 | 2 | 已覆盖（0597）；**自重侧卧抬腿缺失** |
| 转体 | 2 | 已覆盖（0243/0687） |
| 宽距（下拉） | 2 | **缺失** |
| 史密斯（机系列） | 2 | 已覆盖（0748/0757/0766/0770） |
| 哑铃划船 | 2 | 已覆盖（0293） |
| 耸肩 | 2 | **缺失**（0095/0406 上游有，target=traps 在白名单外） |
| 腿屈伸 | 2 | 已覆盖（0585） |
| 罗马尼亚硬拉 | 2 | 已覆盖（0085） |
| 龙门架（绳索）系列 | 2 | 已覆盖多条目 |

### 4.3 低频变式（仅 1 条笔记提及）——证据不足，不建议据此扩库

农夫行走、壶铃摇摆、蚌式开合、侧卧抬腿、器械侧平举、器械推胸、臀冲、髋内收、死虫式、器械弯举、器械臂屈伸、器械反向飞鸟、臀推、举腿、上斜卧推、单腿硬拉、器械推举、前平举、器械夹胸、上斜俯卧撑、高脚杯深蹲、静蹲、交替触肩、澳式引体、肩推。

> 说明：低频 ≠ 不重要。单腿硬拉、高脚杯深蹲、澳式引体、交替触肩、静蹲来自「凯圣王×谭成义」体系笔记，是完整计划的一部分，只是在小红书整体语料里传播度低。建议按「计划完整性」而非「词频」决定是否收录。

---

## 5. 对照 `data/curated-catalog.js` 的缺口

核对方式：把 3 节全部候选（137 条）逐一在上游 `exercises.json` 里按**精确英文名**解析出 4 位 ID，再与 `curated-catalog.js` 的 104 条白名单求差。**未按中文名或关键词猜 ID。**

### 5.1 上游存在、但未进精选白名单（可直接补 ID）

| 中文名 | 上游英文名 | ID | 器械 | target | 缺口性质 |
|---|---|---|---|---|---|
| 辅助双杠臂屈伸 | assisted chest dip (kneeling) | 0009 | 辅助器械 | pectorals | 高频动作的入门替代；库内只有 0019（三头版） |
| 凳上反屈伸 | bench dip (knees bent) | 0129 | 自重 | triceps | 高频三头自重动作，完全缺失 |
| 哑铃颈后臂屈伸 | dumbbell seated triceps extension | 2188 | 哑铃 | triceps | 库内三头过头只有杠铃/绳索，缺哑铃 |
| 绳索 V 杆下压 | cable triceps pushdown (v-bar) | 0241 | 绳索 | triceps | 库内已有 0200/0201，属附件变体，优先级低 |
| 绳索直立划船 | cable upright row | 0246 | 绳索 | delts | 库内只有 0120 杠铃直立划船 |
| 哑铃直立划船 | dumbbell upright row | 0437 | 哑铃 | delts | 同上 |
| Y 字侧平举 | dumbbell incline y-raise | 3541 | 哑铃 | upper back | 笔记明确列出的中束动作；上游 target 归为 upper back，需人工改标 |
| 辅助引体向上 | assisted pull-up | 0017 | 辅助器械 | lats | 引体做不了时的标准替代，缺失 |
| 宽距下拉 | cable bar lateral pulldown | 0150 | 绳索 | lats | 下拉握距变体，笔记高频出现 |
| V 杆 / 窄距下拉 | cable lateral pulldown with v-bar | 2616 | 绳索 | lats | 同上 |
| 反握下拉 | cable underhand pulldown | 0245 | 绳索 | lats | 同上 |
| 反握杠铃俯身划船 | barbell reverse grip bent over row | 0118 | 杠铃 | upper back | 库内只有正握 0027 |
| 史密斯反手划船 | smith reverse grip bent over row | 1361 | 史密斯 | upper back | 笔记（轻轻健身）明确列出 |
| 器械弯举 | lever bicep curl | 0575 | 器械 | biceps | 库内只有 0592 器械牧师凳弯举 |
| 绳索牧师凳弯举 | cable preacher curl | 0195 | 绳索 | biceps | 优先级低（已有 0868/0592） |
| 交替触肩 | shoulder tap | 3699 | 自重 | abs | 凯圣王二分化核心动作 |
| 杠铃耸肩 | barbell shrug | 0095 | 杠铃 | **traps** | 上游有，但 `TARGET_WHITELIST` 不含 traps → 需先扩白名单 |
| 哑铃耸肩 | dumbbell shrug | 0406 | 哑铃 | **traps** | 同上 |
| 哑铃箭步蹲 | dumbbell lunge | 0336 | 哑铃 | glutes | 库内只有自重 1460 |
| 反向箭步蹲 | dumbbell rear lunge | 0381 | 哑铃 | glutes | 笔记（肌肉对应动作大全）明确列出 |
| 单腿硬拉 | dumbbell single leg deadlift | 1757 | 哑铃 | glutes | 凯圣王 PPL 腿日动作 |
| 臀桥（双腿垫高） | barbell glute bridge two legs on bench (male) | 3562 | 杠铃 | glutes | 优先级低（已有 1409） |
| 侧卧抬腿 | side hip abduction | 0710 | 自重 | abductors | 臀中肌自重动作 |
| 壶铃摇摆 | kettlebell swing | 0549 | **壶铃** | glutes | 壶铃归入「其他」桶，需确认是否接受 |
| 农夫行走 | farmers walk | 2133 | 哑铃 | quads | 竖脊肌/负重行走，需要新 mode `carry` |
| 站姿绳索卷腹 | cable standing crunch | 0226 | 绳索 | abs | 笔记（轻轻健身）明确列出；库内只有 0175 跪姿 |
| 站姿哑铃侧屈 | dumbbell side bend | 0407 | 哑铃 | abs | 竖脊肌/腰方肌动作，需要新 mode（侧屈） |
| 绳索侧卷腹 | cable side crunch | 0223 | 绳索 | abs | 腹斜肌，优先级低 |
| 悬垂直腿举腿 | hanging straight leg raise | 0475 | 自重 | abs | 优先级低（已有 0472） |
| 背伸展（瑞士球） | back extension on exercise ball | 1314 | 瑞士球 | spine | 瑞士球 → 「其他」桶，需确认是否接受 |

**注意（重名陷阱）**：上游有 6 组重名条目，其中两组正好落在本仓用词上——
- `0088` 与 `1371` 同名 `barbell seated calf raise`（`0088` 已精选）
- `0576` 与 `0577` 同名 `lever chest press`（`0576` 已精选）

因此**任何脚本按 name 反查 ID 都可能选错条目**（本次核对已确认 `0088`/`0576` 才是库内条目）。补白名单时必须以 ID 为准。

> 说明：上表含 3 条在 §3 清单之外的补充候选（`0246 cable upright row`、`0437 dumbbell upright row`、`0195 cable preacher curl`），它们是核对过程中发现的上游同名变体，一并列出以便决策。

### 5.2 上游数据集根本不存在（无法靠补 ID 解决）

| 中文名 | 小红书定位 | 上游核查结果 | 建议 |
|---|---|---|---|
| **杠铃臀推 / 臀冲** | 臀腿日核心动作，被称作「打造饱满臀大肌的王牌动作」 | 无 `barbell hip thrust`；只有 `3236 resistance band hip thrusts on knees (female)` | 最高优先级缺口。要么接受 1409 杠铃臀桥作为替代并做产品文案说明，要么新增自定义动作（脱离上游 ID 体系，需架构决策） |
| 蚌式开合 | 臀中肌激活动作 | 无 `clamshell` | 可用 0597/0710 替代 |
| 弹力带侧步走 | 臀中肌激活 | 无 `band lateral walk` | 可用 0628 怪物行走替代 |
| 静蹲 | 凯圣王四肢日收尾（等长） | 无 `wall sit` | 无替代；只能自定义或舍弃 |
| 平板蝴蝶收腹 | 核心日动作 | 无 `plank jack` | 可用 0464 平板支撑替代 |
| 跪姿侧抬腿 | 臀中肌 | 无精确对应 | 用 0710 侧卧抬腿替代 |

> **面拉（face pull）** 需单独说明：上游**没有** `face pull` 这个名字，但 `0233 cable standing rear delt row (with rope)` 就是面拉动作本身，本仓已精选并命名为「绳索面拉」，**不算缺口**。

### 5.3 模式（mode）层面的缺口

| 缺口 | 小红书依据 | 上游可用 ID | 说明 |
|---|---|---|---|
| `anti-rotation`（抗旋转） | 五大动作模式笔记明确把「抗旋转」列为独立模式 | 0979 / 1015 `band horizontal/vertical pallof press` | 当前 mode 词表无此项，且无精选动作 |
| `carry`（负重行走） | 「单臂农夫行走」用于竖脊肌/腰方肌 | 2133 `farmers walk` | 词表与动作双缺 |
| `shoulder-shrug`（耸肩） | 斜方肌训练 | 0095 / 0406 | 词表缺 + `TARGET_WHITELIST` 不含 traps |
| 侧屈（trunk lateral flexion） | 「站姿哑铃侧屈」用于腹斜肌/腰方肌 | 0407 | 当前 `trunk-rotation` 勉强可容纳，语义不准 |
| `isometric`（等长） | 静蹲、平板支撑类 | 上游无静蹲 | 词表缺；平板支撑现归 `anti-extension` |
| `y-raise` | Y 字侧平举 | 3541 | 现可归 `shoulder-abduction`，但动作轨迹不同 |

**已被完整覆盖的模式**：horizontal-push / incline-push / vertical-push / dip / horizontal-pull / vertical-pull / shoulder-extension / shoulder-abduction / shoulder-flexion / shoulder-horizontal-abduction / upright-row / elbow-flexion / elbow-extension / squat / lunge / knee-extension / knee-flexion / hip-hinge / hip-thrust / hip-abduction / hip-adduction / hip-extension / plantar-flexion / trunk-flexion / trunk-rotation / trunk-extension / anti-extension —— 三分化与四分化所需的动作模式**没有遗漏**，缺口集中在「握距/单侧/辅助/自重」这几类细分变体。

### 5.4 已确认覆盖（无需改动）

胸（8 个推类 + 6 个飞鸟/夹胸 + 3 个自重）、背（7 个划船 + 4 个下拉 + 直臂下拉 + 3 个后束）、肩（6 个推举 + 3 个侧平举 + 前平举 + 直立划船）、二头（10 条）、三头（10 条）、腿（5 个深蹲 + 4 个硬拉 + 腿举 + 弓步/分腿 + 屈伸/弯举 + 3 个提踵 + 髋外展/内收）、臀（臀桥 ×2 + 穿腿后拉 + 后踢腿 + 怪物行走）、腰腹（12 条）—— 与小红书高频共识高度一致。

---

## 6. exerciseId 映射确定性说明

| 确定性 | 含义 | 本次命中条数 | 典型例子 |
|---|---|---|---|
| **高** | 上游英文名唯一、精确匹配，ID 可直接写入白名单 | 124 条 | 杠铃卧推 → `0025`、杠铃深蹲 → `0043`、引体向上 → `0652` |
| **中** | 名称变体 / 概念等价，需人工确认目标部位或 mode | 7 条 | 面拉 → `0233`（上游无 face pull 名）；宽距下拉 → `0150`；V 杆下拉 → `2616`；反握下拉 → `0245`；侧卧抬腿 → `0710`；Y 字侧平举 → `3541`（上游 target 标为 upper back） |
| **低** | 上游无对应动作，无法映射 | 6 条（137 条候选合计） | 杠铃臀推、蚌式开合、弹力带侧步走、静蹲、平板蝴蝶收腹、跪姿侧抬腿 |

**两条重名风险项**（映射时必须按 ID 而非 name 确认）：`barbell seated calf raise` = `0088`/`1371`；`lever chest press` = `0576`/`0577`。本仓当前选用的是 `0088` 与 `0576`。

---

## 7. 来源（逐条读取正文的 36 条小红书笔记）
| # | 笔记标题 | 博主 | 点赞 | 发布时间 | 本次贡献 | 链接 |
|---|---|---|---|---|---|---|
| 1 | 三分化训练计划｜一周6练，推拉腿循环 | 线条大狗（增肌中） | 700 | 2026-07-02 | 三分化 6 练结构（练3休1×2） | [链接](https://www.xiaohongshu.com/search_result/6a45eb720000000011013622?xsec_token=ABMfcLkMJz39ff6CSBSNmUEc8EiM4eA1z0FydRwKyx8ac=&xsec_source=) |
| 2 | 四分化训练计划来了！！！ | 达达（增肌版） | 7746 | 2024-12-08 | 四分化 胸/背/肩/臀腿 完整动作表 | [链接](https://www.xiaohongshu.com/search_result/6755bd07000000000402a421?xsec_token=ABuQFQlnVjMSNcXCykOjO9zoM4nI19r5Uo1j9qS0tzoKw=&xsec_source=) |
| 3 | 健身进阶｜四分化训练｜保姆级训练计划🔥 | 洒脱的静静子 | 2609 | 2025-02-10 | 四分化进阶（正文无动作，仅结构） | [链接](https://www.xiaohongshu.com/search_result/67a9e03a000000001902fa1a?xsec_token=ABMWliz9tJ2yAaXq7-xaGQ1aNdUwSAVkonAWdY9dl2gr8=&xsec_source=) |
| 4 | 一周四练四分化健身计划 | 爱健身的毛毛 | 1684 | 2026-01-09 | 四分化 胸+三头/背+二头/肩/臀腿 结构 | [链接](https://www.xiaohongshu.com/search_result/6960d5eb000000001a01c8ee?xsec_token=AByaLM0s3GKEBuZt2qPAjy95dMeTfoDnByPyB3p7ly5Ss=&xsec_source=) |
| 5 | 谭成义新手三分化训练全套 | 煤球健身 | 131 | 2026-08-03 | 谭成义三分化（动作在图中） | [链接](https://www.xiaohongshu.com/search_result/6a70590c0000000033018439?xsec_token=ABeVenKj2RgViB0rFS0zMU_hcPs8gZCVEmLOvVA1BDXYU=&xsec_source=) |
| 6 | 谭成义新手四分化训练全套 | 煤球健身 | 281 | 2026-07-29 | 谭成义四分化（动作在图中） | [链接](https://www.xiaohongshu.com/search_result/6a69e965000000001101d7d4?xsec_token=ABAl6DAsG3ILVzl2ha70M-zjmHH1-E27kYgtjSce26S8U=&xsec_source=) |
| 7 | 肌肉对应动作大全 | 小伴的减脂日记 | 2163 | 2026-05-12 | 肌群 → 动作对照表（含臀中肌/竖脊肌动作） | [链接](https://www.xiaohongshu.com/search_result/6a032924000000000803c6ca?xsec_token=ABvCQzhFj-kjJJTa21NgEm93d088L59cUKD_PU9qTkyFE=&xsec_source=) |
| 8 | 健身房必学的7个动作，都是王牌中的王牌 | 线条大狗（增肌中） | 280 | 2026-05-30 | 7 大王牌动作：卧推/深蹲/硬拉/推肩/引体/弯举/双杠 | [链接](https://www.xiaohongshu.com/search_result/6a1a8aea000000003501f002?xsec_token=ABEQi_ju-ISGpZ3AEI0TkcLoKSQA4dqFa1NZBcYg1WnOI=&xsec_source=) |
| 9 | 新手友好｜一周六练，健身房分化训练计划 | 轻轻健身app | 1383 | 2026-05-31 | 六日分化逐日动作表（胸/肩/背/手臂/臀腿/核心） | [链接](https://www.xiaohongshu.com/search_result/6a1c45be000000000803d244?xsec_token=ABmW2AipEw8l79tleD6OBJ6nZgm6qZUMZUEmJgoo1zAKw=&xsec_source=) |
| 10 | 健身焚诀｜胸背肩腿腹 5 套专属训练逻辑 | 自律到发光的蓝蓝 | 4907 | 2026-07-08 | 五肌群训练逻辑（大重量/高容量/递减组） | [链接](https://www.xiaohongshu.com/search_result/6a4e16cd0000000017009ff1?xsec_token=ABjtXhzBJW-iN4GbIFvEdnHLPRerBiob_32T2QW2gukiQ=&xsec_source=) |
| 11 | 教练眼里的推拉蹲转：五大动作模式 | 锐星健身教练服务基地 | 4 | 2026-08-26 | 五大动作模式：上肢推/上肢拉/旋转/下肢推/下肢拉 | [链接](https://www.xiaohongshu.com/search_result/6a8e5b73000000002102f301?xsec_token=ABH7jeLdQGfDZu7oo2YuXmQgG0zJ2ut6RRI0wcnk31nJM=&xsec_source=) |
| 12 | Jeff优选动作增肌计划｜四分化 | 青野挑好物 | 116 | 2026-07-10 | 四分化（正文无动作） | [链接](https://www.xiaohongshu.com/search_result/6a50671d0000000006036594?xsec_token=ABXGYYhMoITOn2meoN6xC9rOEFRlmER6SxlfSR9N50bWg=&xsec_source=) |
| 13 | 新手四分化训练：科学起步，少走弯路 | 义博健身 | 544 | 2026-03-04 | 四分化 胸/背/肩+臂/腿 动作 | [链接](https://www.xiaohongshu.com/search_result/69a7a5d40000000022038060?xsec_token=ABuDIKJrJuuDePW_4sejcmNUf9AA-m6-FZjD1gsO1bwvA=&xsec_source=) |
| 14 | 健身房训练动作大全（中英文对照版） | 红枫. | 17 | 2026-05-23 | — | [链接](https://www.xiaohongshu.com/search_result/6a1123f600000000070102bd?xsec_token=ABjzz0bXc-q5EB_OPVN68DPa27rFf_0NCqUNf34Ouh9z8=&xsec_source=) |
| 15 | 健身房练腿器械全攻略 | 健身一凡教练 | 2161 | 2026-06-05 | 6 个腿部器械动作（深蹲/倒蹬/硬拉/腿屈伸/哈克/外展内收） | [链接](https://www.xiaohongshu.com/search_result/6a226197000000003701cfc7?xsec_token=AB8jwCnPtBxL6nphAVROshGZ37LP_DNwCJ80QnNZ-J5rI=&xsec_source=) |
| 16 | 分化训练全对比！新手直接选适合自己的计划 | 健身科普导师 | 347 | 2026-06-29 | 二/三/四/五分化日程完整对比 | [链接](https://www.xiaohongshu.com/search_result/6a41b759000000002200bf2e?xsec_token=ABzOOtURrAcOejUZvH-v28zGaMfCNQL79iopnPBcuwyJM=&xsec_source=) |
| 17 | 新手三分化｜一周只练3天 照样涨力量💪 | 线条大狗（增肌中） | 5251 | 2026-05-22 | 三分化完整动作表（胸三头/背二头/腿肩） | [链接](https://www.xiaohongshu.com/search_result/6a104c3e000000003503b0fe?xsec_token=ABy5O142GGbm4nYZF4eZb3T3B6zrqYgKoiGFakpnvRl9M=&xsec_source=) |
| 18 | 普通人增肌别乱练，先把三分化练明白 | 阿黄健身 | 1226 | 2026-07-06 | 三分化 胸肩三头/背二头肩后束/腿臀核心 | [链接](https://www.xiaohongshu.com/search_result/6a4b36200000000011007783?xsec_token=ABsh0WQawAWEaHyJcznXd-FQkAjKM_sqDSF0tV6l3UU9Y=&xsec_source=) |
| 19 | 健身一周训练计划，该怎么练 | 梅罗未竟的梦 | 2098 | 2026-08-18 | 推/拉/肩/腿/手臂/腹 六日动作 | [链接](https://www.xiaohongshu.com/search_result/6a83b7bd0000000028004d18?xsec_token=ABbupLzKQ9HyRwQsVCIeA_wAzMloTYdZSLGQsoTa5ucCU=&xsec_source=) |
| 20 | 封神五分化训练｜新手零瞎练🔥一周精准增 | 陪你健身的小戴 | 563 | 2026-06-09 | 五分化结构（胸/背/肩/臂/腿） | [链接](https://www.xiaohongshu.com/search_result/6a27cdfa00000000210156a9?xsec_token=AB81E5Kv5O0_1A7rbQ6wfUFyhldh3TsToihJELOPmHvqU=&xsec_source=) |
| 21 | 💪 凯圣王×谭成义功能性三分化训练计划！ | 十一 | 1006 | 2026-04-02 | PPL 逐动作 + 组次（含单腿硬拉、Y 字侧平举、山羊挺身） | [链接](https://www.xiaohongshu.com/search_result/69cde6cd000000002103a634?xsec_token=ABVh-6SRbvtiHMEWUrZMudQgmIURY4eLs8otetStFAphw=&xsec_source=) |
| 22 | 三分化训练合集来喽 | 麦林的健身日记 | 3539 | 2025-07-11 | 三分化合集（正文无动作） | [链接](https://www.xiaohongshu.com/search_result/68701c860000000012023c6f?xsec_token=ABZRtONXVM_cLhfqgXSAotMxcMGsOTy3nff8Mvf8B5bqk=&xsec_source=) |
| 23 | 新手居家哑铃｜一周4练｜胸背臀肩各1天✅ | 爱健身的Lucky | 426 | 2026-08-09 | 胸/背/臀/肩 四分化排布逻辑 | [链接](https://www.xiaohongshu.com/search_result/6a7891b8000000002402d4f5?xsec_token=ABILYFZFGqtBxbVlSwI-joFuR25IXKMr617M19MHCwdKA=&xsec_source=) |
| 24 | 6 个黄金练背动作🔥从入门到进阶全覆盖！ | 小雨的减脂日记 | 361 | 2026-05-08 | 6 个练背动作（引体/下拉/硬拉/杠铃划船/哑铃划船/坐姿绳索划船） | [链接](https://www.xiaohongshu.com/search_result/69fdb486000000001a0363da?xsec_token=ABcSmFMiFBUKrYh-MjXDu5bPnqy587vRidTI2QHzwDyzw=&xsec_source=) |
| 25 | 肩部训练动作|从夯到拉锐评 | 小马就会练 | 61 | 2026-07-12 | 肩部最优动作（器械推举/绳索侧平举/蝴蝶机反向飞鸟/面拉） | [链接](https://www.xiaohongshu.com/search_result/6a52fd940000000007020586?xsec_token=ABnGzMDa_TtCNsfofAPuh6CnQXJaBBxo4e9P0dj9Yn0Eg=&xsec_source=) |
| 26 | 保姆级三级分化增肌计划｜每周3天高效涨肌肉 | 中传健身阿豪 | 286 | 2026-09-03 | 胸背腿三分化动作（卧推/飞鸟/夹胸 等） | [链接](https://www.xiaohongshu.com/search_result/6a998a19000000001001f76f?xsec_token=AB3cD70LcrShtgFQ-JoyGZAjDs12FdLWFyAHaS2L62Su8=&xsec_source=) |
| 27 | 上班族没时间锻炼？一周只需四天轻轻松松 | 米洛健身 | 11 | 2026-07-20 | 四天上下肢训练计划 | [链接](https://www.xiaohongshu.com/search_result/6a5d5790000000001102d1b9?xsec_token=ABLxCVfoi6cIYk5bIX1sJ4ac5k8o0U9G8VTK8QSq2TA8I=&xsec_source=) |
| 28 | 健身八大黄金动作 | 小白健身 | 416 | 2025-12-22 | 八大黄金动作（正文无动作） | [链接](https://www.xiaohongshu.com/search_result/6949492b000000001e033947?xsec_token=ABUmYVE_MmVJXB7sVU36yDHYNnloawJywC7gNZ8HiT-zw=&xsec_source=) |
| 29 | 新手健身有口诀｜蕞大受益动作，快速上手 | 洒脱的静静子 | 1369 | 2025-07-25 | 上下肢口诀（正文无动作） | [链接](https://www.xiaohongshu.com/search_result/68830abc000000001202d99b?xsec_token=ABpdAJjoWEHLrmr29HrhyHRyyMNleaB42faua39B9f0k4=&xsec_source=) |
| 30 | 健身房器材，新手教学 | 南部战区_子弹 | 783 | 2026-05-24 | 龙门架全身训练动作 | [链接](https://www.xiaohongshu.com/search_result/6a12849d00000000070257c0?xsec_token=ABBEOIBYepv4PcW2dLxZY6tosYh3UrLBSQrRZaHwFCSK0=&xsec_source=) |
| 31 | 新手一周六练｜超详细全身分化训练计划 | 轻轻健身app | 6841 | 2026-05-21 | 六日分化结构 | [链接](https://www.xiaohongshu.com/search_result/6a0ddc9300000000070264a5?xsec_token=AB_n4iWgrTWJYVIZVCwetUqPVYvrC-fB8hqdDt1-cz5fM=&xsec_source=) |
| 32 | 女生上肢训练全套计划：2分化上肢训练就对了 | 不会健身的麦麦 | 1242 | 2026-06-11 | 上肢 2 分化动作（宽距下拉/推肩/反向飞鸟/上斜俯卧撑/窄距卧推） | [链接](https://www.xiaohongshu.com/search_result/6a2a9ab70000000022029626?xsec_token=ABEe4qLVjPp3MinptsRXXYIiExz0lClpf2U5ZItO2FU20=&xsec_source=) |
| 33 | 凯圣王二分化动作汇总｜附训记模版 | 不知名的课代表（健身版） | 263 | 2026-05-01 | 躯干日/四肢日完整动作表（含澳式引体、交替触肩、静蹲） | [链接](https://www.xiaohongshu.com/search_result/69f4b743000000002003b94f?xsec_token=ABLkfLT6-4JTenk-HGU3UgvlVdYgBeom7U8nU5DO9yb8I=&xsec_source=) |
| 34 | 全网最新健身计划？鹿晨辉保姆级教程！ | 鹿晨辉 | 7329 | 2026-01-01 | 高互动计划（视频，正文无动作） | [链接](https://www.xiaohongshu.com/search_result/69561a5d0000000021033afa?xsec_token=ABPLhOA-0XI7KdwQTg4ZT1mwTD0Fadi-WuBW2G8lkSogc=&xsec_source=) |
| 35 | 练腿日｜5个黄金动作，炸裂大腿🔥 | 线条大狗（增肌中） | 606 | 2026-05-25 | 腿日 5 动作（深蹲/硬拉/腿举/哈克/坐姿腿弯举） | [链接](https://www.xiaohongshu.com/search_result/6a13fa61000000003502f22d?xsec_token=ABiPDifHfB9myotihfXUqTw5yXTQJbe1kZR27ZkWZPniQ=&xsec_source=) |
| 36 | 新手力量：分化训练别塞太多动作 | 不精致减肥笔记 | 91 | 2026-06-24 | 二/三分化每部位动作数量建议 | [链接](https://www.xiaohongshu.com/search_result/6a3bc0f2000000000802663e?xsec_token=AB5wgzcZgr7hZ2Oz_tNofRutlFts6xn8OAi_6aewXhsq8=&xsec_source=) |

**合计逐条读取正文的笔记：36 条**（另有 69 条仅出现在搜索结果列表，用于交叉确认分化名称与动作词频）

---

## 8. 检索方法与可复现步骤

**工具链**：Agent Reach → 小红书后端 `OpenCLI`（`agent-reach doctor --json` 报告 xiaohongshu `active_backend = OpenCLI`，复用本机 Chrome 登录态）。仅执行只读操作（`search` / `note`），未做任何发布、评论、点赞或配置修改。

**搜索关键词（6 次）**：

1. `三分化训练 推拉腿 动作`
2. `四分化训练计划 胸背肩腿`
3. `推拉蹲 髋 动作模式 训练`
4. `健身房常用动作大全 名称`
5. `上下肢分化 上肢日 下肢日 动作安排`
6. `四分化 推日 拉日 腿日 上肢 下肢`

**命中与取样**：6 次搜索共返回 105 条笔记；按「点赞数 + 是否属于三分化/四分化/动作模式主题」筛选，逐条读取 36 条笔记正文（`opencli xiaohongshu note <URL> -f yaml`）。其余 69 条仅用其标题/点赞做交叉确认，不作为动作证据。

**频率统计**：对 36 条正文做关键词命中计数（按笔记去重），得到第 4 节的分层。该口径只反映「在小红书计划类笔记中的传播度」，不代表训练学最优性。

**ID 映射**：`gh api` 拉取上游 `hasaneyldrm/exercises-dataset` 的 `data/exercises.json`（1,324 条，17.4 MB）到 `/tmp`，对每个候选按精确英文名解析 ID，再与 `data/curated-catalog.js`（104 条）求差。**全程未修改 catalog / spec / code。**

---

## 9. 局限与未覆盖

1. **正文 ≠ 全部动作**。小红书大量笔记（「动图版」「详情计划」「全套」）把动作表放在图片里，正文只有标签。此类笔记（如「凯圣王谭成义三分化训练计划（优化动图版）」「谭成义新手四分化训练全套」）只能读到分化结构和肌群划分，读不到逐动作清单。本次动作清单主要来自**正文写明动作**的笔记（约 20 条）。
2. **未读取图片内容 / 未翻评论**。评论常含博主补充的动作替换，本次未采集；未使用 OCR 或图像识别读取笔记图片中的动作表。
3. **部分笔记读取失败**。`opencli xiaohongshu note` 对个别笔记返回空结果（疑似平台限流或 xsec_token 失效），重试 2–3 次后放弃，因此有少量高互动笔记（如 199 赞的「健身房三分化训练｜动图版」）未能取到正文。
4. **平台风控限制**。小红书对高频请求会触发验证码，本次每次操作间隔 4–6 秒，搜索仅做 6 次、笔记仅读 36 条，**不是全量抽样**；更深的翻页（rank > 20）未做。
5. **「四分化上下肢」证据偏弱**。明确写「上下肢四天」的只有 1 条笔记（11 赞），主要依据来自「二分化 = 躯干日/四肢日」的 2 条笔记（263 / 1242 赞）推断，属于间接证据。
6. **「推拉蹲髋」的「髋」在中文笔记中表述不统一**。多数笔记用「硬拉」「髋铰链」而不是「髋」；「推拉蹲髋」这一说法在本次语料中未作为固定分化名称出现，仅有「推拉蹲」「蹲推拉划」「推拉蹲转」等变体。
7. **上游数据集未做全量语义审查**。本次只针对候选动作做精确名解析，未穷举 1,324 条中是否还有其他「小红书常见但本仓未收录」的动作；也未核对上游 `target` 字段的准确性（如 Y 字侧平举被标为 `upper back`）。
8. **未验证上游版本漂移**。本次比对基于检索当日 `main` 分支的 `exercises.json`；上游若更新条目，ID 与名称的对应关系需重新核对。

---

## 10. 给下一步的最小建议（仅建议，未实施）

1. **优先补 3 类缺口**：下拉握距变体（0150 / 2616 / 0245）、单侧腿（1757 / 0336 / 0381）、辅助与自重替代（0009 / 0017 / 0129 / 0226）。
2. **`杠铃臀推` 需要单独决策**：上游无此动作，而它是小红书臀腿日的高频核心动作。要么接受 1409 杠铃臀桥并调整文案，要么走自定义动作（脱离上游 ID 体系，属架构变更，需 ADR）。
3. **若要收录耸肩类动作**，需同时扩 `scripts/build-exercises.js` 的 `TARGET_WHITELIST`（增加 `traps`），否则白名单加了也进不了目录。
4. **mode 词表建议补** `anti-rotation`、`carry`、`shoulder-shrug`，并明确「侧屈」的归属。
5. **补白名单必须以 ID 为准**，不要按 name 反查——上游存在 6 组重名条目。


---

## 11. 热身专项补充（抗阻训练热身 / 激活动作候选审计）

- **检索日期**：2026-09-19
- **平台与后端**：小红书 → Agent Reach → OpenCLI（`opencli xiaohongshu search/note -f yaml`，复用浏览器登录态）。仅执行只读操作，未做任何发布 / 评论 / 点赞 / 配置修改。
- **语料规模**：11 次关键词搜索。对第 1–7 次结果去重得 **116 条**笔记，第 8–11 次另新增约 40 条；**逐条读取 46 次（45 条去重笔记）**，其中 **20 条有实质正文、15 条仅标签、11 条读取失败**（视频笔记 / 平台限流 / 导航被拒）。
- **上游核对**：`hasaneyldrm/exercises-dataset` `main` 分支 `data/exercises.json`（1,324 条，本地 `/tmp/exercises-dataset/exercises.json`）；媒体存在性用 `gh api repos/hasaneyldrm/exercises-dataset/git/trees/main?recursive=1`（2,659 条路径）逐条比对。ID 全部由数据集**实际内容**核对，非按名字猜测。
- **范围**：弹力带拉开、肩袖内外旋、面拉、肩胛控制、怪兽走 / 髋外展、髋部动态活动。**排除**跑步机、有氧器械、开合跳 / 波比跳等体能训练（上游 `category = cardio` 的动作一律未纳入）。
- **落盘位置**：仅追加本章节，未修改 `data/curated-catalog.js`、`docs/spec*.md`、`CONTEXT.md`、`scripts/`、`data/exercises*` 或任何代码。

### 11.1 结论摘要

1. **可立即补入的候选共 15 条**（§11.2），其中 **13 条 target 落在 `TARGET_WHITELIST` 内可正常进目录**，**2 条（3021 肩胛俯卧撑、3012 肩胛后缩撑起）会被 `scripts/build-exercises.js` 的粗筛直接丢弃**——不是白名单问题，是 `target` 白名单问题。
2. **小红书热身语料的共识结构是「先活动度、再激活、最后专项」**：肩部热身普遍是「弹力带绕肩 / 绕环 → 水平扩胸（= 弹力带拉开）→ 弹力带肩外旋 → 招财猫 / W 下拉 → 肩胛激活」；臀腿热身普遍是「髋关节活动度（90/90、髋飞机、青蛙趴）→ 臀桥 → 侧步走 / 螃蟹步（弹力带）」。
3. **肩袖内外旋在小红书上一律推荐弹力带**（`n30`：*"对于肩袖肌群训练最好的就是用弹力带，而不是拿哑铃。肩关节是球窝关节，所以需要三个平面内的激活训练"*），但**上游没有 band 版肩外旋 / 肩内旋**——只能退到 cable（`0235` / `0216`）或 dumbbell（`0863` / `0864`）。这是本类别最大的「动作对不上器械」缺口。
4. **`0628 monster walk` 已在 104 目录中**，且它就是小红书「怪兽走 / 螃蟹步 / 弹力带侧走」的同一个动作；上游**没有** `band lateral walk` 独立条目。**面拉也已在库**（`0233`），新增面拉条目必须选**非重复**变体（`3697` 跪姿），`0203` / `0202` 与 `0233` 近乎重复。
5. **上游根本没有的动作**（无法靠补 ID 解决）：弹力带拉开（字面名）、band 肩内外旋、弹力带侧步走、蚌式开合、髋飞机、90/90 转髋、髋绕环 / 腿摆动、猫牛式、静蹲、泡沫轴上推。详见 §11.5。
6. **`mode` 词表没有「热身 / 活动度」类别**，15 条候选里有 6 个需要新增 mode；代码层无受控词表校验（`tests/catalog.test.js` 只断言 mode 是非空字符串），但会与 `curated-catalog.js` 宣称的「受控词表」约定脱节。详见 §11.6。
7. **发现 2 个命名与动作不符的上游条目**（`3292 elevator`、`3012 scapula dips`），正是任务要求「禁止按重名自动选」的实例。详见 §11.7。

### 11.2 候选清单（15 条，精确 4 位 exerciseId）

**列说明**：`tags` 用 `data/curated-catalog.js` 的 `PART_LABELS` 词表（chest / back / shoulders / biceps / triceps / legs / waist / glutes / compound）；`mode` 中带「**新**」的表示当前受控词表没有、需新增；`媒体` 为 JPEG 与 GIF 在**上游仓库内相对路径**的存在性校验结果；`已在库` 指是否已在 104 条 `CURATED_EXERCISES` 白名单中。

| # | 建议中文展示名 | 上游英文名 | ID | 器械 | target | 建议 tags | 建议 mode | compound | 已在库 | 媒体 | 小红书证据强度 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 弹力带拉开（弹力带反向飞鸟） | band reverse fly | **0993** | band（弹力带） | delts | shoulders, back | shoulder-horizontal-abduction | false | 否 | JPEG+GIF ✅ | 中（`i104` 明列「弹力带水平扩胸」、`i103` 列「水平肩外展」） |
| 2 | 绳索站姿肩外旋 | cable standing shoulder external rotation | **0235** | cable（绳索） | delts | shoulders | shoulder-external-rotation（**新**） | false | 否 | JPEG+GIF ✅ | 高（`n13` 明列肩外旋、`n30` 三个平面激活、`n24`、`i104`） |
| 3 | 哑铃站姿肩外旋 | dumbbell upright shoulder external rotation | **0864** | dumbbell（哑铃） | delts | shoulders | shoulder-external-rotation（**新**） | false | 否 | JPEG+GIF ✅ | 中（小红书主推弹力带，此为器械替代位；`n13`/`n30`） |
| 4 | 绳索坐姿肩内旋 | cable seated shoulder internal rotation | **0216** | cable（绳索） | delts | shoulders | shoulder-internal-rotation（**新**） | false | 否 | JPEG+GIF ✅ | 高（`n13` 明列肩内旋 / 肩胛下肌、`n24`） |
| 5 | 跪姿绳索面拉 | cable kneeling rear delt row (with rope) (male) | **3697** | cable（绳索） | delts | shoulders, back | shoulder-horizontal-abduction | false | 否 | JPEG+GIF ✅ | 高（`n29` 6990 赞、`n33` 1.7 万赞、`n108` 1.3 万赞；仅标签级正文） |
| 6 | 肩胛俯卧撑 | scapula push-up | **3021** | body weight（自重） | serratus anterior | shoulders, chest | scapular-protraction（**新**） | false | 否 | JPEG+GIF ✅ | 高（`i112` 1390 赞「可以推前当作热身」、`i110`、`n27` 前锯肌激活）⚠️ **被 TARGET_WHITELIST 挡掉** |
| 7 | 站姿肩胛后缩撑起 | scapula dips | **3012** | body weight（自重） | traps | back, shoulders | scapular-retraction（**新**） | false | 否 | JPEG+GIF ✅ | 中（`n21` 3548 赞、`n34` 2.9 万赞，仅标签级正文）⚠️ **被 TARGET_WHITELIST 挡掉** |
| 8 | 弹力带坐姿髋外展 | resistance band seated hip abduction | **3006** | resistance band（弹力带） | abductors | glutes, legs | hip-abduction | false | 否 | JPEG+GIF ✅ | 高（`n22` 弹力带站姿髋外展、`n12` 227 赞、`n14`、`n18`） |
| 9 | 站姿髋外展 | side hip abduction | **0710** | body weight（自重） | abductors | glutes, legs | hip-abduction | false | 否 | JPEG+GIF ✅ | 中（`n22` 髋外展、`n8` 1708 赞侧卧抬腿、`n18`） |
| 10 | 世界最伟大拉伸 | world greatest stretch | **1604** | body weight（自重） | hamstrings | legs, glutes | mobility-flow（**新**） | false | 否 | JPEG+GIF ✅ | 高（`i103` 明列「伟大拉伸 30s」在肩部热身流程内、`n11`） |
| 11 | 青蛙趴摇摆 | rocking frog stretch | **2571** | body weight（自重） | glutes | glutes, legs | mobility-flow（**新**） | false | 否 | JPEG+GIF ✅ | 中（`n32` 967 赞开髋五动作、`n11` 髋灵活性） |
| 12 | 铁十字髋部拉伸 | iron cross stretch | **1419** | body weight（自重） | glutes | glutes, legs | mobility-flow（**新**） | false | 否 | JPEG+GIF ✅ | 中（`n32`、`n11`；小红书多称「髋部动态活动」） |
| 13 | 臀桥行军 | glute bridge march | **3561** | body weight（自重） | glutes | glutes, legs | hip-thrust | true | 否 | JPEG+GIF ✅ | 高（`n22` 弹力带臀桥、`n8` 1708 赞臀桥激活、`n18`） |
| 14 | 弹力带臀桥 | band hip lift | **1408** | band（弹力带） | glutes | glutes, legs | hip-thrust | true | 否 | JPEG+GIF ✅ | 高（`n22` 明确「弹力带臀桥…激活臀大肌、腘绳肌」） |
| 15 | 哑铃肩绕环 | dumbbell standing around world | **2143** | dumbbell（哑铃） | delts | shoulders | shoulder-circumduction（**新**） | false | 否 | JPEG+GIF ✅ | 高（`i103` 明列「前后环绕 / 交替绕肩 / 单侧绕肩」、`i104`「弹力带绕肩」） |

**备选（证据或去重强度次一级，未计入 15 条）**

| 建议中文展示名 | 上游英文名 | ID | 器械 | target | 建议 mode | compound | 说明 |
|---|---|---|---|---|---|---|---|
| 哑铃仰卧肩外旋 | dumbbell lying external shoulder rotation | 0863 | dumbbell | delts | shoulder-external-rotation（新） | false | 与 0864 同为肩外旋，二选一或都收 |
| 弹力带 Y 字举 | band y-raise | 1017 | band | delts | shoulder-abduction | false | 肩胛激活 / 后束激活，`n13`「俯卧 T 字伸展」近似 |
| 绳索面拉（站姿·绳索把手） | cable rear delt row (with rope) | 0203 | cable | delts | shoulder-horizontal-abduction | false | **与已在库 0233 近乎重复**，不建议再加 |
| 单臂绳索面拉（马镫） | cable rear delt row (stirrups) | 0202 | cable | delts | shoulder-horizontal-abduction | false | 与 0233 重复度高 |
| 上斜肩胛俯卧撑 | incline scapula push up | 3011 | body weight | serratus anterior | scapular-protraction（新） | false | 新手进阶位；**同被 TARGET_WHITELIST 挡掉** |
| 肩胛引体 | scapular pull-up | 0688 | body weight | traps | scapular-depression（新） | false | 肩胛下沉控制；**同被 TARGET_WHITELIST 挡掉** |
| 侧卧直腿髋外展 | straight leg outer hip abductor | 1427 | body weight | abductors | hip-abduction | false | 即小红书「侧卧抬腿」，`n8`/`n18` 均列为臀中肌激活 |
| 骨盆后倾臀桥 | pelvic tilt into bridge | 1422 | body weight | glutes | hip-thrust | true | 臀桥入门 / 激活 |
| 靠墙坐姿行军 | march sit (wall) | 0624 | body weight | glutes | hip-thrust | true | 靠墙静蹲 + 抬膝，`n22` 类激活 |
| 靠墙俯卧撑 | push-up (wall) | 0659 | body weight | pectorals | horizontal-push | true | 肩胛 / 上肢热身入门位 |
| 动态扩胸拉伸 | dynamic chest stretch (male) | 1167 | body weight | pectorals | mobility-flow（新） | false | 对应 `i104`「弹力带水平扩胸」的自重版 |
| 交替绕环体前屈 | arms apart circular toe touch (male) | 3214 | body weight | glutes | mobility-flow（新） | false | 上肢 + 髋动态热身（target 标为 glutes，命名易误读） |
| 踝关节绕环 | ankle circles | 1368 | body weight | calves | mobility-flow（新） | false | 下肢热身末端；小红书未单独取证 |
| 胸前交叉肩拉伸 | chest and front of shoulder stretch | 1271 | body weight | pectorals | mobility-flow（新） | false | 胸 / 肩前侧动态 |
| 泡沫轴髋部拉伸 | roller hip stretch | 2202 | roller | glutes | mobility-flow（新） | false | 泡沫轴归「其他」器械桶；小红书泡沫轴内容多但未逐条取证 |
| 瑞士球髋屈肌拉伸 | exercise ball hip flexor stretch | 1559 | stability ball | glutes | mobility-flow（新） | false | 瑞士球归「其他」桶，需确认是否接受 |

### 11.3 当前已在 104 目录中的热身相关条目（无需重复收录）

| ID | 上游英文名 | 目录内中文名 | mode | tags | 与本章候选的关系 |
|---|---|---|---|---|---|
| 0628 | monster walk | 怪物行走 | hip-abduction | glutes, legs | **就是**小红书「怪兽走 / 螃蟹步 / 弹力带侧走」（`n12`/`n14`/`n18`/`n19`/`n31`）→ 不建议再加同类 |
| 0233 | cable standing rear delt row (with rope) | 绳索面拉 | shoulder-horizontal-abduction | shoulders, back | **就是**面拉本身 → 新增只能选非重复变体（3697） |
| 0597 | lever seated hip abduction | 器械髋外展 | hip-abduction | glutes, legs | 髋外展已覆盖器械位；3006 是弹力带位、0710 是自重位 |
| 3013 | low glute bridge on floor | 臀桥 | hip-thrust | glutes, legs | 臀桥已覆盖；1408 是弹力带位、3561 是行军位 |
| 1409 | barbell glute bridge | 杠铃臀桥 | hip-thrust | glutes, legs | 负重臀桥已覆盖 |
| 0276 | dead bug | 死虫式 | anti-extension | waist | 核心激活已覆盖 |
| 0464 | front plank with twist | 平板支撑（目录注释） | anti-extension | waist | 核心激活已覆盖（注意上游英文名与目录注释不一致） |
| 0705 | side bridge v. 2 | 侧平板支撑 | anti-extension | waist | 侧链激活已覆盖 |
| 2292 | dumbbell rear delt raise | 俯身哑铃飞鸟 | shoulder-horizontal-abduction | shoulders | 俯身飞鸟已覆盖哑铃位；0993 是弹力带位 |

### 11.4 媒体路径校验（JPEG / GIF）

- **方法**：拉取上游仓库完整文件树（`gh api repos/hasaneyldrm/exercises-dataset/git/trees/main?recursive=1` → 2,659 条路径），对每个候选的 `image`（`images/<id>-<media_id>.jpg`）与 `gif_url`（`videos/<id>-<media_id>.gif`）做集合成员判定。
- **结果**：§11.2 的 15 条候选与 §11.2 备选表中的全部条目，**JPEG 与 GIF 路径均存在**，无一缺失。
- **示例**：`0993` → `images/0993-sTfvVsG.jpg` + `videos/0993-sTfvVsG.gif`；`3021` → `images/3021-jV65tKx.jpg` + `videos/3021-jV65tKx.gif`；`3697` → `images/3697-G61cXLk.jpg` + `videos/3697-G61cXLk.gif`。
- **口径提示**：本仓 `scripts/build-exercises.js` 落盘时会再加一层前缀，写成 `exercises/images/...` 与 `exercises/videos/...`（拼 `MEDIA_ROOT` 后即为可加载地址）。本次校验的是**上游仓库内相对路径**的存在性，未校验 CloudBase 上传状态。

### 11.5 上游数据集不存在、无法靠补 ID 解决的动作

| 中文名 | 小红书依据 | 上游核查结果 |
|---|---|---|
| **弹力带拉开**（band pull apart 字面名） | `i104` 动作三「弹力带水平扩胸」、`i103`「水平肩外展」 | 无 `band pull apart` / `pull apart`（全库仅 `3214 arms apart circular toe touch`，无关）。**最接近：`0993` band reverse fly（水平外展轨迹）或 `1017` band y-raise** |
| **弹力带肩外旋 / 肩内旋** | `n13`「弹力带外旋」「弹力带内旋」、`n30`、`i104` 动作四「弹力带肩关节外旋」 | 无 `band ... shoulder external/internal rotation`。仅有 cable `0235` / `0216`、dumbbell `0863` / `0864` |
| **弹力带侧步走 / 螃蟹步（带弹力带）** | `n18`（Monster Walk「训练前激活神器」「跑步党的暖身必做」）、`n12`、`n14`、`n31`、`n22` | 无 `band lateral walk` / `crab walk`。已有 `0628 monster walk`，但上游 `equipment = "body weight"` |
| **蚌式开合 clamshell** | `n18`（臀中肌激活系列首项）、`n14` 标题「侧移蚌式行走」 | 无 `clamshell` |
| **髋飞机 hip airplane** | `i106`（5049 赞「髋飞机：一个高效的髋关节热身动作」）、`i107`（937 赞「练臀必须的热身激活」） | 无 `airplane` / `hip airplane` |
| **90/90 转髋** | `i105`（7091 赞） | 无 `90` / `90/90` |
| **髋关节绕环 / 腿摆动** | `n11`（髋关节灵活性热身）、`n32` | 无 `hip circle` / `leg swing` |
| **猫牛式 cat-cow** | （本次语料未单独取证） | 无 `cat cow` |
| **静蹲 wall sit** | 见本报告 §5.2 | 无 `wall sit` |
| **泡沫轴上推（前锯肌）** | `n27`（604 赞「上肢热身加上泡沫轴上推～能高效激活前锯肌」） | 无 `foam roller push-up plus`；最接近 `3021` / `3011` 肩胛俯卧撑 |
| **招财猫（弹力带外旋推举）** | `n13` 动作一「弹力带外旋推举」、`i103`「招财猫 30s」 | 无同名条目；最接近 `0235` / `0864` |
| 世界最伟大拉伸 | `i103`「伟大拉伸 30s」 | ✅ **存在**：`1604 world greatest stretch`（非缺口） |

### 11.6 与 `TARGET_WHITELIST` / mode 词表的冲突（落地阻塞项）

**（a）`TARGET_WHITELIST` 会挡掉全部肩胛控制动作**

`scripts/build-exercises.js` 的粗筛白名单只有 14 项：
`pectorals, triceps, lats, upper back, spine, biceps, delts, quads, hamstrings, glutes, calves, abductors, adductors, abs`

因此以下条目**即使加进 `CURATED_EXERCISES` 也会在粗筛阶段被丢弃**：

| ID | 上游英文名 | target | 结果 |
|---|---|---|---|
| 3021 | scapula push-up | `serratus anterior` | ❌ 被挡 |
| 3011 | incline scapula push up | `serratus anterior` | ❌ 被挡 |
| 3012 | scapula dips | `traps` | ❌ 被挡 |
| 0688 | scapular pull-up | `traps` | ❌ 被挡 |

**矛盾点**：`data/exercises.js` 的 `TARGET_LABELS` 注释写明是「非 cardio 的 **18 个**目标肌群枚举」，其中**已经包含** `serratus anterior`（前锯肌）、`traps`（斜方肌）、`levator scapulae`（肩胛提肌）。即 **UI 有中文标签、粗筛却不放行**，两处口径不一致。

**落地路径二选一**：① 扩 `TARGET_WHITELIST` 增加 `serratus anterior`（及可选 `traps`）；② 改用 target 已在白名单内的等价动作（如以 `0993` / `1017` 承担肩胛激活）。**本章仅记录，未实施。**

**（b）mode 受控词表缺「热身 / 活动度」类别**

15 条候选需新增 6 个 mode：

| 新增 mode | 适用 ID | 语义 |
|---|---|---|
| `shoulder-external-rotation` | 0235, 0864, (0863) | 肩外旋（肩袖） |
| `shoulder-internal-rotation` | 0216 | 肩内旋（肩袖） |
| `scapular-protraction` | 3021, (3011) | 肩胛前伸 / 前锯肌 |
| `scapular-retraction` | 3012, (0688) | 肩胛后缩 / 下沉 |
| `mobility-flow` | 1604, 2571, 1419, (1167, 3214, 1368, 1271) | 动态活动度 / 动态拉伸 |
| `shoulder-circumduction` | 2143 | 肩关节绕环 |

**可直接复用现有 mode**：`shoulder-horizontal-abduction`（0993 / 3697，与 0233 / 2292 同族）、`hip-abduction`（3006 / 0710，与 0597 同族）、`hip-thrust`（3561 / 1408，与 3013 / 1409 同族）。

**代码层现状**：`tests/catalog.test.js` 仅断言 `typeof meta.mode === 'string'` 且 `length > 0`，**没有受控词表校验**——新增 mode 不会让测试失败，但会与 `curated-catalog.js` 头注释宣称的「规范动作模式（受控词表）」脱节，需同步更新词表文档。

### 11.7 数据陷阱（禁止按名字映射，本次实测）

| ID | 上游英文名 | 名字暗示 | 说明书实际动作 | 影响 |
|---|---|---|---|---|
| 3292 | elevator | 肩胛上提 / 下沉（elevator / shrug） | **站姿体前屈**：*"保持背部挺直，腰部慢慢向前弯曲，将上半身向地面降低"*；target = `upper back` | **绝不能**当肩胛控制动作收录。本次审计中因「名字像」而被列入初步候选，读说明书后已剔除 |
| 3012 | scapula dips | 双杠肩胛撑起（dip 位） | **站姿肩胛后缩**：*"弯曲肘部并缩回肩胛骨来降低身体，就像你试图在它们之间挤一支铅笔一样"*；target = `traps` | 动作本身可用，但中文展示名必须按说明书取（「站姿肩胛后缩撑起」），不能叫「肩胛撑起」 |
| 0628 | monster walk | 自重 | 说明书 *"在脚踝周围放置一根阻力带"*，但 `equipment = "body weight"` | `equipment == "body weight"` 是本仓判定自重动作、切换 volume / 总次数口径的**唯一依据** → 弹力带动作会被算成自重 |
| 1408 | band hip lift | 弹力带 | `equipment = "band"` | `equipmentBucket` 把 `band` / `resistance band` 归入「**其他**」器械桶，不是「自重」也不是「器械」 |
| 0993 | band reverse fly | 反向飞鸟 | `muscle_group = upper back`，`target = delts` | 上游 `target` 与 `muscle_group` 常不一致；tags 建议以 `target` 为主、参考 `muscle_group` |
| 1017 | band y-raise | Y 字举 | `muscle_group = traps`，`target = delts` | 同上；若收录需注意 traps 不在白名单 |
| 0235 / 0863 / 0864 / 0216 | …shoulder external/internal rotation | — | `muscle_group = rotator cuff`，但 `target = delts` | 肩袖动作在目录里只会显示「三角肌」，中文副标题需人工补「肩袖」 |
| 0233 / 0203 / 0202 / 3697 | cable … rear delt row (with rope / stirrups) | — | 即 face pull 动作本身 | 上游无 `face pull` 字面名（与 §5.2 结论一致）；按名字搜 `face pull` 会一无所获 |
| 0464 | front plank with twist | — | 目录注释写「平板支撑」 | 上游英文名（带 twist）与目录注释不一致，属既有偏差，本次未改动 |

### 11.8 来源（本次实际读取的小红书笔记）

**逐条读取 46 次（45 条去重笔记）：20 条有实质正文、15 条仅标签、11 条读取失败。**

**A. 有实质正文（20 条，构成本章主要证据）**

| # | 笔记标题 | 博主 | 点赞 | 发布时间 | 本次贡献 | 链接 |
|---|---|---|---|---|---|---|
| 1 | 练肩前必做！5分钟肩部热身跟练，零基础友好 | Greta | 1072 | 2026-08-13 | 肩部热身完整流程（前后环绕 / 交替绕肩 / 招财猫 / 水平肩外展 / 单侧绕肩 / 肩胛激活 / 斜方肌拉伸 / **伟大拉伸**） | [链接](https://www.xiaohongshu.com/search_result/6a7dbed7000000002c002e65?xsec_token=ABy0bYkzAuJk61uh4PwRlImh4DrrsMgN9e7eJRMx5533U=&xsec_source=) |
| 2 | 弹力带上肢热身激活🔥 | 柔弱欣 | 292 | 2026-07-31 | **弹力带绕肩 / 绕头旋转 / 水平扩胸（=弹力带拉开）/ 肩关节外旋 / W 下拉** 五动作 | [链接](https://www.xiaohongshu.com/search_result/6a6cbd520000000022012a09?xsec_token=ABYr3kdY4rt5ey5W9Vnym5xC79QtHwfK61PEiNwI1Lxvk=&xsec_source=) |
| 3 | 肩袖肌群训练 5个高效动作✅提高稳定性 | 谢不肉健身 | 2276 | 2026-01-09 | **肩外旋（冈下肌 / 小圆肌）**：弹力带外旋推举、俯卧 T 字伸展、弹力带外旋；**肩内旋（肩胛下肌）**：反向招财猫、弹力带内旋。原文明示「选择 1～2 个添加在上肢训练的**热身**或结束」 | [链接](https://www.xiaohongshu.com/search_result/6960c83a000000002200a8cb?xsec_token=AByaLM0s3GKEBuZt2qPAjy9z1lDj7AZOnbzyml3VuEBc8=&xsec_source=) |
| 4 | 肩袖损伤必练的弹力带训练 | 威猛先生s | 812 | 2025-11-27 | 「肩袖训练最好的就是用**弹力带**，而不是拿哑铃；球窝关节需要**三个平面内的激活**训练」 | [链接](https://www.xiaohongshu.com/search_result/6927d4b1000000001f004ec7?xsec_token=AB6IyA4PNGTK5ACFZIhOqemoU5iOFOCLAa3iXGsYmXyDg=&xsec_source=) |
| 5 | 【肩胛俯卧撑详解】 | 【凯圣王】 | 1390 | 2024-09-07 | 肩胛俯卧撑全解，原文明示「可以**推前当作热身**」「可以当基本功每天都练」 | [链接](https://www.xiaohongshu.com/search_result/66dc4a920000000012011297?xsec_token=ABAeN3pV9SQW2V7UQpyQkecbWCbG9T3Ivi1P5b8Bur27A=&xsec_source=) |
| 6 | 肩胛不稳定？试试练前激活前锯肌✅ | 谢不肉健身 | 604 | 2026-07-24 | 「上肢**热身**加上泡沫轴上推～能高效**激活前锯肌**」（上游无泡沫轴版 → 映射 3021） | [链接](https://www.xiaohongshu.com/search_result/6a62e3540000000001033d4c?xsec_token=ABp8Ftr5lPdpq7PCQQSi7o1Z2T5_-DlD_mhtgL2GmTS8Q=&xsec_source=) |
| 7 | 功能性训练\|肩胛与肩关节热身✅ | 有痔青年 | 15 | 2026-09-04 | 肩胛 + 肩关节活动度热身，明示「更有效激活背部肌群、肩袖肌群」，标签含 #弹力带热身 | [链接](https://www.xiaohongshu.com/search_result/6a9a60c60000000025036efa?xsec_token=ABQHhm0lnOehq5v7GBp3s70SLGVdJOL_qnlEfIc1PdwFM=&xsec_source=) |
| 8 | 肩背激活女生必练 ｜6个弹力带上肢热身训练 | 李林染 | 2539 | 2026-07-19 | 「女生练肩练背练上肢，**热身只需要一根弹力带**！6 个动作 2 分钟完成全套上肢激活」 | [链接](https://www.xiaohongshu.com/search_result/6a5cbcfa00000000110104b1?xsec_token=ABoiWobqIJx_tfFMDTmAqU_zw_3sWdkDzz-KUtMvhf1lA=&xsec_source=) |
| 9 | 肩袖内外旋功能训练 | 努力训练的程子 | 42 | 2026-02-11 | 「通过**肩的内外旋功能**的强化来稳定肩关节，预防与恢复运动损伤」 | [链接](https://www.xiaohongshu.com/search_result/698c79ca000000000903bb24?xsec_token=ABD_t_oNHmf79kQ71rZL4HEPJGcas-E-Uz7LCK-J9TOR8=&xsec_source=) |
| 10 | 5个黄金激活动作｜激活髋&臀肌群 | 小丁超爱笑 | 361 | 2025-08-28 | **五大专项激活动作逐条列出**：① 弹力带螃蟹走（臀中肌 / 大腿外侧）② 弹力带三点触碰（踝 / 核心）③ 弹力带单腿绕圈（髋周）④ **弹力带臀桥**（臀大肌 / 腘绳肌）⑤ **弹力带站姿髋外展**（臀中肌 / 大腿外侧） | [链接](https://www.xiaohongshu.com/search_result/68b0779d000000001d008dd6?xsec_token=ABW8FqpHDqjD57yVGSZEtERuRRIMG5DC9-MyQlncbOkls=&xsec_source=) |
| 11 | 一走一激活❗臀中肌塑形之王弹力带侧走 | 🦏 解剖小犀牛Biu～ | 3 | 2026-07-17 | **Monster Walk 完整拆解**：明示「**训练前激活神器**」「跑步党的暖身必做」「训练前激活或塑形都能做」；并列激活系列「蚌式开合 / 侧卧直腿抬 / 消防栓」 | [链接](https://www.xiaohongshu.com/search_result/6a596e89000000000f03d421?xsec_token=AB22PiXmLfyx_JoT09-__-bnit_gZsch1mLuOkDYSGdNQ=&xsec_source=) |
| 12 | 弹力带练臀｜螃蟹步练臀弹力带放哪里最好 | 宋大俊 | 227 | 2024-12-06 | 弹力带位置（膝上 / 脚踝 / 足弓）对**臀中肌、臀大肌激活程度**的影响；明示「膝盖处…适合初学者或者作为**热身动作**」 | [链接](https://www.xiaohongshu.com/search_result/6752b7260000000007028a47?xsec_token=ABu-_puU9ftuZhNVtHqLL6tDaMDhTWNNfneXn-sfSW3us=&xsec_source=) |
| 13 | 螃蟹步（侧移蚌式行走）练臀要点&技巧 | 广州健康管理 亚康 | 23 | 2026-08-10 | 螃蟹步「重点**激活臀中肌**，改善假胯宽」，弹力带位置 / 姿态 / 常见错误全解 | [链接](https://www.xiaohongshu.com/search_result/6a79bcf5000000002202f9f5?xsec_token=ABKotPxD3m8PTOvhQK2XEdd3ClZ54m8oYcTWqJp0LIvbI=&xsec_source=) |
| 14 | 跟着视频，3步让你的螃蟹步真正练到屁股上 | 野生力量 | 90 | 2026-07-03 | 螃蟹步三个易错点 + 「螃蟹步是**王牌动作**，改善假胯宽」 | [链接](https://www.xiaohongshu.com/search_result/6a47d34f000000001700bd30?xsec_token=ABEA0-VI0MFEH69PGKnpIXjXvgLMBgEWN0EC_DN-WP2vI=&xsec_source=) |
| 15 | 练臀顺序做对效果翻倍 | 隔壁康复老王 | 1708 | 2026-05-24 | 「4 个超适合居家练的**臀部激活动作**：臀桥 / 跪姿后踢腿 / 侧卧抬腿 / **弹力带侧步走**」 | [链接](https://www.xiaohongshu.com/search_result/6a12bb01000000003700ebec?xsec_token=ABBEOIBYepv4PcW2dLxZY6tt54IZp_bcuFWlGPcKyPslI=&xsec_source=) |
| 16 | 臀腿训练前必做的热身~髋关节灵活性训练 | Eden健身一噔噔 | 1958 | 2026-04-02 | 「**训练前**跟练一组」髋关节灵活性；髋灵活差导致深蹲蹲不下去 / 硬拉弓背 / 弓步迈不开 | [链接](https://www.xiaohongshu.com/search_result/69ce6ee40000000023014a28?xsec_token=ABbEj-vZ2KK6BPWp4uBB9isj9NDGoLEEnTg10YrW8cHm8=&xsec_source=) |
| 17 | 髋关节又紧又难受？｜5个动作打开僵硬髋部 | 大森Vito | 967 | 2025-12-22 | 「每次练臀腿前都能用到，也可以单独拿来改善**髋部灵活性**」 | [链接](https://www.xiaohongshu.com/search_result/694907d6000000001e005413?xsec_token=ABUmYVE_MmVJXB7sVU36yDHZx90CbAS_epIWlGEkJiLVE=&xsec_source=) |
| 18 | 髋飞机动作详细教学✅练臀必须的热身激活 | 爱健身的周周bf7 | 937 | 2026-03-01 | 「**练臀前的激活和热身**至关重要；稳定的核心躯干及髋关节灵活性是好臀的基础」（上游无髋飞机） | [链接](https://www.xiaohongshu.com/search_result/69a3a79d000000000e00fd22?xsec_token=AB_g8fzadCSsgo1NvCnCfJfP2ffce5LejkbgThCmLkezM=&xsec_source=) |
| 19 | 髋关节热身动作 | 敏敏是个教练 | 5049 | 2025-01-23 | 「**髋飞机：一个高效的髋关节热身动作**，提高足弓力量、髋关节灵活度、核心稳定」（上游无髋飞机） | [链接](https://www.xiaohongshu.com/search_result/679208d100000000180064e8?xsec_token=ABPCj0YZSYJlZaeieLGJUcU44CuYlFbRFuX7o-2oRuFok=&xsec_source=) |
| 20 | 腿不直练9090转髋 最细节的整合 | 张教 | 7091 | 2025-10-09 | 「**9090 转髋**比较适合新手…练髋关节灵活性」（上游无 90/90） | [链接](https://www.xiaohongshu.com/search_result/68e77d1900000000030236e2?xsec_token=ABuGXXgVgwzZ-xhGM4xKEjkec313LDCPVU2TC-yeiYCcY=&xsec_source=) |

**B. 仅标签级正文（15 条，用作传播度 / 主题交叉确认，不作为动作明细证据）**

| 笔记标题 | 博主 | 点赞 | 发布时间 | 用途 | 链接 |
|---|---|---|---|---|---|
| 想要练好背，先把肩胛骨安顿好❗️ | 体德健身教练培训 | 2.9万 | 2026-01-10 | 肩胛功能传播度 | [链接](https://www.xiaohongshu.com/search_result/6961e447000000001a02bf78?xsec_token=ABVE3u3n3n0q86BMO2O_vYNcI_d7CN4RZ6GfzUCMJesuY=&xsec_source=) |
| 驼背圆肩？肱骨前移？那你面拉了吗？ | 豪哥很啰嗦 | 1.7万 | 2026-04-04 | 面拉传播度 | [链接](https://www.xiaohongshu.com/search_result/69cff6d400000000220249c7?xsec_token=ABFSGD8-1nR4IlVARq3IYXwzIxWghzQAby8waLAlj0S_w=&xsec_source=) |
| 面拉到底练哪里！教学来啦 | IFBB PRO周红梅 | 1.3万 | 2025-08-12 | 面拉传播度 | [链接](https://www.xiaohongshu.com/search_result/689abe51000000002501736b?xsec_token=ABvs6cG1CMoY_yVLgJgqUKw_cg55Mrs4qPfia2Mqs715A=&xsec_source=) |
| 你说想强化肩后束，那试试绳索面拉… | 土豆健身 | 6990 | 2025-11-08 | 面拉传播度 | [链接](https://www.xiaohongshu.com/search_result/690efb870000000003020edf?xsec_token=ABJHL3Cv7T0ubyJ4z0GiEIbFIGE68Fdg_srYe8acPG_Oc=&xsec_source=) |
| 死磕基本功系列～如何控制肩胛骨 | 阿武MAX | 3548 | 2025-09-17 | 肩胛控制传播度 | [链接](https://www.xiaohongshu.com/search_result/68ca4ecf0000000012023fed?xsec_token=ABtdX_OIn-GjWO3bSBjMBN-ybemsSY-udbd72lzJXthGE=&xsec_source=) |
| 肩关节弹响 激活热身安排上！ | IFBB PRO周红梅 | 3276 | 2026-05-28 | 肩关节弹响 / 激活热身 | [链接](https://www.xiaohongshu.com/search_result/6a17c704000000003503bb47?xsec_token=ABs0OXFdPLPwuGtaIGE02P8Io_Ik_pHZFM-3ZOlz2gbU0=&xsec_source=) |
| 螃蟹步 | jiu教练 | 3155 | 2025-07-24 | 螃蟹步传播度 | [链接](https://www.xiaohongshu.com/search_result/6881da3a0000000010013c52?xsec_token=ABHC-ph5V7o7xnVSrFmC-hQ6cUZqS3fzlyoBkdYZent4g=&xsec_source=) |
| 一个动作唤醒臀部肌肉 | 阿武MAX | 1894 | 2025-12-04 | 臀激活传播度 | [链接](https://www.xiaohongshu.com/search_result/6930dc5c000000001e012d41?xsec_token=ABCUuGSLdveg59sSFxrRcHH1Ctkw9F2T-MQ-mqt3vQvQ0=&xsec_source=) |
| 练肩不会热身？跟着做就够了！ | 从小就很瘦 | 1692 | 2025-12-29 | 肩部热身传播度 | [链接](https://www.xiaohongshu.com/search_result/695223ec000000001e026f81?xsec_token=ABZ95aJ9dZC6s9EUrElD1GIoSjzHZ0rfa_hYigK0OmQrI=&xsec_source=) |
| 1条弹力带&2个动作🦾带你预防肩部伤病 | 思维的教学日记 | 1657 | 2025-04-19 | 弹力带肩部预防 | [链接](https://www.xiaohongshu.com/search_result/68027e19000000001200fbed?xsec_token=ABA1yFjtjBps571XJTfDhxA2MxNqsFNicKJsVKr24kwHg=&xsec_source=) |
| 肩膀弹响不得劲？试试这套练前弹力带热身！ | 氮泵豆 | 638 | 2026-04-30 | 「**练前**弹力带热身」 | [链接](https://www.xiaohongshu.com/search_result/69f2d0970000000036000118?xsec_token=ABvGEIThXQF5Htcp9LHYt_zdjf6I9l76QSJ9zL9GX0Pos=&xsec_source=) |
| 肩胛俯卧撑，健康肩关节 | 于MUXI | 180 | 2025-12-10 | 肩胛俯卧撑与肩健康 | [链接](https://www.xiaohongshu.com/search_result/69397cf4000000001e027bbb?xsec_token=ABDJdH-Hf5FNLSFeB8A9TEz3bRRGigOGHBu4fKgYbbAQA=&xsec_source=) |
| 谭成义说超牛的热身动作？ | 🍠薯门 | 63 | 2026-03-05 | 教练圈热身话题 | [链接](https://www.xiaohongshu.com/search_result/69a90b150000000015021c8a?xsec_token=ABqpI0kwXj5nwkgFVFmjJuEf6pA2R3zc-aK7Ca2Go6AYQ=&xsec_source=) |
| 3招激活肩胛骨🔥改善手臂上举受限✅ | 大攀运动健康笔记 | 366 | — | 肩胛激活（读取失败，**URL 未取到**，仅标题级） | — |
| 肩胛骨稳定训练｜肩胛骨俯卧撑（前锯肌） | 小房子运动医学 | 503 | 2025-05-23 | 肩胛俯卧撑 = 前锯肌（读取失败，仅标题级） | [链接](https://www.xiaohongshu.com/search_result/682fbdf20000000022036737?xsec_token=ABha1OrSh2RxgAkIn0JKnAebju6TGntaepXusJcGjfxaA=&xsec_source=) |

**读取失败的 11 条**（正文为空：视频笔记 / 平台限流 / 导航被拒）：`n1`（Greta，与来源 A-1 同笔记）、`n2` 三个动作｜打开尘封的肩胛骨（乔弟，1269 赞）、`n3` 肩胛骨上回旋功能训练（133 赞）、`n4` 远离肩袖伤病的三个简单动作（133 赞）、`n9` 屁股两侧凹陷？快锁死弹力带螃蟹步（18 赞）、`n16` 肩胛骨稳定性训练（26 赞）、`n17` 弹力带热身激活（29 赞）、`n23` 3招激活肩胛骨（366 赞）、`n25` 肩胛功能训练（483 赞）、`n26` 侧方螃蟹步细节（54 赞）、`n111` 肩胛骨俯卧撑（前锯肌）（503 赞）。

**检索关键词（11 次）**：① 健身前热身 肩袖 激活 动作 ② 弹力带 拉开 热身 肩 激活 ③ 肩袖 内外旋 弹力带 训练 ④ 面拉 肩后束 训练动作 ⑤ 肩胛骨 控制 激活 训练 ⑥ 臀中肌 激活 弹力带 侧步走 ⑦ 髋关节 动态热身 训练前 ⑧ 怪兽走 弹力带 臀 ⑨ 弹力带拉开 肩 热身 ⑩ 肩胛 前伸 后缩 肩胛俯卧撑 训练 ⑪ 髋关节 90 90 热身 髋飞机

### 11.9 局限与未覆盖

1. **大量小红书热身笔记把动作表放在图片 / 视频里**，正文只有标签（本章 15/45 条如此，含 1.3 万～2.9 万赞的高互动样本）。未做 OCR / 图像识别，动作明细主要来自 20 条**正文写明动作**的笔记。
2. **11 条笔记读取失败**（`Navigation rejected` / 空返回），重试 2–3 次后放弃；其中 3 条（366 / 483 / 503 赞）正是肩胛控制主题，**肩胛控制类的证据因此偏薄**，仅靠标题级与 `i112` / `n27` 支撑。
3. **「面拉作为热身」的证据是间接的**：面拉在小红书的主要定位是**肩后束训练动作 + 圆肩驼背矫正动作**（1.3 万 / 1.7 万 / 6990 赞），不是「练前热身」；本章将其纳入是因为它同时是肩袖 / 肩胛稳定的常见练前激活选择，但**未找到明确写「练前用面拉热身」的正文**。
4. **弹力带拉开没有字面命中的证据**：小红书用「弹力带水平扩胸」「水平肩外展」表述（`i104` / `i103`），本章按语义映射到 `0993 band reverse fly`（置信度**中**）。上游无 `band pull apart`，无法给出精确 ID。
5. **未翻评论**。评论常含博主补充的动作替换，本次未采集。
6. **未验证上游版本漂移**。本次基于检索当日 `main` 分支的 `exercises.json` 与文件树；上游若更新条目，ID、名称与媒体路径需重新核对。
7. **未校验 CloudBase 上传状态**。§11.4 只校验了上游仓库内路径存在性，不代表对应 JPEG / GIF 已上传到 `cloud://cloud1-d2ga0mned4bbf9b29...`。
8. **未做全量语义审查**。本次只针对热身候选做精确名 / 语义核对，未穷举 1,324 条中是否还有其他适合抗阻热身的动作。
9. **`compound` 判定带主观性**。1604 / 2571 / 1419 作为动态活动度动作标为 `false`；1408 / 3561 为与已在库的 3013 / 1409 保持一致标为 `true`。若产品对「复合动作」另有口径，需重新判定。
10. **未验证 `mode` 新词对现有筛选 / 排序逻辑的影响**。本次仅记录建议，未改动代码。

### 11.10 给下一步的最小建议（仅建议，未实施）

1. **优先补 5 条**（target 在白名单内、去重价值高、证据强）：`0993` 弹力带拉开、`0235` 绳索站姿肩外旋、`0216` 绳索坐姿肩内旋、`3006` 弹力带坐姿髋外展、`2143` 哑铃肩绕环。
2. **肩胛控制要落地必须先改粗筛**：`TARGET_WHITELIST` 增加 `serratus anterior`（可选 `traps`），否则 `3021` / `3011` / `3012` / `0688` 加进白名单也进不了目录；同时修正 `TARGET_LABELS`（18 项）与 `TARGET_WHITELIST`（14 项）的口径不一致。
3. **面拉不要重复收录**：`0233` 已在库，若必须新增请选 `3697`（跪姿），并明确 `0203` / `0202` 与 `0233` 近乎重复。
4. **怪兽走 / 螃蟹步不要重复收录**：`0628` 已在库；若产品要「弹力带侧步走」这一动作名，需先决定是否接受 `0628` 的 `equipment = "body weight"` 与原说明书写明用弹力带的矛盾。
5. **mode 词表建议补**：`shoulder-external-rotation`、`shoulder-internal-rotation`、`scapular-protraction`、`scapular-retraction`、`shoulder-circumduction`、`mobility-flow`，并同步更新 `curated-catalog.js` 头注释里的词表约定。
6. **补白名单必须以 ID 为准**，并逐个读 `instruction_steps.zh` 确认动作——本次已实测 `3292 elevator`（站姿体前屈）与 `3012 scapula dips`（站姿肩胛后缩）命名与动作不符。
7. **上游不存在的动作需单独决策**：弹力带肩内外旋（上游只有 cable / dumbbell 版）、弹力带侧步走、蚌式开合、髋飞机、90/90 转髋。要么接受等价替代并调整文案，要么走自定义动作（脱离上游 ID 体系，属架构变更，需 ADR）。
