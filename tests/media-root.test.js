const media = require('../data/media-root');

describe('CloudBase 媒体前缀配置(data/media-root)', () => {
  test('默认已配置实际 CloudBase 桶根:目录相对路径解析为 cloud:// fileID', () => {
    expect(media.MEDIA_ROOT).toBe(
      'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720'
    );
    expect(media.resolveAsset('exercises/videos/0001-2gPfomN.gif')).toBe(
      'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720/exercises/videos/0001-2gPfomN.gif'
    );
    expect(media.resolveAsset('')).toBe('');
    expect(media.resolveAsset(null)).toBe('');
  });

  test('配置 fileID 桶根后,目录相对路径只含一次 exercises', () => {
    const root = 'cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720';
    expect(media.resolveAsset('exercises/images/0001-2gPfomN.jpg', root))
      .toBe('cloud://cloud1-d2ga0mned4bbf9b29.636c-cloud1-d2ga0mned4bbf9b29-1456520720/exercises/images/0001-2gPfomN.jpg');
  });

  test('配置 HTTPS 前缀后,容忍结尾斜杠与开头斜杠', () => {
    const root = 'https://cdn.example.com/';
    expect(media.resolveAsset('/exercises/videos/0025-EIeI8Vf.gif', root))
      .toBe('https://cdn.example.com/exercises/videos/0025-EIeI8Vf.gif');
  });
});
