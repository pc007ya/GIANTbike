const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../cloud.js'),'utf8');
const init=src.lastIndexOf('(async()=>{');
assert(init>1000);
const window={GIANTBIKE_ACCESS:{},addEventListener(){},dispatchEvent(){}};
const ctx=vm.createContext({window,console});vm.runInContext(src.slice(0,init),ctx);
vm.runInContext(`
var session={uid:"test-uid",role:"vendor",email:"a@example.invalid"};
var user={uid:"test-uid",isAnonymous:false};
var trace=[]; var invalid=false; var switchUser=false;
window.AUTH={get:()=>session};
api={auth:{currentUser:user},a:{
  EmailAuthProvider:{credential:(email,pwd)=>({email,pwd})},
  reauthenticateWithCredential:async(u,c)=>{trace.push(["verify",u.uid,c.email]); if(invalid)throw {code:"auth/wrong-password"}; if(switchUser) generation++;},
  updatePassword:async(u,p)=>{trace.push(["update",u.uid,p.length]);}
}};
`,ctx);
(async()=>{
 const f=window.CLOUD.changeVendorPassword;
 await assert.rejects(f("old","short"),{code:"bff/new-password-required"});
 await assert.rejects(f("same password", "same password"),{code:"bff/new-password-required"});
 vm.runInContext("invalid=true",ctx);
 await assert.rejects(f("bad","different passphrase"),{code:"auth/wrong-password"});
 vm.runInContext("invalid=false;switchUser=true",ctx);
 await assert.rejects(f("current","different passphrase"),{code:"bff/session-changed"});
 vm.runInContext("switchUser=false",ctx);
 await f("current","different passphrase");
 assert.equal(vm.runInContext('trace.filter(t=>t[0]==="update").length',ctx),1);
 assert.equal(vm.runInContext('trace.find(t=>t[0]==="update")[1]',ctx),"test-uid");
 // Contract for app, cloud, rules before running live against a real service.
 const app=fs.readFileSync("app.jsx","utf8"), rules=fs.readFileSync("firestore.rules","utf8");
 assert.match(app,/if \(!vendor\) return <Login/);
 assert.doesNotMatch(app,/返回公開治具目錄|publicPages|Set\/reset password/);
 assert.match(app,/管理員提供的帳號與初始密碼/);
 assert.match(app,/綁定 Google/);
 assert.match(src,/access\.scopedVendorCatalog\(raw,id\)/);
 assert.doesNotMatch(src,/subscribeView\(catalogRef/);
 assert.match(rules,/match \/bff_catalog\/\{docId\} \{\s+allow read: if isAdmin\(\);/);
 assert.match(rules,/chunk\._rev == current\._rev/);
 console.log("Password/session and privacy wiring checks passed, no production I/O");
})().catch(e=>{console.error(e);process.exitCode=1});