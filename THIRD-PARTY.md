# 第三方内容与许可

本文件是根 [LICENSE](LICENSE) 的补充说明。**仓库自有的代码、文档与自制素材以 MIT 发布；下列第三方内容各有自己的条款，不因根 LICENSE 而改变。**

结论先读：**动作图片/GIF 不在本仓库内**（它们只以 `imagePath`/`gifPath` 路径字符串存在，真实媒体托管在云存储），因此本仓库不构成对 Gym visual 媒体的再分发。动作目录文本与中文动作名随仓库分发，许可证为 MIT，须保留署名。

## 1. 随仓库分发的内容

### 1.1 动作目录文本（`data/`）

| 项 | 内容 |
|---|---|
| 来源 | [hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)（MIT） |
| 上游来源 | ExerciseDB v1 by AscendAPI，经 Kaggle 重新分发；该仓库自述「不主张底层动作内容的所有权」 |
| 上游版权行 | `Copyright (c) 2026 Hasan Emir Yıldırım` |
| 本仓库使用字段 | `id` / `name` / `equipment` / `bodyPart` / `target` / `instructionSteps`（中文要领）/ `imagePath` / `gifPath` |
| 生成链 | `scripts/build-exercises.js` → `data/exercises-data-{1,2,3}.js`、`data/slug-map.js`、`data/catalog-snapshot.json` |
| 来源快照 | `data/catalog-snapshot.json` 记录上游 commit、源文件 sha256 前 12 位与行数，可逐项回溯 |
| 许可 | **MIT** |
| 义务 | 分发时必须保留上游版权声明与许可声明，见 §1.4 |
| 可否再分发 | 可以，按 MIT |

### 1.2 中文动作名（`data/` 的 `nameZh` 字段）

