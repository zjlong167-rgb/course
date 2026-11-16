// Reproducible authoring source for the three preset reimbursement demonstrations.
import {writeFileSync} from 'node:fs'
const initial={visible:true,highlight:false,status:'待处理'}
function node(id,label,x,y,description,width=170,height=108){return {id,type:'node',component:'flow',position:{x,y},size:{width,height},initial:{...initial},content:{label},details:{职责:description}}}
function scene(prefix,title,amount,path){
 const id=s=>prefix+s
 const objects=[
  node('employee','申请人',30,310,'整理费用明细、业务事由与票据；退回后补正并重新提交。'),
  node('manager','部门主管',250,310,'确认业务真实性、费用必要性与预算归属。'),
  node('finance','财务审核',470,310,'核验票据、金额及重复报销；审核通过后转付款。'),
  node('cashier','出纳付款',690,310,'依据审批结果核对收款信息并执行付款，付款成功后登记回单。'),
  node('archive','归档留痕',910,310,'关联申请、票据、审批记录和付款回单，供后续查询。'),
  node('director','授权负责人',470,40,'超出示例授权额度时加签；以企业实际授权制度为准。'),
  node('correction','退回补正',250,520,'说明缺失材料及原因；补正后重新送审，不直接付款。'),
  node('bill',`报销单 · ¥${amount}`,40,205,'教学单据：差旅费用；金额与规则均为示例。',150,68)
 ]
 objects.find(o=>o.id==='bill').type='packet'
 const links=[['submit','employee','manager','提交申请'],['approve','manager','finance','主管同意'],['verify','finance','cashier','核验通过'],['pay','cashier','archive','付款成功'],['escalate','manager','director','超额加签'],['authorize','director','finance','授权通过'],['return','finance','correction','材料缺失'],['revise','correction','employee','补正重提']]
 for(const [key,source,target,label] of links)objects.push({id:key,type:'edge',component:'flow',position:{x:0,y:0},size:{width:1,height:1},initial:{...initial},content:{label,source,target},details:{路径:`${objects.find(o=>o.id===source).content.label} → ${objects.find(o=>o.id===target).content.label}`,说明:label}})
 const steps=[]
 let previousRole
 function step(title,narration,role,status,x,y,link){
  const actions=[]
  const add=(type,target,params,atMs=0,durationMs=0)=>actions.push({id:`action-${steps.length}-${actions.length}`,type,target,atMs,durationMs,params})
  for(const o of objects)if(o.id!=='bill')add('highlight',o.id,{value:o.id===role||o.id===link})
  if(previousRole && previousRole!==role)add('setState',previousRole,{value:'已处理'})
  previousRole=role
  add('setState','bill',{value:status})
  add('setState',role,{value:status})
  add('move','bill',{x,y},250,1500)
  steps.push({id:`step-${steps.length}`,title,narration,durationMs:3500,actions})
 }
 step('整理报销材料',`申请人汇总 ¥${amount} 差旅费用，填写业务事由、费用明细并附票据。金额、额度和审批规则仅为教学示例，实际以企业制度为准。`,'employee','待提交',40,205)
 step('提交主管审批','提交后形成可追踪的单据。主管确认业务是否真实、费用是否必要以及预算归属；提交不代表审批通过。','manager','待主管审批',260,205,'submit')
 if(path==='escalation'){
  step('判断授权额度','本例设定 ¥3,000 为主管授权额度，¥5,800 超出示例额度，需要授权负责人加签；这不是通用报销标准。','director','待加签',660,62,'escalate')
  step('负责人加签通过','授权负责人确认超额费用的必要性与预算，批准后再交财务核验。加签不替代财务审核。','finance','加签通过',480,205,'authorize')
 }else step('主管审核通过','主管确认业务事由与预算，审批同意后交财务审核。若业务不合理，应说明原因并退回，本场景演示同意路径。','finance','主管已通过',480,205,'approve')
 if(path==='return'){
  step('财务退回补正','财务发现缺少行程附件，记录退回原因和需要补充的材料。单据回到申请人处理，不能进入付款环节。','correction','待补正',450,540,'return')
  step('补齐附件并重提','申请人补充行程附件并核对明细。本例要求重新经过主管和财务审核，保留退回与重提记录。','employee','已补正',40,205,'revise')
  step('主管重新确认','主管复核补充的业务材料，同意后再次交财务。退回前的审核结果不用于跳过本次复核。','manager','重新审批通过',260,205,'submit')
  step('财务再次核验','财务重新核对票据与附件，材料完整且金额一致后通过。演示的异常已经消除。','finance','核验通过',480,205,'approve')
 }else step('财务核验票据','财务核对票据、费用明细与审批记录，排查重复报销。材料有误时走下方退回补正路径；本场景材料齐全。','finance','核验通过',480,205)
 step('出纳执行付款','审核通过后，出纳核对收款信息并执行付款。此时仍在付款处理中，不能提前标记已支付。','cashier','付款中',700,205,'verify')
 step('确认到账并归档','本例付款成功，登记付款回单，将单据、票据、审批与回单关联归档。只有确认付款成功后，单据才进入已支付状态。','archive','paid',920,205,'pay')
 for(const o of objects){o.id=id(o.id);for(const key of ['source','target'])if(o.content[key])o.content[key]=id(o.content[key])}
 for(const s of steps){s.id=id(s.id);for(const a of s.actions){a.id=id(a.id);a.target=id(a.target)}}
 return {id:id('scene'),title,canvas:{width:1120,height:660},objects,steps}
}
const course={formatVersion:'1.0.0',id:'expense',title:'报销审批流程',summary:'跟随一张报销单，理解正常审批、退回补正与超额加签：谁来处理、为什么流转、何时真正完成付款。',category:'business',assets:[],components:[{type:'flow',version:'1.0.0'}],chapters:[{id:'expense-chapter',title:'报销审批 · 三条预设路径',scenes:[scene('','正常报销 · 材料齐全',800,'normal'),scene('return-','退回补正 · 缺少附件',800,'return'),scene('extra-','超额加签 · 授权审批',5800,'escalation')]}]}
writeFileSync('samples/valid/expense.json',JSON.stringify(course,null,2)+'\n')
