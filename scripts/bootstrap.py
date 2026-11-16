"""Generate the checked-in S01 fixture corpus (not needed at runtime)."""
import json
from pathlib import Path

def write(path, value):
    p = Path(path); p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

def obj(props, required=None):
    return dict(type='object', properties=props, required=required or list(props), additionalProperties=False)

def arr(ref, minimum=0):
    return dict(type='array', items={'$ref': '#/$defs/'+ref}, minItems=minimum)

ident = dict(type='string', pattern='^[a-z][a-z0-9_-]{0,63}$')
string = dict(type='string', minLength=1, maxLength=10000)
number = dict(type='number', minimum=-100000, maximum=100000)
positive = dict(type='number', exclusiveMinimum=0, maximum=100000)
time = dict(type='integer', minimum=0, maximum=86400000)
version = dict(type='string', pattern='^1\\.[0-9]+\\.[0-9]+$')
point = obj({'x':number,'y':number})
state = obj({'visible':{'type':'boolean'},'highlight':{'type':'boolean'},'status':string})
params = {
    'show': obj({}), 'hide':obj({}),
    'highlight':obj({'value':{'type':'boolean'}}),
    'move':obj({'x':number,'y':number}),
    'setState':obj({'value':string})
}
action = obj({'id':ident,'type':{'enum':list(params)},'target':ident,'atMs':time,'durationMs':time,'params':{'type':'object'}})
action['allOf'] = [{'if':{'properties':{'type':{'const':k}}},'then':{'properties':{'params':v}}} for k,v in params.items()]
defs = {
    'asset':obj({'id':ident,'purpose':string}),
    'component':obj({'type':{'enum':['flow','formula','geometry','annotation']},'version':version}),
    'object':obj({'id':ident,'type':{'enum':['node','edge','packet','formula','geometry','text','image']},'component':{'enum':['flow','formula','geometry','annotation']},'position':point,'size':obj({'width':positive,'height':positive}),'initial':state,'content':obj({'label':string,'tex':string,'source':ident,'target':ident,'assetId':ident,'states':{'type':'object','additionalProperties':{'type':'string','minLength':1}},'points':{'type':'array','items':point,'minItems':3}},['label']),'details':{'type':'object','additionalProperties':{'type':'string'}}}),
    'action':action,
    'step':obj({'id':ident,'title':string,'narration':string,'durationMs':dict(type='integer',minimum=1,maximum=86400000),'actions':arr('action')}),
    'scene':obj({'id':ident,'title':string,'canvas':obj({'width':positive,'height':positive}),'objects':arr('object',1),'steps':arr('step',1)}),
    'chapter':obj({'id':ident,'title':string,'scenes':arr('scene',1)})
}
schema=obj({'formatVersion':{'const':'1.0.0'},'id':ident,'title':string,'summary':string,'category':{'enum':['network','business','math','manufacturing']},'assets':arr('asset'),'components':arr('component',1),'chapters':arr('chapter',1)})
schema.update({'$schema':'https://json-schema.org/draft/2020-12/schema','$id':'https://course.local/schema/course-v1.json','$defs':defs})
write('contracts/course-v1.schema.json',schema)

def entity(id, label, x, y, type='node', component='flow', **content):
    return dict(id=id,type=type,component=component,position=dict(x=x,y=y),size=dict(width=140,height=80),initial=dict(visible=True,highlight=False,status='idle'),content=dict(label=label,**content),details={'说明':label})
def act(id,type,target,params={},at=0,duration=0):
    return dict(id=id,type=type,target=target,atMs=at,durationMs=duration,params=params)
def step(id,title,text,actions):
    return dict(id=id,title=title,narration=text,durationMs=2000,actions=actions)
def course(id,title,category,objects,steps,components,assets=[]):
    return dict(formatVersion='1.0.0',id=id,title=title,summary=title+'的分步教学样例',category=category,assets=assets,components=[dict(type=c,version='1.0.0') for c in components],chapters=[dict(id='chapter-1',title='基础演示',scenes=[dict(id='scene-1',title=title,canvas=dict(width=960,height=540),objects=objects,steps=steps)])])

tcp=course('tcp','TCP 三次握手','network',[
    entity('client','客户端',80,200),entity('server','服务端',720,200),entity('link','网络链路',80,240,type='edge',source='client',target='server'),
    entity('syn','SYN seq=100',80,120,type='packet'),entity('synack','SYN+ACK seq=300 ack=101',720,120,type='packet'),entity('ack','ACK seq=101 ack=301',80,120,type='packet')], [
    step('s1','发送 SYN','客户端发送 SYN，进入 SYN-SENT；SYN 占用一个序号。',[act('a1','move','syn',{'x':720,'y':120},duration=1500),act('a2','setState','client',{'value':'SYN-SENT'})]),
    step('s2','回复 SYN+ACK','服务端确认 101，发送自己的初始序号 300，进入 SYN-RECEIVED。',[act('a3','move','synack',{'x':80,'y':120},duration=1500),act('a4','setState','server',{'value':'SYN-RECEIVED'})]),
    step('s3','发送 ACK','客户端确认 301；双方进入 ESTABLISHED。ACK 不携带数据时不占序号。',[act('a5','move','ack',{'x':720,'y':120},duration=1500),act('a6','setState','client',{'value':'ESTABLISHED'},at=1500),act('a7','setState','server',{'value':'ESTABLISHED'},at=1500)])],['flow'])
