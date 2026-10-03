jest.mock('../src/api/analyzeSource', () => ({analyzeSource:jest.fn(),cancelSourceJob:jest.fn().mockResolvedValue()}));
jest.mock('../src/lib/deviceId', () => ({ensureDeviceId:jest.fn().mockResolvedValue('device')}));
jest.mock('../src/lib/workspaceIdentity', () => ({ensureWorkspaceKey:jest.fn().mockResolvedValue('secret')}));
jest.mock('../src/state/useWorkspaceJobs', () => ({useWorkspaceJobs:{getState:()=>({save:mockSaveJob,remove:mockRemoveJob})}}));
jest.mock('../src/state/useWorkspaceStore', () => ({useWorkspaceStore:{getState:()=>({save:mockSaveRecord})}}));
const mockSaveJob=jest.fn(),mockRemoveJob=jest.fn(),mockSaveRecord=jest.fn();
import {analyzeChatVideo,askVideoQuestion} from '../src/lib/analyzeChatVideo';
import {analyzeSource,cancelSourceJob} from '../src/api/analyzeSource';
const source={type:'youtube',url:'https://www.youtube.com/watch?v=jNQXAC9IVRw'};
const result={title:'Elephants',overview:'The speaker is at an elephant enclosure.',keyPoints:['Long trunks.'],sections:[],actions:[],evidence:[],limitations:[],coverage:{kind:'audiovisual'}};
beforeEach(()=>{jest.clearAllMocks();mockSaveJob.mockResolvedValue();mockRemoveJob.mockResolvedValue();mockSaveRecord.mockResolvedValue();analyzeSource.mockResolvedValue(result);});
test('chat and library share the same durable analysis id and result',async()=>{
 const {record}=await analyzeChatVideo({source,signal:new AbortController().signal});
 expect(mockSaveJob).toHaveBeenCalledWith(expect.objectContaining({id:record.id,type:'youtube'}));
 expect(analyzeSource).toHaveBeenCalledWith(expect.objectContaining({requestId:record.id,source,deviceId:'device',workspaceKey:'secret'}));
 expect(mockSaveRecord).toHaveBeenCalledWith(record);expect(mockRemoveJob).toHaveBeenCalledWith(record.id);
});
test('private chat does not write video history or pending jobs to disk',async()=>{
 await analyzeChatVideo({source,privateMode:true,signal:new AbortController().signal});
 expect(mockSaveJob).not.toHaveBeenCalled();expect(mockSaveRecord).not.toHaveBeenCalled();
});
test('stop cancels server job and does not store a successful result',async()=>{
 const controller=new AbortController();analyzeSource.mockImplementation(async()=>{controller.abort();throw Object.assign(new Error(),{code:'ABORTED'});});
 await expect(analyzeChatVideo({source,signal:controller.signal})).rejects.toMatchObject({code:'ABORTED'});
 expect(cancelSourceJob).toHaveBeenCalledWith(expect.objectContaining({deviceId:'device',workspaceKey:'secret'}));expect(mockSaveRecord).not.toHaveBeenCalled();
});
test('interrupted polling leaves the job recoverable; a failed library save does not discard the completed summary',async()=>{
 analyzeSource.mockRejectedValueOnce(Object.assign(new Error(),{code:'NETWORK'}));
 await expect(analyzeChatVideo({source})).rejects.toMatchObject({code:'NETWORK'});expect(mockRemoveJob).not.toHaveBeenCalled();
 mockSaveRecord.mockRejectedValueOnce(new Error('disk full'));
 expect(await analyzeChatVideo({source})).toMatchObject({saveFailed:true,record:{result:{title:'Elephants'}}});
});

test('accepted jobs remain recoverable after a temporary HTTP poll failure', async () => {
 analyzeSource.mockRejectedValueOnce(Object.assign(new Error(), {code:'SERVICE_BUSY',status:429,accepted:true}));
 await expect(analyzeChatVideo({source})).rejects.toMatchObject({accepted:true});
 expect(mockRemoveJob).not.toHaveBeenCalled();
});

test('unconfigured video service clears a job that was never accepted', async () => {
 analyzeSource.mockRejectedValueOnce(Object.assign(new Error(), {code:'VIDEO_NOT_CONFIGURED',status:503}));
 await expect(analyzeChatVideo({source})).rejects.toMatchObject({code:'VIDEO_NOT_CONFIGURED'});
 expect(mockRemoveJob).toHaveBeenCalledTimes(1);
});

test('video questions reuse the retry id without duplicating library entries',async()=>{
 const ready=jest.fn();
 await askVideoQuestion({source:{type:'upload',sourceJobId:'parent',question:'Who?'},requestId:'same-question',onRequestReady:ready});
 expect(analyzeSource).toHaveBeenCalledWith(expect.objectContaining({requestId:'same-question',deviceId:'device',workspaceKey:'secret'}));
 expect(ready).toHaveBeenCalledWith(expect.objectContaining({requestId:'same-question'}));
 expect(mockSaveJob).not.toHaveBeenCalled();expect(mockSaveRecord).not.toHaveBeenCalled();
});
test('stopping a video question cancels only its own job',async()=>{
 const controller=new AbortController();analyzeSource.mockImplementation(async()=>{controller.abort();throw Object.assign(new Error(),{code:'ABORTED'});});
 await expect(askVideoQuestion({source:{sourceJobId:'parent'},requestId:'question',signal:controller.signal})).rejects.toMatchObject({code:'ABORTED'});
 expect(cancelSourceJob).toHaveBeenCalledWith(expect.objectContaining({requestId:'question'}));
});