| 项 | 内容 |
|---|---|
| 来源 | [wangmuerxiao/exercises-dataset-zh](https://github.com/wangmuerxiao/exercises-dataset-zh) 的 `data/name_zh.json`（1,318 键） |
| 上游版权行 | 与其 fork 自的原仓库一致：`Copyright (c) 2026 Hasan Emir Yıldırım` |
| 许可依据 | 该仓库 README「License & 许可」明确「中文动作名翻译 (`name_zh.json`, `name_zh.js`) 为新增内容，同样采用 MIT License」；其 `LICENSE` 为 MIT |
| 核查时间与实际做法 | 2026-10-20 实际抓取该仓库 `master` 分支的 `LICENSE`、`README.md`、上游 `NOTICE.md` 后记录，不是凭印象 |
| 义务 | 同上 MIT 双声明保留 |
| 可否再分发 | 可以，按 MIT |

> 注：本项目只取其**中文名映射**，不取其媒体。该 fork 保留了原仓库因版权争议移除的 `images/`、`videos/`，媒体许可链见 §2.1，与本条无关。

### 1.3 自制素材（以本仓库 MIT 发布）

| 内容 | 说明 | 许可 |
|---|---|---|
| `images/tabbar/*.png`（16 个 + `gen/` 下 4 个源图） | 本项目用图像生成工具产出的图标字形，未使用任何第三方字形库或图标集 | 根 LICENSE（MIT） |
| `assets/audio/rest.wav`、`assets/audio/generate-rest.js` | 数学正弦波合成的 0.3 秒提示音，未采样任何外部音频 | **CC0 1.0 Universal**（`assets/audio/README.md` 声明），同样允许 MIT 项目再分发 |
| `.scratch/`（内部决策记录与 `design/`、`refined-c/` 下的自制 HTML/PNG 原型） | 本项目工作记录与自绘原型，未嵌入第三方素材 | 根 LICENSE（MIT） |
| 业务源码（`app.*`、`pages/`、`components/`、`utils/`、`scripts/`、`tools/`、`cloudfunctions/`、`config/`、`tests/`、`styles/`、`docs/`） | 本项目原创 | 根 LICENSE（MIT） |

### 1.4 上游 MIT 全文（保留义务）

以下为 2026-10-20 从上游仓库实际取得的许可原文（含其版权行），按 MIT 要求随分发一并保留：

```text
MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

上游 `LICENSE` 另附「MEDIA EXCEPTION」段，明确上述 MIT **不覆盖** `images/`、`videos/` 目录里的动作媒体。本仓库不携带该媒体，见 §2.1。

## 2. 不随本仓库分发的内容

### 2.1 动作图片与 GIF（© Gym visual）

| 项 | 内容 |
|---|---|
| 版权归属 | **Gym visual** — https://gymvisual.com/ |
| 是否在本仓库 | **否**。仓库只保留路径字符串（`exercises/images/…`、`exercises/videos/…`），真实媒体上传在运营者 CloudBase 云存储，根地址由 `data/media-root.js` 拼接 |
| 使用限制 | 180×180 分辨率；每次使用须保留署名 `© Gym visual — https://gymvisual.com/`（页面与帮助页已固定展示） |
| 授权状态 | 运营者的**公开使用书面授权仍在流程中**。上游 zh fork 声称持有 Gym visual 书面许可，但原仓库曾因多方版权争议移除媒体；版权主张在 Gym visual / ExerciseDB / 仓库作者间冲突（[ADR-0007](docs/adr/0007-exercises-dataset-as-catalog.md)） |
| 对本仓库的含义 | 本仓库**不构成**媒体再分发，因此 MIT 不涉媒体；但仓库也不授予任何人使用该媒体的权利 |
| 若今后要分发媒体包 | 必须：(1) 取得 Gym visual 本人书面授权，覆盖主体/范围/期限/分发方式；(2) 保留署名与 180×180 限制；(3) 不把仓库当可再分发素材镜像出去。落地形态见 README「动作媒体：仓库里没有，部署时怎么补」与 `docs/independent-deployment.md` 第 4 节：仓库不含媒体、媒体包不入库、`MEDIA_ROOT` 单点替换 |

### 2.2 npm 依赖

`package.json` 只有 2 个 **devDependencies**（`@cloudbase/manager-node`、`jest`），**没有生产依赖**；小程序不打包 `node_modules`，`miniprogram_npm/` 也在 `.gitignore` 中。按 `package-lock.json` 统计，已安装的 **564 个包全部标记 `dev: true`，不随源码分发**。按 MIT 分发源码时它们不构成分发义务，但仍在此记录实际扫描结果：

| 许可 | 包数 |
|---|---|
| MIT | 471 |
| ISC | 48 |
| BSD-3-Clause | 19 |
| Apache-2.0 | 14 |
| BSD-2-Clause | 5 |
| (AFL-2.1 OR BSD-3-Clause) | 1 |
| (MIT OR CC0-1.0) | 1 |
| CC-BY-4.0 | 1 |
| Unlicense | 1 |
| lockfile 中未声明 | 3 |

- 无 GPL / AGPL / SSPL 等 copyleft 许可，无与 MIT 分发冲突的项。
- 3 个「未声明」：`@cloudbase/signature-nodejs@1.1.0`、`@cloudbase/signature-nodejs@2.0.0`（`@cloudbase/manager-node` 的传递依赖，其 package.json 无 `license` 字段，上游当前版本声明 Apache-2.0）、`exit@0.1.2`（用旧式 `licenses: [{type:"MIT"}]` 字段声明 MIT）。
- `caniuse-lite`（CC-BY-4.0）与 `json-schema`（AFL-2.1 OR BSD-3-Clause）为构建期传递依赖，均不进入分发物。

### 2.3 字体

`app.wxss` 等样式只引用系统字体栈（`-apple-system`、`PingFang SC`、`SF Mono` 等），仓库内**不含任何字体文件**，因此无字体许可义务。

## 3. 复核方法

以下命令可重跑，用来验证本文件的结论：

```bash
# 1) 仓库内是否真的没有 Gym visual 媒体（只应有路径字符串与图标）
git ls-files | grep -Ei '\.(jpg|jpeg|gif)$'          # 期望：无输出
git ls-files images                                 # 期望：只有 tabbar 图标

# 2) npm 依赖许可分布（期望：564 包全部 dev，0 生产依赖，无 copyleft）
node -e "const l=require('./package-lock.json');const c={};for(const[k,v]of Object.entries(l.packages||{})){if(!k)continue;const lic=typeof v.license==='string'?v.license:'(undeclared)';c[lic]=(c[lic]||0)+1;}console.log(c)"

# 3) 上游许可原文（需要联网）
curl -sS https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/LICENSE
curl -sS https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/NOTICE.md
curl -sS https://raw.githubusercontent.com/wangmuerxiao/exercises-dataset-zh/master/LICENSE
```

## 4. 待人力确认

1. **媒体公开使用授权**（最高优先）：Gym visual 书面授权是否到手、覆盖哪些分发方式。未到手前，仓库不得新增媒体、媒体包或任何镜像。
2. **版权署名主体**：根 LICENSE 现按仓库唯一 git 作者身份写 `ztc-coder`。若要以真实姓名或组织主张版权，改 LICENSE 首行即可，其余不受影响。
3. **ExerciseDB / AscendAPI 链条**：本仓库通过 MIT 数据集间接使用，未直接取得 ExerciseDB 授权；若上游对数据本身主张额外权利，须重新评估（截至 2026-10-20 上游自述不主张）。
