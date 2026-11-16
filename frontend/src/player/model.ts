// Platform v1 types: no canvas-library fields are persisted.
export interface Point { x: number; y: number }
export interface ObjectState { position: Point; visible: boolean; highlight: boolean; status: string }
export interface PacketFields {source:string;target:string;protocol:'TCP';sourcePort:number;targetPort:number;flags:'SYN'|'SYN, ACK'|'ACK';seq:number;ack?:number;bytes:number}
export interface SceneObject { id: string; type: string; component: string; position: Point; size: {width:number;height:number}; initial: Omit<ObjectState,'position'>; content: {label:string;visual?:'laptop'|'server'|'router'|'cloud';address?:string;packet?:PacketFields;tex?:string;states?:Record<string,string>;source?:string;target?:string;assetId?:string;points?:Point[]}; details: Record<string,string> }
export interface Action { id:string; type:string; target:string; atMs:number; durationMs:number; params: {x?:number;y?:number;value?:string|boolean} }
export interface Step { id:string;title:string;narration:string;durationMs:number;actions:Action[] }
export interface Scene {id:string;title:string;canvas:{width:number;height:number};objects:SceneObject[];steps:Step[]}
export interface Course {category:string;formatVersion:string;id:string;title:string;summary:string;components:{type:string;version:string}[];assets:{id:string;purpose:string}[];chapters:{id:string;title:string;scenes:Scene[]}[]}
