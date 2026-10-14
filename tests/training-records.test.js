const domain = require('../utils/domain');
function setup(path) {
  jest.resetModules();
  const storage = {};
  global.wx = { getStorageSync: k => storage[k], setStorageSync: (k,v) => { storage[k] = v; }, removeStorageSync: k => { delete storage[k]; }, navigateTo: jest.fn(), navigateBack: jest.fn(), showToast: jest.fn(), getNetworkType: ({success}) => success({networkType:'none'}), cloud: { database: () => { throw Error('offline'); } } };
  let definition; global.Page = p => { definition = p; };
  require(path);
  const page = Object.assign({}, definition, { data: Object.assign({}, definition.data), setData(values, cb) { Object.assign(this.data, values); if(cb) cb(); } });
  return { page, storage };
}
const settled = async () => { for(let i=0;i<20;i++) await Promise.resolve(); };
function draft() {
  return domain.snapshotSession({id:'p',cursor:0,cycleDays:[{dayId:'a',exercises:[{exerciseId:'0025',name:'卧推',equipment:'barbell',sets:4,targetWeight:20,targetReps:10}]}]});
}
test('today start preserves existing paused draft and resume explicitly upgrades legacy without resuming pause', () => {
  const { page, storage } = setup('../pages/today/today');
  const paused = domain.pauseTraining(draft(), 100);
  storage['fitness:trainingDraft'] = paused;
  page.onStartTraining();
  expect(storage['fitness:trainingDraft']).toEqual(paused);
  expect(wx.navigateTo).toHaveBeenCalled();
  page.onResumeDraft();
  expect(storage['fitness:trainingDraft'].training.phase).toBe('paused');
  const legacy = { id:'old',exercises:[{sets:[{weight:20,reps:10}]}] };
  storage['fitness:trainingDraft'] = legacy;
  page.onResumeDraft();
  expect(storage['fitness:trainingDraft'].exercises[0].sets[0].status).toBe('pending');
});
test('library upgrades legacy draft, preserves rest and stable IDs, never navigates on write failure', () => {
  const { page, storage } = setup('../pages/library/library');
  let s = draft(); s = domain.startTrainingSet(s,s.training.currentSetId,100); s = domain.completeTrainingSet(s,s.training.currentSetId,200);
  storage['fitness:trainingDraft'] = s;
  page.data.pickMode = true;
  page.onQuickAdd({currentTarget:{dataset:{id:'0043'}}});
  const next = storage['fitness:trainingDraft'];
  expect(next.training).toEqual(s.training);
  expect(next.exercises[0]).toEqual(s.exercises[0]);
  expect(next.exercises[1].sets[0].status).toBe('pending');
  expect(next.exercises[1].sets[0].id).not.toBe(s.exercises[0].sets[0].id);
  storage['fitness:trainingDraft'] = {id:'old',exercises:[{sets:[{weight:20,reps:10}]}]};
  page.onQuickAdd({currentTarget:{dataset:{id:'0043'}}});
  expect(storage['fitness:trainingDraft'].exercises[0].sets[0].status).toBe('pending');
  wx.navigateBack.mockClear(); wx.setStorageSync = () => {throw Error('full');};
  page.onQuickAdd({currentTarget:{dataset:{id:'0043'}}});
  expect(wx.navigateBack).not.toHaveBeenCalled();
});
test('offline detail and trend keep completed volume on partially skipped exercise, suppress skipped targets', async () => {
  const { page, storage } = setup('../pages/records/records');
  let s = draft(); s = domain.startTrainingSet(s,s.training.currentSetId,100); s = domain.completeTrainingSet(s,s.training.currentSetId,200); s = domain.setExerciseSkipped(s,0,true);
  const final = await require('../utils/queue').complete(s,500);
  page.data.view = 'trend'; page.onShow(); await settled();
  expect(page.data.sessions[0].volume).toBe('200 kg');
  expect(page.data.sessions[0].meta).toContain('1 个动作');
  expect(page.data.bars[0].value).toBe('200');
  let detail; global.Page = p => { detail = p; }; require('../pages/session-detail/session-detail');
  detail.data = {}; detail.setData = v => Object.assign(detail.data,v);
  detail.onLoad({id:final.id}); await settled();
  expect(detail.data.exerciseCount).toBe(1);
  expect(detail.data.exercises[0].sets.map(s=>s.text)).toEqual(['20 kg × 10','已跳过','已跳过','已跳过']);
  expect(storage['fitness:completedTraining']).toHaveLength(1);
});
test('completed residual drafts cannot restart or accept library additions even if deletion fails', async () => {
  const { page, storage } = setup('../pages/today/today');
  let s = draft(); s = domain.startTrainingSet(s,s.training.currentSetId,100); s = domain.completeTrainingSet(s,s.training.currentSetId,200); s = domain.setExerciseSkipped(s,0,true);
  await require('../utils/queue').complete(s,500);
  storage['fitness:trainingDraft'] = s;
  wx.removeStorageSync = () => {throw Error('full');};
  page.onResumeDraft();
  expect(wx.navigateTo).not.toHaveBeenCalled();
  let library; global.Page = p => {library = p;}; require('../pages/library/library');
  library.data = {pickMode:true};
  library.onQuickAdd({currentTarget:{dataset:{id:'0043'}}});
  expect(wx.navigateBack).not.toHaveBeenCalled();
  expect(storage['fitness:trainingDraft']).toEqual(s);
});
test('legacy submitted history stays unchanged while untrained new exercises are excluded from trend and count', async () => {
  const { page, storage } = setup('../pages/records/records');
  const legacy = { _id:'legacy', startedAt:100, submittedAt:200, exercises:[{name:'旧成绩',equipment:'barbell',sets:[{weight:30,reps:5}]}] };
  const pending = domain.snapshotSession({id:'p',cycleDays:[{dayId:'a',exercises:[{name:'未练',sets:1,targetWeight:50,targetReps:10}]}],cursor:0});
  storage['fitness:pendingQueue'] = [legacy];
  let s = draft(); s = domain.startTrainingSet(s,s.training.currentSetId,100); s = domain.completeTrainingSet(s,s.training.currentSetId,200); s = domain.setExerciseSkipped(s,0,true);
  s = domain.addSessionExercise(s,{name:'未练',equipment:'barbell'}); s = domain.setExerciseSkipped(s,1,true);
  await require('../utils/queue').complete(s,500);
  page.data.view = 'trend'; page.refresh(); await settled();
  expect(page.data.exerciseNames).toEqual(['卧推','旧成绩']);
  expect(storage['fitness:pendingQueue']).toEqual([legacy]);
  expect(domain.computeSessionTotalVolume(legacy)).toBe(150);
  expect(pending.exercises[0].sets[0].status).toBe('pending');
});
