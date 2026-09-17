/**
 * 动作详情弹层(动作库 / 打卡页复用)。
 * 入参 detail:{nameZh, nameEn, equipmentZh, targetZh, bodyPartZh, steps, glyph, mediaSrc, isBodyWeight}
 * 无媒体(mediaSrc 为空)时显示首字 glyph。媒体走 CloudBase,不进主包。
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

  methods: {
    onClose() {
      this.triggerEvent('close');
    },

    onPick() {
      this.triggerEvent('pick');
    },

    noop() {},
  },
});
