export function createDemoApi(options:{manifest:any;load:(name:string)=>Promise<any>}):(path:string,options?:{method?:string;body?:BodyInit|null})=>Promise<any>
