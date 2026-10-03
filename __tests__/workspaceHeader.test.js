import React from 'react';
import renderer, {act} from 'react-test-renderer';
import AssistantHeader from '../src/components/chat/AssistantHeader';
jest.mock('react-i18next',()=>({useTranslation:()=>({t:(_key,options)=>options.defaultValue})}));
jest.mock('../src/data/presets',()=>({PRESETS:[{system:'known',avatar:1,name:'Assistant'}]}));
test('source chats never show the misleading Assistant unavailable persona',()=>{
 let view;act(()=>{view=renderer.create(<AssistantHeader thread={{system:'source-specific instructions',meta:{workspaceId:'saved-report'},messages:[]}} showOnlyWhenEmpty/>);});
 expect(view.toJSON()).toBeNull();act(()=>view.unmount());
});
test('nonempty custom conversations honor showOnlyWhenEmpty before looking up a preset',()=>{
 let view;act(()=>{view=renderer.create(<AssistantHeader thread={{system:'custom',messages:[{role:'user',content:'Hello'}]}} showOnlyWhenEmpty/>);});
 expect(view.toJSON()).toBeNull();act(()=>view.unmount());
});
