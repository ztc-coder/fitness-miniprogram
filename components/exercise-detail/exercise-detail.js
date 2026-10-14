/**
 * 动作详情弹层(动作库 / 打卡页复用)。
 * 入参 detail:{nameZh, equipmentZh, targetZh, bodyPartZh, steps, glyph,
 *              gifSrc, imageSrc, isBodyWeight}
 * 媒体降级链(真实存在于组件内,不依赖上传成功):
 *   分解 GIF → JPEG 示意图 → 首字 glyph;某级 src 为空则直接跳过该级。
 * 媒体走 CloudBase(data/media-root.js 单一前缀配置),不进主包,不热链 GitHub。
 * © Gym visual 署名固定展示。
 */
Component({
  properties: {
    detail: { type: Object, value: null },
    /** 动作库入口带「加入」按钮;打卡页只看不选 */
    showPick: { type: Boolean, value: false },
    /** 加入按钮文案,由调用方按场景传入 */
    pickText: { type: String, value: '加入训练' },
  },

  data: {
    /** 可用媒体级联(gif → image),binderror 时逐级后退,走完则显示 glyph */
    mediaStages: [],
    stageIndex: 0,
  },

  observers: {
    detail(detail) {
      if (!detail) return;
      const mediaStages = [detail.gifSrc, detail.imageSrc].filter(Boolean);
      this.setData({ mediaStages, stageIndex: 0 });
    },
  },

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onPick() {
      this.triggerEvent('pick');
    },

    /** 当前媒体加载失败:退到下一级;越过级联尽头后模板改显示 glyph */
    onMediaError() {
      this.setData({ stageIndex: this.data.stageIndex + 1 });
    },

    noop() {},
  },
});
