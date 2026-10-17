const { themePage } = require('../../utils/theme');
const info = require('../../config/public-info');
const { getPublicInfoIssues, isRealText } = require('../../utils/public-info');
const sections = require('./help-content');

Page(themePage({
  data: { sections, anchor: '', missingInfo: [], releaseBlocked: true },

  onLoad(options = {}) {
    const section = sections.find(item => item.id === options.section);
    this.setData({ anchor: section ? section.id : '' });
  },

  onReady() {
    if (this.data.anchor) wx.pageScrollTo({ selector: `#${this.data.anchor}`, duration: 0 });
  },

  onShow() {
    const missingInfo = getPublicInfoIssues(info);
    this.setData({
      missingInfo,
      releaseBlocked: missingInfo.length > 0,
      operatorName: isRealText(info.operatorName) ? info.operatorName : '真实运营者尚未提供',
      privacyContact: this.contactView(info.privacyContact),
      supportContact: this.contactView(info.supportContact),
      metadataScope: isRealText(info.antiResurrection.scope) ? info.antiResurrection.scope : '具体元数据范围待第03票落实，发布前必须补齐',
      metadataRetention: isRealText(info.antiResurrection.retention) ? info.antiResurrection.retention : '保存策略尚未确认，不承诺所有技术痕迹均已擦除或固定保存期限',
    });
  },

  contactView(contact) {
    const available = isRealText(contact.label) && isRealText(contact.value);
    return { available, label: available ? contact.label : '公开联系方式尚未提供', value: available ? contact.value : '' };
  },

  onCopyContact(e) {
    const key = e.currentTarget.dataset.contact;
    if (key !== 'privacyContact' && key !== 'supportContact') return;
    const contact = this.data[key];
    if (!contact || !contact.available) {
      wx.showToast({ title: '公开联系方式尚未提供', icon: 'none' });
      return;
    }
    wx.setClipboardData({
      data: contact.value,
      success: () => wx.showToast({ title: '已复制，请通过对应渠道联系', icon: 'none' }),
      fail: () => wx.showToast({ title: '复制失败，请手动复制页面联系方式', icon: 'none' }),
    });
  },
}));
