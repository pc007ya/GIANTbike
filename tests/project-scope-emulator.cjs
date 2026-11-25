const a=require('node:assert/strict');
const root='http://127.0.0.1:18654/v1/projects/demo-giantbike-scope/databases/(default)/documents/';
const fields=o=>({fields:Object.fromEntries(Object.entries(o).map(([k,v])=>[k,typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:{integerValue:String(v)}]))});
const B=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(uid,email,provider,approved=true){const now=Math.floor(Date.now()/1000);return B({alg:"none",typ:"JWT"})+'.'+B({aud:"demo-giantbike-scope",iss:"https://securetoken.google.com/demo-giantbike-scope",iat:now-1,exp:now+900,auth_time:now-1,sub:uid,user_id:uid,email,email_verified:approved,firebase:{sign_in_provider:provider,identities:{"google.com":["ga"]}}})+'.';}
const as=(p,t)=>fetch(root+p,{headers:t?{Authorization:'Bearer '+t}:{}}).then(r=>r.status);
async function seed(p,o){const r=await fetch(root+p,{method:'PATCH',headers:{Authorization:'Bearer owner','Content-Type':'application/json'},body:JSON.stringify(fields(o))});if(!r.ok) throw Error('seed '+p+' '+r.status);}
(async()=>{
 for(const [id,vendorId] of [['a','a'],['b','b'],['c','cic']])await seed('bff_supplierAccounts/'+id,{email:id+'@example.invalid',enabled:true,vendorId});
 await seed('bff_vendorProjects/a',{_rev:2,chunked:true,chunks:1});
 await seed('bff_vendorProjects/a/chunks/data_0',{i:0,_rev:2,s:'current'});
 await seed('bff_vendorProjects/a/chunks/data_1',{i:1,_rev:1,s:'stale'});
 await seed('bff_vendorProjects/b',{_rev:2,s:'b-only'});
 await seed('bff_vendorProjects/cic',{_rev:2});
 await seed('bff_catalog/data',{s:'full catalog'});
 const A=token('a','a@example.invalid','password'), B1=token('b','b@example.invalid','password'), C=token('c','c@example.invalid','password'), G=token('a','a@example.invalid','google.com'), U=token('a','a@example.invalid','password',false);
 const expects=[
  ['bff_vendorProjects/a',null,403],['bff_vendorProjects/a',A,200],['bff_vendorProjects/b',A,403],['bff_vendorProjects/b',B1,200],
  ['bff_vendorProjects/a/chunks/data_0',A,200],['bff_vendorProjects/a/chunks/data_0',B1,403],
  ['bff_vendorProjects/a/chunks/data_1',A,403],['bff_vendorProjects/cic',C,200],['bff_vendorProjects/a',C,403],
  ['bff_catalog/data',A,403],['bff_vendorProjects/a',U,403],['bff_vendorProjects/a',G,403],
 ];
 for(const [path,t,code] of expects)a.equal(await as(path,t),code,path);
 await seed('bff_googleLinks/a',{googleSub:'ga'});a.equal(await as('bff_vendorProjects/a',G),200);
 await seed('bff_supplierAccounts/a',{email:'a@example.invalid',enabled:false,vendorId:'a'});
 a.equal(await as('bff_vendorProjects/a',G),403);a.equal(await as('bff_vendorProjects/a',A),403);
 console.log('15 local Firestore Rules assertions passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
