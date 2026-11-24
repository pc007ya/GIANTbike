const test=require('node:test');
const assert=require('node:assert/strict');
const access=require('../access-model.js');
test('tenant identity uses verified server token, not local selection',()=>{
  const user={uid:'p'}, isAdmin=e=>e==='a@example.invalid';
  const password={signInProvider:'password',claims:{email:'u@example.invalid',email_verified:true,giantbikeVendor:'ignored-claim'}};
  const membership={email:'u@example.invalid',vendorId:'beta_test',enabled:true};
  assert.equal(access.session(user,password,isAdmin),null);
  assert.equal(access.session(user,password,isAdmin,{...membership,enabled:false}),null);
  assert.equal(access.session(user,password,isAdmin,{...membership,email:'different@example.invalid'}),null);
  assert.deepEqual(access.session(user,password,isAdmin,membership),{uid:'p',role:'vendor',id:'beta_test',email:'u@example.invalid'});
  for (const id of ['anon','admin','anonymous','other/a','']) assert.equal(access.session(user,password,isAdmin,{...membership,vendorId:id}),null);
  assert.equal(access.session({...user,isAnonymous:true},password,isAdmin),null);
  assert.equal(access.session(user,{...password,claims:{...password.claims,email_verified:false}},isAdmin),null);
  assert.equal(access.session(user,{...password,claims:{email:'a@example.invalid',email_verified:true}},isAdmin),null);
});
test('public catalog and vendor project views remove secrets and other vendors',()=>{
  const snap={items:[{id:'test',name:{zh:'測試'},internalMemo:'not included',steps:[{title:'1',private:'x'}],fixtures:[{code:'T',cost:'999'}]}],parts:{first:{code:'A',loc:'warehouse',stock:100}},vendors:[{id:'a',name:{zh:'甲'},code:'private'},{id:'b',name:{zh:'乙'},code:'private'}],testcodes:[{id:'both',vendorIds:['a','b'],params:[],private:'masked'},{id:'onlyB',vendorIds:['b']}],adminCode:'private',sheetsConfig:{secret:'private'}};
  const ca=access.catalogSnapshot(snap);
  assert.deepEqual(ca.parts,{first:{code:'A'}});assert.equal(ca.items[0].steps[0].private,undefined);assert.equal(ca.items[0].fixtures[0].cost,undefined);assert(!JSON.stringify(ca).includes('private'));
  const a=access.vendorProjectSnapshot(snap,'a');
  assert.deepEqual(a,{vendor:{id:'a',name:{zh:'甲'}},testcodes:[{id:'both',vendorIds:['a'],params:[]}]});
});
test('memory data does not survive logout or switch to another UID with same vendor',()=>{
  const mem=access.memory(), a={uid:'1',role:'vendor',id:'a'};
  assert.equal(mem.write('stock','a',{secret:1}),false);
  mem.setScope(a);assert.equal(mem.write('stock','a',{qty:1}),true);
  assert.equal(mem.write('stock','b',{secret:2}),false);
  mem.setScope({...a,uid:'2'});assert.deepEqual(mem.read('stock','a'),{});
  mem.setScope({uid:'3',role:'admin',id:'admin'});assert.equal(mem.write('stock','b',{qty:2}),true);
  mem.setScope(a);assert.deepEqual(mem.read('stock','b'),{});
});