for o in tcp['chapters'][0]['scenes'][0]['objects']:
    if o['type']=='packet':
        o['initial']['visible']=False
for i,s in enumerate(tcp['chapters'][0]['scenes'][0]['steps']):
    s['actions'].insert(0,act('show-'+str(i),'show',['syn','synack','ack'][i]))
    s['actions'].append(act('hide-'+str(i),'hide',['syn','synack','ack'][i],at=1800))
write('samples/valid/tcp.json',tcp)
import copy
minimal=copy.deepcopy(tcp)
minimal.update(id='minimal',title='最小合法课程')
minimal['chapters'][0]['scenes'][0]['objects']=minimal['chapters'][0]['scenes'][0]['objects'][:1]
minimal['chapters'][0]['scenes'][0]['steps']=minimal['chapters'][0]['scenes'][0]['steps'][:1]
minimal['chapters'][0]['scenes'][0]['steps'][0]['actions']=[]
write('samples/valid/minimal.json',minimal)
business=course('expense','报销审批流程','business',[entity('employee','申请人',40,200),entity('manager','主管',300,200),entity('finance','财务',600,200),entity('bill','报销单 ¥800',40,80)], [
    step('s1','提交','演示路径固定为 800 元凭证齐全，提交主管审批。',[act('a1','setState','bill',{'value':'submitted'}),act('a2','move','bill',{'x':300,'y':80},duration=1500)]),
    step('s2','主管通过','本路径主管同意；驳回路径仅在详情说明，不提供学员选择。',[act('a3','highlight','manager',{'value':True}),act('a4','move','bill',{'x':600,'y':80},duration=1500)]),
    step('s3','财务付款','财务核验后完成付款；异常票据应退回补充。',[act('a5','setState','bill',{'value':'paid'})])],['flow'])
write('samples/valid/expense.json',business)
math=course('pythagoras','勾股定理','math',[entity('triangle','直角三角形 a=3 b=4 c=5',80,100,type='geometry',component='geometry',points=[{'x':0,'y':0},{'x':0,'y':180},{'x':240,'y':180}]),entity('formula','面积分解',360,180,type='formula',component='formula',tex=r'(a+b)^2=4\cdot\frac{ab}{2}+c^2',states={'simplified':r'a^2+b^2=c^2'})],[
    step('s1','观察直角边','a、b 是直角边，c 是斜边。',[act('a1','highlight','triangle',{'value':True})]),
    step('s2','面积等式','同一大正方形：(a+b)² = 4×ab/2 + c²。',[act('a2','show','formula')]),
    step('s3','整理结果','展开并消去 2ab，得 a²+b²=c²；代入 3、4 得 5。',[act('a3','setState','formula',{'value':'simplified'})])],['geometry','formula'])
math['chapters'][0]['scenes'][0]['objects'][1]['initial']['visible']=False
write('samples/valid/pythagoras.json',math)
factory=course('production','生产加工流程','manufacturing',[entity('cut','切割',40,220),entity('drill','钻孔',320,220),entity('qc','检验',650,220),entity('material','物料',40,80),entity('photo','工位示意图',600,30,type='image',component='annotation',assetId='station-image')],[
    step('s1','下料切割','原料进入切割工位；示例不代表真实设备操作规程。',[act('a1','setState','material',{'value':'cut'})]),
    step('s2','钻孔加工','切割件转至钻孔工位并完成加工。',[act('a2','move','material',{'x':320,'y':80},duration=1500),act('a3','setState','material',{'value':'drilled'},at=1500)]),
    step('s3','质量检验','转至检验工位；预设演示路径为合格入库。',[act('a4','move','material',{'x':650,'y':80},duration=1500),act('a5','highlight','photo',{'value':True}),act('a6','setState','material',{'value':'qualified'},at=1500)])],['flow','annotation'],[{'id':'station-image','purpose':'工位示意，samples/assets/station.svg 自制，无外部版权'}])
write('samples/valid/production.json',factory)
import copy
cases={}
bad=copy.deepcopy(tcp); bad['formatVersion']='2.0.0'; cases['version']=bad
bad=copy.deepcopy(tcp); bad['chapters'][0]['scenes'][0]['steps'][0]['actions'][0]['target']='missing'; cases['reference']=bad
bad=copy.deepcopy(tcp); bad['chapters'][0]['scenes'][0]['steps'][0]['actions'][1]['durationMs']=-1; cases['negative-time']=bad
bad=copy.deepcopy(tcp); bad['chapters'][0]['scenes'][0]['objects'][1]['id']='client'; cases['duplicate-id']=bad
bad=copy.deepcopy(tcp); bad['chapters'][0]['scenes'][0]['steps'][0]['actions'][1]['params']={'x':'bad','y':0}; cases['move-params']=bad
bad=copy.deepcopy(tcp); bad['chapters'][0]['scenes'][0]['steps'][0]['actions'][1]['durationMs']=3000; cases['overflow']=bad
bad=copy.deepcopy(factory); bad['assets']=[]; cases['asset-reference']=bad
for name,value in cases.items(): write('samples/invalid/'+name+'.json',value)
