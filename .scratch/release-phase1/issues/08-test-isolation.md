<!-- DSH-IDEMPOTENCY-KEY: deck-plan-wayfinder-public-release-phase1-child-test-isolation -->
<!-- parentKey: 00 -->
<!-- created: 2026-10-20T06:40:24.398Z -->
# 隔离 npm test 对外部 /tmp 数据集的依赖

## Question

`scripts/build-exercises.js:10` 的 `DEFAULT_SRC_DIR = process.env.DATASET_DIR || '/tmp/exercises-dataset'` 让测试依赖一台机器上的临时目录。`workspace-baseline.md` 记录过 35 套里 1 套因此失败，并明确「不能声称全量测试全绿」。

## 验收

- 干净环境（无 `/tmp/exercises-dataset`）下 `npm test` 全绿，失败项不再混在「29 跳过」里。
- 需要外部数据集的用例进仓库夹具，或显式 skip 且写明原因与启用条件。
- 不改变正式构建脚本的默认行为（`scripts/build-exercises.js` 仍可用 `--src` 指向真实数据集）。

## 进度

- 2026-10-20 复现与定位：本机 `/tmp/exercises-dataset` 不存在（ls exit 1），而当前全量测试原本就只有「29 skipped」、无失败项——`workspace-baseline.md:14` 记的那条失败（`tests/catalog.test.js` 一条用默认外部目录）**早已被夹具修掉**（该用例现在 `fs.mkdtempSync` 造 `exercises.json`/`name_zh.json` 再 `buildCatalog({srcDir})`）。
- 残留耦合只剩 `tests/exercise-selector.test.js` 三条：`HAS_DATASET = fs.existsSync(SRC_JSON)` 依赖 `/tmp/exercises-dataset/exercises.json`，缺数据集时静默 skip，未写原因与启用条件。
- 新建仓库夹具 `tests/fixtures/exercises-dataset/`：`exercises.json`（3 条合成动作，id 9102/9101/9103 刻意乱序以覆盖 4 位 id 排序）、`name_zh.json`、`README.md`（说明是合成夹具、不含媒体、以及完整数据集比对的启用条件）。夹具进 git，干净 clone 自带。
- `tests/exercise-selector.test.js`：原「连续两次生成字节一致」改为无条件执行、读夹具（`DATASET_DIR=FIXTURE_DIR` 跑两次生成器，断言字节一致 + `3 条精简索引` + fixture id/中文名）；另两条改名为 `[需完整数据集] …` 并在夹具 README 写明启用条件（放好 `/tmp/exercises-dataset` 或设 `DATASET_DIR`）。
- **发现票面假设有误**：`scripts/build-exercises.js` 原本**没有** `--src` 参数（`main()` 直接无参调用 `generateCatalog()`，只能靠 `DATASET_DIR` 环境变量）。按验收第 3 条字面补齐 `parseArgs(argv)` 支持 `--src <数据集目录>`、`--out <输出目录>`；`DEFAULT_SRC_DIR`／`DEFAULT_OUT_DIR` 与无参调用行为**完全不变**。
- 补测试：`tests/build-exercises.test.js` 新增 `describe('命令行参数')` 两条（缺省/解析成功/缺值报错/未知参数报错）。
- README「本地检查」段补一句：`npm test` 不依赖仓库外数据集、默认读夹具、两条完整数据集比对显式跳过及启用条件、生成器仍可 `--src` 指向真实数据。
- 验证（本机，无 `/tmp/exercises-dataset`）：
  - 全量 `jest --runInBand --silent`：**45 套全过，653 passed / 28 skipped / 681**，0 失败。
  - `npm run check:package`：exit 0，1,213.8 KiB / 96 文件。
  - `npm run check:cloud-env`：exit 1（预期，属 #05 的部署配置阻断）；`npm run check:public-info`：exit 1（预期，属 #04/#06）。
  - 干净 clone 验证：`git clone` HEAD → 叠加本票改动 → **43 套全过，610 passed / 28 skipped / 638**，证明不再依赖仓库外数据集。
- 未做/未验证：真实上游数据集比对（需 1324 条完整数据集，本机无）仍按设计 skip；未验证微信开发者工具编译（本票不涉及）。

## Comments

### local — 2026-10-20T08:57:51.822Z
验收三条已全部满足：(1) 干净环境无 /tmp/exercises-dataset 下全量测试 45 套全过、0 失败，skip 项全部写明原因；(2) 生成器/索引用例改用仓库夹具 tests/fixtures/exercises-dataset/，两条完整数据集比对加 [需完整数据集] 前缀并在夹具 README 写明启用条件；(3) 生成器默认行为未变，并补齐票面假定的 --src/--out 参数（原来只有 DATASET_DIR 环境变量）。提交 f629b79。

## Answer

Status: resolved
Assignees: ztc-coder
Type: task
Blocked by:
Labels: wayfinder:task
