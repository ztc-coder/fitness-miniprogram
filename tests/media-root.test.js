const config = require('../config/cloud-env');
const media = require('../data/media-root');

describe('CloudBase 媒体前缀配置(data/media-root)', () => {
  test('媒体根来自 config/cloud-env.js,目录相对路径解析为 fileID', () => {
    expect(config.mediaRoot).toBe(process.env.FITNESS_CLOUD_MEDIA_ROOT);
    expect(media.MEDIA_ROOT).toBe(String(config.mediaRoot).trim());
    expect(media.resolveAsset('exercises/videos/0001-2gPfomN.gif'))
      .toBe(String(config.mediaRoot).trim() + '/exercises/videos/0001-2gPfomN.gif');
    expect(media.resolveAsset('')).toBe('');
    expect(media.resolveAsset(null)).toBe('');
  });

  test('配置 HTTPS 前缀后,容忍结尾斜杠与开头斜杠', () => {
    const root = 'https://cdn.example.com/';
    expect(media.resolveAsset('/exercises/videos/0025-EIeI8Vf.gif', root))
      .toBe('https://cdn.example.com/exercises/videos/0025-EIeI8Vf.gif');
    expect(media.resolveAsset('exercises/images/0001-2gPfomN.jpg', root))
      .toBe('https://cdn.example.com/exercises/images/0001-2gPfomN.jpg');
  });

  test('配置的云存储桶根原样使用,不再按历史前缀清空', () => {
    const saved = process.env.FITNESS_CLOUD_MEDIA_ROOT;
    const ownRoot = 'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720';
    process.env.FITNESS_CLOUD_MEDIA_ROOT = ownRoot;
    jest.resetModules();
    try {
      const fresh = require('../data/media-root');
      expect(fresh.MEDIA_ROOT).toBe(ownRoot);
      expect(fresh.resolveAsset('exercises/videos/0001-2gPfomN.gif'))
        .toBe(ownRoot + '/exercises/videos/0001-2gPfomN.gif');
    } finally {
      if (saved === undefined) delete process.env.FITNESS_CLOUD_MEDIA_ROOT;
      else process.env.FITNESS_CLOUD_MEDIA_ROOT = saved;
      jest.resetModules();
    }
  });
});
