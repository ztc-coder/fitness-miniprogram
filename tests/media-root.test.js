const media = require('../data/media-root');

describe('CloudBase 媒体前缀配置(data/media-root)', () => {
  test('默认未配置前缀:MEDIA_ROOT 为空,所有路径解析为空串(降级 glyph)', () => {
    expect(media.MEDIA_ROOT).toBe('');
    expect(media.resolveMedia('exercises/images/0025-EIeI8Vf.jpg')).toBe('');
    expect(media.resolveMedia('exercises/videos/0025-EIeI8Vf.gif')).toBe('');
    expect(media.resolveMedia('')).toBe('');
    expect(media.resolveMedia(null)).toBe('');
  });

  test('配置 fileID 桶根后,目录相对路径只含一次 exercises', () => {
    const root = 'cloud://cloud1-d2ga0mned4bbf9b29.636c-demo';
    expect(media.resolveMedia('exercises/images/0025-EIeI8Vf.jpg', root))
      .toBe('cloud://cloud1-d2ga0mned4bbf9b29.636c-demo/exercises/images/0025-EIeI8Vf.jpg');
  });

  test('配置 HTTPS 前缀后,容忍结尾斜杠与开头斜杠', () => {
    const root = 'https://cdn.example.com/';
    expect(media.resolveMedia('/exercises/videos/0025-EIeI8Vf.gif', root))
      .toBe('https://cdn.example.com/exercises/videos/0025-EIeI8Vf.gif');
  });
});
