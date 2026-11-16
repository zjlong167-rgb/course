import {chromium} from 'playwright'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const cred=JSON.parse(fs.readFileSync('.local/s03-test-credentials.json','utf8').replace(/^\uFEFF/,''))
const browser=await chromium.launch({channel:'chrome'}),p=await browser.newPage({viewport:{width:1550,height:1020}}),errors=[],results=[]
p.setDefaultTimeout(6000)
p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept())
const field=name=>p.getByLabel(name,{exact:true}),btn=name=>p.getByRole('button',{name,exact:true}),click=name=>btn(name).click()
const fill=(name,v)=>field(name).fill(String(v)),sel=(name,v)=>field(name).selectOption(String(v))
const body=async()=>JSON.parse(await field('课程 JSON').inputValue()),status=v=>p.waitForFunction(v=>document.querySelector('.studio-message')?.textContent.includes(v),v)
async function number(name,v){await fill(name,v);await field(name).press('Tab')}
async function save(){await click('保存草稿');await status('已保存')}
const stepTime='步骤时长（ms）',at='开始时间（ms）',dur='持续时间（ms）'
try{
 await p.goto((process.env.BROWSER_BASE_URL||'http://127.0.0.1:5173')+'/#/studio');await fill('账号',cred.username);await fill('密码',cred.password);await click('登录');await btn('创建课程').waitFor()
 await field('上传资源').setInputFiles('samples/assets/station.png');await status('资源已保存')
 for(let i=-1;i<4;i++){
  await sel('建课起点',i);await click('创建课程');await status('课程已创建')
  const initial=await body(),scene=initial.chapters[0].scenes[0],steps=scene.steps
  const title='S05 · '+initial.title+' · '+Date.now()
  await fill('课程标题',title);await fill('章节标题','教学演示');await fill('场景标题',initial.title+' · 分步演示')
  await sel('编辑对象',scene.objects[0].id);await fill('对象名称',scene.objects[0].content.label+'（示意）')
  await fill('对象 Y',scene.objects[0].position.y+1)
  if(i===-1){
    await click('新增步骤');await fill('步骤标题','解释状态变化');await fill('步骤讲解','观察标注高亮。');await click('新增动作');await sel('动作类型','highlight')
    await click('步骤上移');assert.equal((await body()).chapters[0].scenes[0].steps[0].title,'解释状态变化')
    await click('新增动作');await sel('动作类型','move');await number(at,125);await number(dur,1000)
    await number(stepTime,100);assert.match(await p.locator('.step-composer [role=status]').innerText(),/不能缩短/);assert.equal(await field(stepTime).inputValue(),'3000')
    await number(at,2100);assert.equal(await field(at).inputValue(),'125')
    await click('动作上移');assert.equal((await body()).chapters[0].scenes[0].steps[0].actions[0].type,'move')
    // Both schema and semantic diagnostics navigate to the bad action, then allow a form repair.
    await fill('终点 x',100001);await click('服务器校验');await status('课程校验失败')
    await p.getByRole('button',{name:/定位：.*动作 1.*params\/x/}).click();assert(await field('终点 x').evaluate(e=>e===document.activeElement));await fill('终点 x',320)
    await click('删除动作');assert.equal((await body()).chapters[0].scenes[0].steps[0].actions.length,1)
  }else{
    // Retain template objects; rebuild every storyboard step and action through author controls.
    await click('新增步骤')
    for(let j=0;j<steps.length;j++){await sel('教学步骤',0);await click('删除步骤')}
    for(const [j,s] of steps.entries()){
      if(j)await click('新增步骤')
      await fill('步骤标题',s.title);await fill('步骤讲解',s.narration+'（分步演示）');await number(stepTime,s.durationMs)
      for(const a of s.actions){
        await click('新增动作');await sel('动作目标',a.target);await sel('动作类型',a.type);await number(at,a.atMs)
        if(a.type==='move'){await number(dur,a.durationMs);await fill('终点 x',a.params.x);await fill('终点 y',a.params.y)}
        if(a.type==='highlight')await sel('高亮效果',a.params.value)
        if(a.type==='setState')await fill('目标状态',a.params.value)
      }
    }
    const edited=(await body()).chapters[0].scenes[0].steps
    for(const [j,s] of steps.entries()){
      assert.equal(edited[j].durationMs,s.durationMs)
      assert.deepEqual(edited[j].actions.map(({id,...a})=>a),s.actions.map(({id,...a})=>a))
      assert.notEqual(edited[j].id,s.id)
    }
  }
  await sel('教学步骤',0);const expected=await body(),newSteps=expected.chapters[0].scenes[0].steps
  await click('预览本地编辑');await p.locator('.shared-player').waitFor()
  assert.equal(await p.getByTestId('narration').innerText(),newSteps[0].narration)
  await click('授权预览');await status('服务器已保存');assert.equal(await p.getByTestId('narration').innerText(),steps[0].narration)
  await save();await click('重新打开');await status('已从数据库');assert.deepEqual(await body(),expected)
  await click('授权预览');await status('服务器已保存')
  const player=p.locator('.shared-player')
  let end=0
  for(const s of newSteps){
    assert.equal(await p.getByTestId('narration').innerText(),s.narration);assert.equal(Number(await player.getAttribute('data-time')),end)
    end+=s.durationMs;await click('下一步')
  }
  assert.equal(Number(await player.getAttribute('data-time')),end)
  await field('选择对象').selectOption({index:1});await p.getByTestId('details').waitFor()
  await click('重置');await sel(i===0?'播放速度':'播放倍速',2);await click('播放')
  await p.waitForFunction(end=>Number(document.querySelector('.shared-player').dataset.time)===end,end,{timeout:end+5000})
  assert.equal(await player.getAttribute('data-playing'),'false')
  await player.screenshot({path:'docs/evidence/s05-player-'+(i+1)+'.png'})
  await p.locator('.step-composer').screenshot({path:'docs/evidence/s05-steps-'+(i+1)+'.png'})
  results.push({courseId:await p.locator('.studio-toolbar strong').innerText(),title,steps:newSteps.length,actions:newSteps.reduce((n,s)=>n+s.actions.length,0),endMs:end,formRebuild:i>=0,reopened:true,previewSnapshots:true,playedToEnd:true})
  console.log('verified',i,title)
 }
 // A legacy broken reference is injected only into the GET test fixture; author repairs it in the form.
 const original=await body(),broken=structuredClone(original);broken.chapters[0].scenes[0].steps[0].actions[0].target='nonexistent'
 await p.route('**/api/v1/courses/*/draft',async r=>{const response=await r.fetch(),d=await response.json();await r.fulfill({response,json:{...d,body:broken}})},{times:1})
 await click('重新打开');await status('已从数据库');await click('保存草稿');await status('请定位')
 const issue=p.getByRole('button',{name:/定位：.*步骤 1.*动作 1.*target/})
 await issue.click();assert(await field('动作目标').evaluate(e=>e===document.activeElement))
 await click('服务器校验');await status('课程校验失败');await issue.click()
 await sel('动作目标',original.chapters[0].scenes[0].steps[0].actions[0].target);await save()
 assert.deepEqual(errors,[]);fs.writeFileSync('docs/evidence/s05-browser.json',JSON.stringify({browser:await browser.version(),results,errors,reference:'invalid GET fixture; real API validation; form repair saved'},null,2))
}catch(e){fs.writeFileSync('docs/evidence/s08-author-failure.json',JSON.stringify({body:await body(),errors},null,2));await p.screenshot({path:'docs/evidence/s08-author-failure.png',fullPage:true});console.error('timeline', await p.locator('.step-composer').allTextContents(),errors);throw e}finally{await browser.close()}
