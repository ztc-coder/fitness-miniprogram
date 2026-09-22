# 03: 动作库页官方原值胶囊多选

**状态：implemented；页面测试已通过。**

## 当前契约

- 部位胶囊：9 个官方非 cardio bodyPart 中文标签 +「全部」。
- 器械胶囊：发布目录实际 equipment 原值，稳定排序；未知值回退英文。
- 同行多选为 OR；部位、器械、搜索词之间为 AND；「全部」清空该行。
- `applySearch` 一次提交筛选条件、胶囊、items、resultCount、分页状态，不依赖 setData 回调。
- 首屏 24 条、触底追加 24 条，最多预热 48 张 JPEG；详情保持 GIF → JPEG → glyph 降级。
- `data/exercise-labels.js` 是页面与打卡详情共用的中文展示表。

## 验证

```bash
npx jest tests/library-paging.test.js tests/library-multiselect.test.js tests/search-multiselect.test.js --runInBand
# 通过
```

剩余人工项：微信开发者工具确认真实 WXML 渲染、滚动和 CloudBase 图片/GIF 加载。
